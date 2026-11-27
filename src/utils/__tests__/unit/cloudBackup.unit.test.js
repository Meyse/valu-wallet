// Cloud backup: store contract (fake store), save with read-back, restore of the newest backup,
// and the restore error mapping (plan C2 "Cloud").
import { Buffer } from 'buffer';
import { setKdfBackend } from '../../crypto/kdf';
import { VAULT_ERROR } from '../../crypto/vaultErrors';
import { createFakeStore } from '../../cloudBackup/stores/fakeStore';
import {
  backupDateText,
  backupFileName,
  backupIdFromName,
  findLatestCloudBackup,
  newBackupId,
  openCloudBackup,
  saveCloudBackup,
} from '../../cloudBackup/cloudBackup';
import { CloudError, CLOUD_ERROR, cloudErrorKind } from '../../cloudBackup/cloudErrors';
import { resolveCloudStore } from '../../cloudBackup/store';

// Real randomness: the global Jest setup returns zero bytes.
jest.mock('react-native-randombytes', () => ({
  randomBytes: (length, cb) => cb(null, require('crypto').randomBytes(length)),
}));

const nodeBackend = require('../../../tests/helpers/nodeKdfBackend');
const golden = require('../../../tests/helpers/vaultGolden.json');

// A test-only 24-word phrase (BIP39 test vector), not a wallet.
const SEED = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery staple';
const ID_A = '0123456789abcdef0123456789abcdef';
const ID_B = 'fedcba9876543210fedcba9876543210';

// react-native-fs subset in memory. failOn(op, n): the n-th call of op throws (an app kill).
function memoryFs() {
  const files = new Map();
  const dirs = new Set();
  const counts = {};
  let fail = null;
  const step = op => {
    counts[op] = (counts[op] ?? 0) + 1;
    if (fail && fail.op === op && fail.n === counts[op]) throw new Error('killed');
  };
  return {
    files,
    failOn: (op, n) => {
      fail = { op, n };
      Object.keys(counts).forEach(k => delete counts[k]);
    },
    clearFail: () => {
      fail = null;
    },
    exists: async p => files.has(p) || dirs.has(p),
    mkdir: async p => {
      step('mkdir');
      dirs.add(p);
    },
    readDir: async dir =>
      [...files.keys()]
        .filter(p => p.startsWith(`${dir}/`))
        .map(p => ({ name: p.slice(dir.length + 1), isFile: () => true })),
    readFile: async p => {
      if (!files.has(p)) throw new Error('ENOENT');
      return files.get(p);
    },
    writeFile: async (p, text) => {
      step('writeFile');
      files.set(p, text);
    },
    moveFile: async (from, to) => {
      step('moveFile');
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from));
      files.delete(from);
    },
    unlink: async p => {
      step('unlink');
      files.delete(p);
    },
  };
}

const newStore = (fs = memoryFs()) => ({ fs, store: createFakeStore({ fs, dir: '/cloud', kind: 'icloud' }) });

beforeAll(() => setKdfBackend(nodeBackend));
afterAll(() => setKdfBackend(null));

describe('fake store contract', () => {
  it('writes, lists, reads and replaces files', async () => {
    const { store } = newStore();
    expect(await store.list()).toEqual([]);
    await store.write('a.json', 'one');
    await store.write('b.json', 'two');
    expect((await store.list()).sort()).toEqual(['a.json', 'b.json']);
    expect(await store.read('a.json')).toBe('one');
    await store.write('a.json', 'three');
    expect(await store.read('a.json')).toBe('three');
    expect((await store.list()).sort()).toEqual(['a.json', 'b.json']);
  });

  it('says NOT_FOUND for a missing file', async () => {
    const { store } = newStore();
    await expect(store.read('none.json')).rejects.toMatchObject({ code: CLOUD_ERROR.NOT_FOUND });
  });

  it('keeps the old or the new file when a replace is killed at any step', async () => {
    for (const [op, n] of [['writeFile', 1], ['moveFile', 1], ['moveFile', 2], ['unlink', 1]]) {
      const { fs, store } = newStore();
      await store.write('a.json', 'old');
      fs.failOn(op, n);
      await store.write('a.json', 'new').catch(() => {});
      fs.clearFail();
      expect(await store.list()).toEqual(['a.json']);
      expect(['old', 'new']).toContain(await store.read('a.json'));
    }
  });

  it('turns a file system failure into UNREACHABLE', async () => {
    const { fs, store } = newStore();
    fs.failOn('writeFile', 1);
    await expect(store.write('a.json', 'x')).rejects.toMatchObject({ code: CLOUD_ERROR.UNREACHABLE });
  });
});

describe('save and restore', () => {
  it('round trips: save, read back, find the newest, open with the password', async () => {
    const { store, fs } = newStore();
    const saved = await saveCloudBackup({ store, seed: SEED, password: PASSWORD, backupId: ID_A });
    expect(saved.backupId).toBe(ID_A);
    const raw = fs.files.get(`/cloud/${backupFileName(ID_A)}`);
    // The file holds no plain seed word and no password.
    expect(raw).not.toContain('legal');
    expect(raw).not.toContain('horse');
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['ct', 'format', 'header']);

    const found = await findLatestCloudBackup(store);
    expect(found.backupId).toBe(ID_A);
    const opened = await openCloudBackup(found, PASSWORD);
    expect(opened).toEqual({ seed: SEED, backupId: ID_A, createdAt: saved.createdAt });
  });

  it('keeps the seed string exactly, also when it is not a BIP39 phrase', async () => {
    const { store } = newStore();
    const odd = '  Custom Text Seed  with  spaces ';
    await saveCloudBackup({ store, seed: odd, password: PASSWORD, backupId: ID_A });
    expect((await openCloudBackup(await findLatestCloudBackup(store), PASSWORD)).seed).toBe(odd);
  });

  it('opens the known-answer backup file of the vault branch from the store', async () => {
    const { store } = newStore();
    await store.write(backupFileName('00112233445566778899aabbccddeeff'), JSON.stringify(golden.backup));
    const found = await findLatestCloudBackup(store);
    expect(found.backupId).toBe('00112233445566778899aabbccddeeff');
    const opened = await openCloudBackup(found, golden.password);
    expect(opened.seed).toBe(JSON.parse(golden.backupPlaintext).seed);
  });

  it('picks the newest of two backups and replaces a file with the same id', async () => {
    const { store } = newStore();
    const t = iso => () => new Date(iso);
    await saveCloudBackup({ store, seed: 'first seed', password: PASSWORD, backupId: ID_A, now: t('2026-11-20T10:00:00Z') });
    await saveCloudBackup({ store, seed: 'second seed', password: PASSWORD, backupId: ID_B, now: t('2026-11-26T10:00:00Z') });
    let found = await findLatestCloudBackup(store);
    expect(found.backupId).toBe(ID_B);
    expect(found.createdAt).toBe('2026-11-26T10:00:00Z');
    // Re-save of A replaces A and makes it the newest.
    await saveCloudBackup({ store, seed: 'first seed', password: PASSWORD, backupId: ID_A, now: t('2026-11-27T10:00:00Z') });
    expect((await store.list()).length).toBe(2);
    found = await findLatestCloudBackup(store);
    expect((await openCloudBackup(found, PASSWORD)).seed).toBe('first seed');
  });

  it('fails the save when the file read back does not open to the same seed', async () => {
    const { store } = newStore();
    const lying = { ...store, read: async () => store.read(backupFileName(ID_B)) };
    await saveCloudBackup({ store, seed: 'other seed', password: PASSWORD, backupId: ID_B });
    await expect(saveCloudBackup({ store: lying, seed: SEED, password: PASSWORD, backupId: ID_A }))
      .rejects.toMatchObject({ code: CLOUD_ERROR.VERIFY });
    const truncating = { ...store, read: async name => (await store.read(name)).slice(0, -10) };
    await expect(saveCloudBackup({ store: truncating, seed: SEED, password: PASSWORD, backupId: ID_A }))
      .rejects.toMatchObject({ code: CLOUD_ERROR.VERIFY });
  });

  it('fails the save as UNREACHABLE when the store cannot write or read', async () => {
    const { store } = newStore();
    const noWrite = { ...store, write: async () => { throw new Error('offline'); } };
    await expect(saveCloudBackup({ store: noWrite, seed: SEED, password: PASSWORD, backupId: ID_A }))
      .rejects.toMatchObject({ code: CLOUD_ERROR.UNREACHABLE });
    const noRead = { ...store, read: async () => { throw new CloudError(CLOUD_ERROR.UNREACHABLE); } };
    await expect(saveCloudBackup({ store: noRead, seed: SEED, password: PASSWORD, backupId: ID_A }))
      .rejects.toMatchObject({ code: CLOUD_ERROR.UNREACHABLE });
  });

  it('refuses an empty seed and a malformed backup id before any write', async () => {
    const { store, fs } = newStore();
    await expect(saveCloudBackup({ store, seed: '', password: PASSWORD, backupId: ID_A })).rejects.toBeInstanceOf(CloudError);
    await expect(saveCloudBackup({ store, seed: SEED, password: PASSWORD, backupId: 'abc' })).rejects.toBeInstanceOf(CloudError);
    expect(fs.files.size).toBe(0);
  });

  it('makes a new 16-byte hex backup id each time', async () => {
    const a = await newBackupId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await newBackupId()).not.toBe(a);
  });
});

describe('restore error mapping', () => {
  const saved = async () => {
    const { store, fs } = newStore();
    await saveCloudBackup({ store, seed: SEED, password: PASSWORD, backupId: ID_A });
    return { store, fs, path: `/cloud/${backupFileName(ID_A)}` };
  };

  it('a failed tag check is a wrong password, and the error holds no seed', async () => {
    const { store } = await saved();
    const found = await findLatestCloudBackup(store);
    const error = await openCloudBackup(found, 'correct horse battery stapl').catch(e => e);
    expect(error.code).toBe(VAULT_ERROR.WRONG_PASSWORD);
    expect(cloudErrorKind(error)).toBe('wrong-password');
    expect(`${error.message} ${error.stack}`).not.toContain('legal');
  });

  it('an edited header fails the tag check; a cut file or an out-of-bounds KDF is damaged', async () => {
    const { store, fs, path } = await saved();
    const file = JSON.parse(fs.files.get(path));
    const header = JSON.parse(Buffer.from(file.header.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

    // Header edit inside bounds: the tag check fails. It cannot be told from a wrong password,
    // so it shows as one (plan B4).
    const edited = { ...header, createdAt: '2020-01-01T00:00:00Z' };
    const enc = h => Buffer.from(JSON.stringify(h)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    fs.files.set(path, JSON.stringify({ ...file, header: enc(edited) }));
    const tampered = await openCloudBackup(await findLatestCloudBackup(store), PASSWORD).catch(e => e);
    expect(cloudErrorKind(tampered)).toBe('wrong-password');

    // Out of bounds: rejected by the parse, so the file does not count as a backup.
    fs.files.set(path, JSON.stringify({ ...file, header: enc({ ...header, kdf: { ...header.kdf, m: 4 * 1024 * 1024 } }) }));
    expect(cloudErrorKind(await findLatestCloudBackup(store).catch(e => e))).toBe('damaged');

    fs.files.set(path, fs.files.get(path).slice(0, 40));
    expect(cloudErrorKind(await findLatestCloudBackup(store).catch(e => e))).toBe('damaged');

    fs.files.set(path, JSON.stringify({ ...file, header: enc({ ...header, v: 99 }) }));
    expect(cloudErrorKind(await findLatestCloudBackup(store).catch(e => e))).toBe('update-app');
  });

  it('a valid file next to a damaged one is still found', async () => {
    const { store, fs } = await saved();
    fs.files.set(`/cloud/${backupFileName(ID_B)}`, '{"format":"valu-wallet-backup"');
    expect((await findLatestCloudBackup(store)).backupId).toBe(ID_A);
  });

  it('no backup file is "no-backup", other files are ignored', async () => {
    const { store, fs } = newStore();
    expect(cloudErrorKind(await findLatestCloudBackup(store).catch(e => e))).toBe('no-backup');
    fs.files.set('/cloud/notes.txt', 'hello');
    fs.files.set('/cloud/valu-backup-xyz.json', '{}');
    expect(cloudErrorKind(await findLatestCloudBackup(store).catch(e => e))).toBe('no-backup');
  });

  it('a store that cannot list or read is "unreachable"; off and cancel map to their states', async () => {
    const listFails = { list: async () => { throw new Error('offline'); } };
    expect(cloudErrorKind(await findLatestCloudBackup(listFails).catch(e => e))).toBe('unreachable');
    const readFails = { list: async () => [backupFileName(ID_A)], read: async () => { throw new CloudError(CLOUD_ERROR.UNREACHABLE); } };
    expect(cloudErrorKind(await findLatestCloudBackup(readFails).catch(e => e))).toBe('unreachable');
    expect(cloudErrorKind(new CloudError(CLOUD_ERROR.OFF))).toBe('off');
    expect(cloudErrorKind(new CloudError(CLOUD_ERROR.CANCELLED))).toBe('cancelled');
  });

  it('a decrypted payload that is not a seed record is damaged', async () => {
    const { sealBackupFile } = require('../../crypto/envelope');
    for (const plaintext of ['not json', '{"seed":"","channel":"electrum"}', '{"seed":"x","channel":"dlight_private"}']) {
      const { store } = newStore();
      const file = await sealBackupFile({ password: PASSWORD, plaintext, backupId: ID_A, createdAt: '2026-11-26T12:00:00Z' });
      await store.write(backupFileName(ID_A), JSON.stringify(file));
      const error = await openCloudBackup(await findLatestCloudBackup(store), PASSWORD).catch(e => e);
      expect(cloudErrorKind(error)).toBe('damaged');
    }
  });
});

describe('which sheets the app shows', () => {
  const store = availability => ({ isAvailable: async () => availability });
  it('flag off, or debug "off": the sheets without cloud', async () => {
    expect((await resolveCloudStore({ enabled: false, realStore: () => store({ ok: true }) })).mode).toBe('none');
    expect((await resolveCloudStore({ dev: true, readDebug: async () => 'off', realStore: () => store({ ok: true }) })).mode).toBe('none');
  });
  it('a store that is not set up: without cloud; iCloud off: the cloud tile with the off state', async () => {
    expect((await resolveCloudStore({ dev: false, realStore: () => store({ ok: false, reason: 'unsupported' }) })).mode).toBe('none');
    expect((await resolveCloudStore({ dev: false, realStore: () => store({ ok: false, reason: 'off' }) })).mode).toBe('off');
    expect((await resolveCloudStore({ dev: false, realStore: () => ({ isAvailable: async () => { throw new Error('x'); } }) })).mode).toBe('none');
  });
  it('the fake store is used only in debug builds', async () => {
    const fake = store({ ok: true });
    const real = store({ ok: false, reason: 'unsupported' });
    expect((await resolveCloudStore({ dev: true, readDebug: async () => 'fake', fakeStore: () => fake, realStore: () => real })).store).toBe(fake);
    expect((await resolveCloudStore({ dev: false, readDebug: async () => 'fake', fakeStore: () => fake, realStore: () => real })).mode).toBe('none');
  });
});

describe('names and dates', () => {
  it('reads the backup id only from a well-formed file name', () => {
    expect(backupIdFromName(backupFileName(ID_A))).toBe(ID_A);
    expect(backupIdFromName('valu-backup-ABC.json')).toBeNull();
    expect(backupIdFromName(`${backupFileName(ID_A)}.tmp`)).toBeNull();
  });
  it('writes the date as Paper does', () => {
    expect(backupDateText('2026-11-26T12:00:00Z')).toBe('26 November 2026');
    expect(backupDateText('nonsense')).toBeNull();
  });
});
