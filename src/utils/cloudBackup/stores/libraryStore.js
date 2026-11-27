// Real cloud stores through react-native-cloud-storage 3.3.0:
// - iOS: the iCloud Drive ubiquity container of the app, scope "app_data" (the container root,
//   not its Documents folder, so the file does not show in the Files app).
// - Android: the Google Drive app data folder over Drive REST, with an access token for the
//   drive.appdata scope from the ValuDriveAuth native module (AuthorizationClient).
// Both need the account values in ../config.js. Without them isAvailable() says "unsupported" and
// the app shows the sheets without cloud.
import {NativeModules, Platform} from 'react-native';
import {CLOUD_ACCOUNTS, DRIVE_APPDATA_SCOPE} from '../config';
import {CloudError, CLOUD_ERROR} from '../cloudErrors';

// A file that is in iCloud but not on this phone yet: ask for the download, then read again.
const ICLOUD_READ_TRIES = 10;
const ICLOUD_READ_WAIT_MS = 1500;
const DRIVE_TIMEOUT_MS = 20000;
// A write to the iCloud container is local first. The save waits until iCloud reports the file as
// uploaded (ValuICloudStatus, ios/verusMobile/ValuICloudStatus.m); after this time it says "not
// saved" and the user can try again.
const ICLOUD_UPLOAD_WAIT_MS = 60000;
const ICLOUD_UPLOAD_POLL_MS = 1000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Library error codes (CloudStorageErrorCode) to ours. The library message can hold a path, so
// it is dropped.
const toCloudError = error => {
  if (error instanceof CloudError) return error;
  // The Drive client wraps an error of the token function (a cancelled consent) in "details".
  if (error?.details instanceof CloudError) return error.details;
  switch (error?.code) {
    case 'ERR_FILE_NOT_FOUND':
      return new CloudError(CLOUD_ERROR.NOT_FOUND);
    case 'ERR_DIRECTORY_NOT_FOUND':
    case 'ERR_ACCESS_TOKEN_MISSING':
      return new CloudError(CLOUD_ERROR.OFF);
    // Drive HTTP 401 (a token Google no longer accepts): a new try asks for a new token.
    case 'ERR_AUTHENTICATION_FAILED':
      return new CloudError(CLOUD_ERROR.UNREACHABLE);
    case 'ERR_UNSUPPORTED_PLATFORM':
      return new CloudError(CLOUD_ERROR.UNSUPPORTED);
    default:
      return new CloudError(CLOUD_ERROR.UNREACHABLE);
  }
};

const guard = async run => {
  try {
    return await run();
  } catch (e) {
    throw toCloudError(e);
  }
};

const loadLibrary = () => {
  try {
    return require('react-native-cloud-storage');
  } catch (e) {
    return null;
  }
};

// Polls the upload state of one iCloud file ({uploaded, uploading, failed}) until it is uploaded
// and no newer copy is uploading. A failed upload or the time limit: UNREACHABLE.
export async function waitForUpload(
  readState,
  {timeoutMs = ICLOUD_UPLOAD_WAIT_MS, pollMs = ICLOUD_UPLOAD_POLL_MS, now = Date.now, pause = wait} = {},
) {
  const end = now() + timeoutMs;
  for (;;) {
    let state = null;
    try {
      state = await readState();
    } catch (e) {
      state = null;
    }
    // A replace: "uploaded" can still describe the old copy while the new one uploads.
    if (state?.failed) throw new CloudError(CLOUD_ERROR.UNREACHABLE, 'The backup did not upload');
    if (state?.uploaded && !state.uploading) return;
    if (now() >= end) throw new CloudError(CLOUD_ERROR.UNREACHABLE, 'The backup did not upload');
    await pause(pollMs);
  }
}

function libraryStore({kind, storage, ready, readRetry, confirmUploaded}) {
  return {
    kind,
    fake: false,
    isAvailable: ready,
    ...(confirmUploaded ? {confirmUploaded} : {}),
    list: () => guard(() => storage().readdir('/')).then(names =>
      // iCloud names a file that is not downloaded yet ".<name>.icloud".
      names.map(n => n.replace(/^\.(.+)\.icloud$/, '$1')),
    ),
    read: name => guard(() => readRetry(name)),
    write: (name, text) => guard(() => storage().writeFile(name, text)),
  };
}

export function icloudStore() {
  const lib = loadLibrary();
  let instance = null;
  const storage = () => {
    if (!instance) {
      instance = new lib.CloudStorage(lib.CloudStorageProvider.ICloud, {scope: lib.CloudStorageScope.AppData});
    }
    return instance;
  };
  const ready = async () => {
    if (!lib || !CLOUD_ACCOUNTS.ios.containerId) return {ok: false, reason: 'unsupported'};
    try {
      return (await storage().isCloudAvailable()) ? {ok: true} : {ok: false, reason: 'off'};
    } catch (e) {
      return {ok: false, reason: 'unsupported'};
    }
  };
  const readRetry = async name => {
    for (let i = 0; ; i++) {
      try {
        return await storage().readFile(name);
      } catch (e) {
        const code = e?.code;
        // A listed file that is not on this phone yet can also read as "not found".
        const retry = code === 'ERR_FILE_NOT_DOWNLOADABLE' || code === 'ERR_READ_ERROR' || code === 'ERR_FILE_NOT_FOUND';
        if (i >= ICLOUD_READ_TRIES || !retry) throw e;
        try {
          await storage().triggerSync(name);
        } catch (_) {
          // The next read says what is wrong.
        }
        await wait(ICLOUD_READ_WAIT_MS);
      }
    }
  };
  // Resolves only when iCloud says the file is uploaded. Without the native module, or when the
  // upload fails or takes too long: UNREACHABLE, and the backup is not marked done.
  const confirmUploaded = name => {
    const status = NativeModules.ValuICloudStatus;
    if (!status?.uploadState) return Promise.reject(new CloudError(CLOUD_ERROR.UNREACHABLE, 'No upload status'));
    return waitForUpload(() => status.uploadState(name));
  };
  return libraryStore({kind: 'icloud', storage, ready, readRetry, confirmUploaded});
}

// ValuDriveAuth (android/app/src/main/java/com/valumobile/ValuDriveAuthModule.kt):
//   isAvailable() -> boolean (Google Play services present)
//   getToken(scope) -> access token; shows the account and consent screen when needed.
//   Rejects with code "CANCELLED" when the user closes it, "UNAVAILABLE" otherwise. The account
//   picker is part of that screen, so UNAVAILABLE is a failure to reach Google, not "no account".
// A Drive write returns after the server has the file, so it needs no upload check.
export function driveStore() {
  const lib = loadLibrary();
  const auth = NativeModules.ValuDriveAuth;
  let instance = null;
  const token = async () => {
    try {
      return await auth.getToken(DRIVE_APPDATA_SCOPE);
    } catch (e) {
      throw new CloudError(e?.code === 'CANCELLED' ? CLOUD_ERROR.CANCELLED : CLOUD_ERROR.UNREACHABLE);
    }
  };
  const storage = () => {
    if (!instance) {
      instance = new lib.CloudStorage(lib.CloudStorageProvider.GoogleDrive, {
        scope: lib.CloudStorageScope.AppData,
        accessToken: token,
        timeout: DRIVE_TIMEOUT_MS,
        // Two Drive files with one name: an error, never the first one by Drive id.
        strictFilenames: true,
      });
    }
    return instance;
  };
  const ready = async () => {
    if (!lib || !auth || !CLOUD_ACCOUNTS.android.driveReady) return {ok: false, reason: 'unsupported'};
    try {
      return (await auth.isAvailable()) ? {ok: true} : {ok: false, reason: 'unsupported'};
    } catch (e) {
      return {ok: false, reason: 'unsupported'};
    }
  };
  return libraryStore({kind: 'gdrive', storage, ready, readRetry: name => storage().readFile(name)});
}

export const platformStore = () => (Platform.OS === 'ios' ? icloudStore() : driveStore());
