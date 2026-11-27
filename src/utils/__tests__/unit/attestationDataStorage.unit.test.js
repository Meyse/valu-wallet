// The attestation file holds every profile's attestations. A replace must
// never leave the reader without a copy: after a failure or an app kill at
// any file operation, the reader returns the old data or the new data.
const mockFiles = new Map();
let mockFailAt = null; // (index, op) => 'throw' | 'kill' | null
let mockOpIndex = 0;
let mockKilled = false;

const mockFsOp = (op, run) => async (...args) => {
  if (mockKilled) throw new Error('process killed');
  const index = mockOpIndex++;
  const fault = mockFailAt ? mockFailAt(index, op) : null;
  if (fault === 'kill') {
    mockKilled = true;
    throw new Error('process killed');
  }
  if (fault === 'throw') throw new Error(`Injected ${op} failure`);
  return run(...args);
};

// Real randomness: the global Jest setup returns zero bytes synchronously.
jest.mock('react-native-randombytes', () => ({
  randomBytes: (length, cb) => cb(null, require('crypto').randomBytes(length)),
}));

const mockEnoent = path => Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  writeFile: mockFsOp('writeFile', async (path, data) => { mockFiles.set(path, data); }),
  readFile: async path => {
    if (!mockFiles.has(path)) throw mockEnoent(path);
    return mockFiles.get(path);
  },
  exists: async path => mockFiles.has(path),
  unlink: mockFsOp('unlink', async path => {
    if (!mockFiles.has(path)) throw mockEnoent(path);
    mockFiles.delete(path);
  }),
  moveFile: mockFsOp('moveFile', async (from, to) => {
    if (!mockFiles.has(from)) throw mockEnoent(from);
    if (mockFiles.has(to)) throw new Error('destination exists'); // iOS behaviour
    mockFiles.set(to, mockFiles.get(from));
    mockFiles.delete(from);
  }),
}));

const {
  loadAttestationData,
  storeAttestationData,
  storeAttestationDataForUser,
} = require('../../nativeStore/attestationDataStorage');
const { convertLegacyAttestationRecords } = require('../../vault/attestationVaultMigration');
const { encryptRecord } = require('../../crypto/envelope');
const { encryptkey } = require('../../seedCrypt');

const OLD = { a: { record: 'old a' }, b: { record: 'old b' } };
const NEW = { a: { record: 'new a' }, b: { record: 'old b' } };

const reset = async () => {
  mockFiles.clear();
  mockFailAt = null;
  mockKilled = false;
  await storeAttestationData(OLD);
  mockOpIndex = 0;
};

const restart = () => {
  mockFailAt = null;
  mockKilled = false;
};

describe('attestation file replace', () => {
  beforeEach(reset);

  it('writes and reads back', async () => {
    await storeAttestationData(NEW);
    expect(await loadAttestationData()).toEqual(NEW);
    // Only the live file remains: no temp file, no backup.
    expect([...mockFiles.keys()].filter(p => !p.endsWith('.txt'))).toEqual([]);
  });

  // Count the file operations of one replace (writeFile, moves, unlinks).
  const opsPerReplace = async () => {
    await storeAttestationData(NEW);
    const count = mockOpIndex;
    await reset();
    return count;
  };

  it('keeps a readable copy after an exception at each operation', async () => {
    const count = await opsPerReplace();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let failAt = 0; failAt < count; failAt += 1) {
      await reset();
      mockFailAt = index => (index === failAt ? 'throw' : null);
      await storeAttestationData(NEW).catch(() => {});
      restart();
      const read = await loadAttestationData();
      expect([OLD, NEW]).toContainEqual(read);
      // The next write still works and reads back.
      await storeAttestationData(NEW);
      expect(await loadAttestationData()).toEqual(NEW);
    }
  });

  it('keeps a readable copy after an app kill at each operation', async () => {
    const count = await opsPerReplace();
    for (let killAt = 0; killAt < count; killAt += 1) {
      await reset();
      mockFailAt = index => (index === killAt ? 'kill' : null);
      await storeAttestationData(NEW).catch(() => {});
      restart();
      const read = await loadAttestationData();
      expect([OLD, NEW]).toContainEqual(read);
      await storeAttestationData(NEW);
      expect(await loadAttestationData()).toEqual(NEW);
    }
  });
});

// Vault v2 moves legacy attestation records to the vault key. The legacy
// copy must not survive in a stale backup, and the conversion must not undo
// a write that lands while it runs.
describe('attestation conversion to the vault key', () => {
  const HASH = 'fixture-account';
  const PW = 'fixture password';
  const DEK = Buffer.alloc(32, 7);
  const ATTEST = JSON.stringify({ claim: 'fixture attestation' });
  const livePath = () => [...mockFiles.keys()].find(p => p.endsWith('.txt'));
  const backupPath = () => `${livePath()}.bak`;

  beforeEach(() => {
    mockFiles.clear();
    mockFailAt = null;
    mockKilled = false;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('removes a stale backup that holds the legacy record', async () => {
    // State after a kill between "temp to live" and "remove backup".
    const live = { [HASH]: { attestations: await encryptRecord(DEK, ATTEST) } };
    await storeAttestationData(live);
    mockFiles.set(backupPath(), JSON.stringify({ [HASH]: { attestations: await encryptkey(PW, ATTEST) } }));

    await convertLegacyAttestationRecords(HASH, PW, DEK);

    expect(mockFiles.has(backupPath())).toBe(false);
    expect(await loadAttestationData()).toEqual(live);
  });

  it('keeps the backup when the live file does not read', async () => {
    await storeAttestationData({});
    const backup = JSON.stringify({ [HASH]: { attestations: await encryptkey(PW, ATTEST) } });
    mockFiles.set(livePath(), 'not json');
    mockFiles.set(backupPath(), backup);

    await convertLegacyAttestationRecords(HASH, PW, DEK);

    expect(mockFiles.get(backupPath())).toBe(backup);
  });

  it('keeps a newer write that lands while the conversion runs', async () => {
    const legacy = await encryptkey(PW, ATTEST);
    await storeAttestationData({ [HASH]: { attestations: legacy } });

    const converting = convertLegacyAttestationRecords(HASH, PW, DEK);
    await storeAttestationDataForUser({ attestations: legacy, newer: 'newer value' }, HASH);
    await converting;

    expect((await loadAttestationData())[HASH].newer).toBe('newer value');
  });
});
