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
} = require('../../nativeStore/attestationDataStorage');

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
