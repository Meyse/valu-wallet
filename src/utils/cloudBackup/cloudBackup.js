// Save and restore of the encrypted cloud backup (plan B1-B4, decision record section 4).
//
// The file is the envelope of src/utils/crypto/envelope.js (sealBackupFile / openBackupFile):
// Argon2id key from the backup password, AES-256-GCM, the header bytes as associated data. Its
// plaintext is {"seed": <the electrum seed string, exactly as stored>, "channel": "electrum"}.
// Nothing else goes into the file: no address, balance, device or account name.
//
// The seed and the passwords exist only in memory, in the arguments of these calls. No function
// here logs, and no error carries them: an error from a parse of the plaintext is replaced by a
// fixed one, because a JSON parse message can quote its input.
import {
  openBackupFile,
  parseBackupFile,
  sealBackupFile,
} from '../crypto/envelope';
import {randomBytes} from '../crypto/randomBytes';
import {VaultError, VAULT_ERROR} from '../crypto/vaultErrors';
import {CloudError, CLOUD_ERROR, isCloudError} from './cloudErrors';

const FILE_PREFIX = 'valu-backup-';
const FILE_SUFFIX = '.json';
const ID_RE = /^[0-9a-f]{32}$/;
const SEED_CHANNEL = 'electrum';
const SEED_MAX_LENGTH = 4096;
// v1 compares the dates of all backup files (names carry no date). A store with more files than
// this is not one this app made: restore stops instead of picking from a part of it.
const MAX_FILES_READ = 100;

export const backupFileName = backupId => `${FILE_PREFIX}${backupId}${FILE_SUFFIX}`;

export const backupIdFromName = name => {
  if (typeof name !== 'string' || !name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_SUFFIX)) return null;
  const id = name.slice(FILE_PREFIX.length, -FILE_SUFFIX.length);
  return ID_RE.test(id) ? id : null;
};

// 16 random bytes as hex. Not derived from the seed (plan B1: a seed-derived id is an offline
// oracle for a weak legacy text seed).
export const newBackupId = async () => (await randomBytes(16)).toString('hex');

const damaged = () => new VaultError(VAULT_ERROR.FORMAT, 'Invalid backup content');

const readPayload = plaintext => {
  let payload;
  try {
    payload = JSON.parse(plaintext);
  } catch (e) {
    throw damaged();
  }
  if (
    payload == null ||
    typeof payload !== 'object' ||
    payload.channel !== SEED_CHANNEL ||
    typeof payload.seed !== 'string' ||
    payload.seed.length === 0 ||
    payload.seed.length > SEED_MAX_LENGTH
  ) {
    throw damaged();
  }
  return payload.seed;
};

const storeError = (error, fallback) => (error instanceof CloudError ? error : new CloudError(fallback));

// Seals the seed, writes the file, then reads it back from the store and opens it with the same
// password. It resolves only when the file in the store gives back the same seed: the caller marks
// the backup done after that, and never before.
export async function saveCloudBackup({store, seed, password, backupId, now = () => new Date()}) {
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > SEED_MAX_LENGTH) {
    throw new CloudError(CLOUD_ERROR.VERIFY, 'No seed to back up');
  }
  if (!ID_RE.test(backupId ?? '')) throw new CloudError(CLOUD_ERROR.VERIFY, 'Invalid backup id');
  const createdAt = now().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const file = await sealBackupFile({
    password,
    plaintext: JSON.stringify({seed, channel: SEED_CHANNEL}),
    backupId,
    createdAt,
  });
  const name = backupFileName(backupId);
  try {
    await store.write(name, JSON.stringify(file));
  } catch (e) {
    throw storeError(e, CLOUD_ERROR.UNREACHABLE);
  }

  let text;
  try {
    text = await store.read(name);
  } catch (e) {
    throw storeError(e, CLOUD_ERROR.UNREACHABLE);
  }
  try {
    const opened = await openBackupFile(JSON.parse(text), password);
    if (opened.header.backupId !== backupId || opened.header.createdAt !== createdAt || readPayload(opened.plaintext) !== seed) {
      throw new Error('mismatch');
    }
  } catch (e) {
    throw new CloudError(CLOUD_ERROR.VERIFY, 'The saved backup did not read back');
  }
  // iCloud: the file must be uploaded, not only written on this phone.
  if (store.confirmUploaded) {
    try {
      await store.confirmUploaded(name);
    } catch (e) {
      throw storeError(e, CLOUD_ERROR.UNREACHABLE);
    }
  }
  return {backupId, createdAt};
}

const createdTime = header => {
  const t = Date.parse(header?.createdAt);
  return Number.isFinite(t) ? t : -Infinity;
};

// The newest backup in the store (v1: no list). Runs no KDF: it parses and bounds-checks each file
// and compares the header dates. Throws NO_BACKUP when the store has no backup file, DAMAGED (or
// the envelope error) when no file is a valid backup, UNREACHABLE when a read failed (also when
// another file read: the failed one can be the newest).
export async function findLatestCloudBackup(store) {
  let names;
  try {
    names = await store.list();
  } catch (e) {
    throw storeError(e, CLOUD_ERROR.UNREACHABLE);
  }
  const ids = [...new Set((names ?? []).map(backupIdFromName).filter(Boolean))];
  if (ids.length === 0) throw new CloudError(CLOUD_ERROR.NO_BACKUP, 'No backup in this store');
  if (ids.length > MAX_FILES_READ) throw new CloudError(CLOUD_ERROR.DAMAGED, 'Too many backup files');

  let best = null;
  let parseError = null;
  let readError = null;
  for (const id of ids) {
    let text;
    try {
      text = await store.read(backupFileName(id));
    } catch (e) {
      if (isCloudError(e, CLOUD_ERROR.CANCELLED)) throw e;
      if (!isCloudError(e, CLOUD_ERROR.NOT_FOUND)) readError = storeError(e, CLOUD_ERROR.UNREACHABLE);
      continue;
    }
    try {
      let file;
      try {
        file = JSON.parse(text);
      } catch (e) {
        throw damaged();
      }
      const {header} = parseBackupFile(file);
      if (!ID_RE.test(header.backupId ?? '')) throw damaged();
      if (!best || createdTime(header) > createdTime(best.header)) best = {file, header};
    } catch (e) {
      parseError = e;
    }
  }
  // A file that did not read can be the newest: never offer an older backup in its place.
  if (readError) throw readError;
  if (best) {
    return {file: best.file, backupId: best.header.backupId, createdAt: best.header.createdAt};
  }
  if (parseError) throw parseError;
  throw new CloudError(CLOUD_ERROR.NO_BACKUP, 'No backup in this store');
}

// Opens the backup with the backup password. Wrong password = the GCM tag check failed
// (VAULT_WRONG_PASSWORD). Any other failure is "damaged" or "update the app".
export async function openCloudBackup(found, password) {
  const {header, plaintext} = await openBackupFile(found.file, password);
  return {seed: readPayload(plaintext), backupId: header.backupId, createdAt: header.createdAt};
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "26 November 2026" (Paper Import iCloud 03), in the phone's time zone. No Intl: Hermes builds
// can lack locale data.
export const backupDateText = createdAt => {
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
