// Fake cloud store for debug builds and tests: one folder of files on the phone. It stands in for
// iCloud Drive (iOS) or the Google Drive app data folder (Android), with the same wording.
//
// Device QA moves the folder between installs to act as the cloud:
//   iOS:     <app data container>/Documents/valu-fake-cloud   (xcrun simctl get_app_container ... data)
//   Android: /sdcard/Android/data/com.valumobile/files/valu-fake-cloud   (adb pull / push)
// The files hold only the encrypted backup (the same bytes the real store would get).
//
// A write goes to a temporary file first and then replaces the old file, so a kill leaves the old
// file or the new one, never a half file under the real name.
import {Platform} from 'react-native';
import {CloudError, CLOUD_ERROR} from '../cloudErrors';

export const FAKE_DIR_NAME = 'valu-fake-cloud';
const NAME_RE = /^[A-Za-z0-9._-]+$/;

const checkName = name => {
  if (typeof name !== 'string' || !NAME_RE.test(name) || name.endsWith('.tmp') || name.endsWith('.old')) {
    throw new CloudError(CLOUD_ERROR.NOT_FOUND, 'Invalid file name');
  }
};

// fs: the react-native-fs API subset (exists, mkdir, readDir, readFile, writeFile, moveFile,
// unlink). Tests pass an in-memory one.
export function createFakeStore({fs, dir, kind = Platform.OS === 'ios' ? 'icloud' : 'gdrive'}) {
  const path = name => `${dir}/${name}`;
  const ensureDir = async () => {
    if (!(await fs.exists(dir))) await fs.mkdir(dir);
  };
  const io = async run => {
    try {
      return await run();
    } catch (e) {
      if (e instanceof CloudError) throw e;
      throw new CloudError(CLOUD_ERROR.UNREACHABLE, 'Fake store failed');
    }
  };

  return {
    kind,
    fake: true,
    isAvailable: async () => ({ok: true}),
    list: () =>
      io(async () => {
        if (!(await fs.exists(dir))) return [];
        const items = await fs.readDir(dir);
        const names = new Set();
        for (const item of items) {
          if (!item.isFile()) continue;
          // A replace that stopped after the old file moved away: the old file still counts.
          const name = item.name.endsWith('.old') ? item.name.slice(0, -4) : item.name;
          if (!name.endsWith('.tmp')) names.add(name);
        }
        return [...names];
      }),
    read: name =>
      io(async () => {
        checkName(name);
        if (await fs.exists(path(name))) return fs.readFile(path(name), 'utf8');
        if (await fs.exists(path(`${name}.old`))) return fs.readFile(path(`${name}.old`), 'utf8');
        throw new CloudError(CLOUD_ERROR.NOT_FOUND, 'No such backup file');
      }),
    write: (name, text) =>
      io(async () => {
        checkName(name);
        await ensureDir();
        const tmp = path(`${name}.tmp`);
        const old = path(`${name}.old`);
        await fs.writeFile(tmp, text, 'utf8');
        // A stopped replace can leave only the old copy: keep it until the new file is in place.
        if (await fs.exists(path(name))) {
          if (await fs.exists(old)) await fs.unlink(old);
          await fs.moveFile(path(name), old);
        }
        await fs.moveFile(tmp, path(name));
        if (await fs.exists(old)) await fs.unlink(old);
      }),
  };
}

// The fake store on this phone (debug builds only; see store.js).
export function deviceFakeStore() {
  const fs = require('react-native-fs');
  const base = Platform.OS === 'ios' ? fs.DocumentDirectoryPath : fs.ExternalDirectoryPath;
  return createFakeStore({fs, dir: `${base}/${FAKE_DIR_NAME}`});
}
