import { Buffer } from 'buffer';
import {
  createVault,
  decryptRecord,
  encryptRecord,
  gcmDecrypt,
  gcmEncrypt,
  isV2Record,
  openBackupFile,
  parseBackupFile,
  sealBackupFile,
  unwrapVaultKey,
  validateVault,
  wrapVaultKey,
} from '../../crypto/envelope';
import { setKdfBackend } from '../../crypto/kdf';
import { KDF_KNOWN_ANSWERS } from '../../crypto/kdfKnownAnswers';
import { VAULT_ERROR } from '../../crypto/vaultErrors';

// Real randomness: the global Jest setup returns zero bytes.
jest.mock('react-native-randombytes', () => ({
  randomBytes: (length, cb) => cb(null, require('crypto').randomBytes(length)),
}));

const nodeBackend = require('../../../tests/helpers/nodeKdfBackend');
const golden = require('../../../tests/helpers/vaultGolden.json');

const flipBase64Byte = (b64, index) => {
  const buf = Buffer.from(b64, 'base64');
  buf[index < 0 ? buf.length + index : index] ^= 0x01;
  return buf.toString('base64');
};

let kdfCalls = 0;
const countingBackend = {
  argon2id: args => { kdfCalls += 1; return nodeBackend.argon2id(args); },
  pbkdf2Sha256: args => { kdfCalls += 1; return nodeBackend.pbkdf2Sha256(args); },
};

beforeAll(() => setKdfBackend(countingBackend));
afterAll(() => setKdfBackend(null));
beforeEach(() => { kdfCalls = 0; });

describe('AES-256-GCM', () => {
  const v = KDF_KNOWN_ANSWERS.aes256gcm[0];
  const h = x => Buffer.from(x, 'hex');

  it('matches the NIST CAVP vector', () => {
    const out = gcmEncrypt(h(v.key), h(v.iv), h(v.pt), h(v.aad));
    expect(out.toString('hex')).toBe(v.ct + v.tag);
    expect(gcmDecrypt(h(v.key), h(v.iv), out, h(v.aad)).toString('hex')).toBe(v.pt);
  });

  it('returns null for a changed tag, ciphertext or associated data', () => {
    const good = h(v.ct + v.tag);
    const badTag = Buffer.from(good); badTag[badTag.length - 1] ^= 1;
    const badCt = Buffer.from(good); badCt[0] ^= 1;
    const badAad = h(v.aad); badAad[0] ^= 1;
    expect(gcmDecrypt(h(v.key), h(v.iv), badTag, h(v.aad))).toBeNull();
    expect(gcmDecrypt(h(v.key), h(v.iv), badCt, h(v.aad))).toBeNull();
    expect(gcmDecrypt(h(v.key), h(v.iv), good, badAad)).toBeNull();
  });
});

describe('vault golden file', () => {
  // Built by scripts/make-vault-golden.js with Node crypto only.
  it('opens a vault written to the documented format', async () => {
    const dek = await unwrapVaultKey(golden.password, golden.accountHash, golden.vault);
    expect(dek.toString('hex')).toBe(golden.dekHex);
    expect(decryptRecord(dek, golden.record)).toBe(golden.recordPlaintext);
  }, 30000);

  it('opens a backup file written to the documented format', async () => {
    const { header, plaintext } = await openBackupFile(golden.backup, golden.password);
    expect(plaintext).toBe(golden.backupPlaintext);
    expect(header.backupId).toBe('00112233445566778899aabbccddeeff');
  }, 30000);
});

describe('vault key wrap', () => {
  it('rejects the wrong password', async () => {
    await expect(unwrapVaultKey('golden test passworD', golden.accountHash, golden.vault))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it('is bound to the account hash and to every KDF field', async () => {
    await expect(unwrapVaultKey(golden.password, 'otheraccount', golden.vault))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
    const changedT = { ...golden.vault, kdf: { ...golden.vault.kdf, t: 2 } };
    await expect(unwrapVaultKey(golden.password, golden.accountHash, changedT))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it.each([
    ['nonce byte', v => ({ ...v, wrap: { ...v.wrap, nonce: flipBase64Byte(v.wrap.nonce, 0) } })],
    ['ciphertext byte', v => ({ ...v, wrap: { ...v.wrap, ct: flipBase64Byte(v.wrap.ct, 0) } })],
    ['tag byte', v => ({ ...v, wrap: { ...v.wrap, ct: flipBase64Byte(v.wrap.ct, -1) } })],
    ['salt byte', v => ({ ...v, kdf: { ...v.kdf, salt: flipBase64Byte(v.kdf.salt, 0) } })],
  ])('fails when one %s changes', async (_label, tamper) => {
    await expect(unwrapVaultKey(golden.password, golden.accountHash, tamper(golden.vault)))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it.each([
    ['unknown version', v => ({ ...v, v: 3 }), VAULT_ERROR.UNSUPPORTED],
    ['unknown KDF id', v => ({ ...v, kdf: { ...v.kdf, id: 'argon2x' } }), VAULT_ERROR.UNSUPPORTED],
    ['memory out of bounds', v => ({ ...v, kdf: { ...v.kdf, m: 1 << 22 } }), VAULT_ERROR.PARAMS],
    ['passes out of bounds', v => ({ ...v, kdf: { ...v.kdf, t: 1000 } }), VAULT_ERROR.PARAMS],
    ['unknown wrap cipher', v => ({ ...v, wrap: { ...v.wrap, id: 'aes-128-gcm' } }), VAULT_ERROR.UNSUPPORTED],
    ['short wrap', v => ({ ...v, wrap: { ...v.wrap, ct: Buffer.alloc(47).toString('base64') } }), VAULT_ERROR.FORMAT],
    ['missing block', () => null, VAULT_ERROR.FORMAT],
  ])('rejects a vault with %s before the KDF runs', async (_label, change, code) => {
    const bad = change(golden.vault);
    await expect(unwrapVaultKey(golden.password, golden.accountHash, bad)).rejects.toMatchObject({ code });
    expect(() => validateVault(bad)).toThrow();
    expect(kdfCalls).toBe(0);
  });

  it('re-wraps the same DEK under a new password with a new salt', async () => {
    const { vault, dek } = await createVault('first password', 'acct1');
    expect(vault.kdf).toMatchObject({ id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1 });
    const rewrapped = await wrapVaultKey(dek, 'second password', 'acct1');
    expect(rewrapped.kdf.salt).not.toBe(vault.kdf.salt);
    expect(rewrapped.wrap.nonce).not.toBe(vault.wrap.nonce);
    expect((await unwrapVaultKey('second password', 'acct1', rewrapped)).equals(dek)).toBe(true);
    await expect(unwrapVaultKey('first password', 'acct1', rewrapped))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it('can use the PBKDF2 adapter for a vault', async () => {
    const { vault, dek } = await createVault('pw', 'acct2', 'pbkdf2-sha256');
    expect(vault.kdf).toMatchObject({ id: 'pbkdf2-sha256', iter: 600000 });
    expect((await unwrapVaultKey('pw', 'acct2', vault)).equals(dek)).toBe(true);
  }, 30000);
});

describe('vault records', () => {
  const dek = Buffer.from(golden.dekHex, 'hex');

  it('round-trips text with a fresh nonce for each record', async () => {
    const text = 'zoo wrong ✓ émoji 🔑 ' + 'x'.repeat(5000);
    const a = await encryptRecord(dek, text);
    const b = await encryptRecord(dek, text);
    expect(isV2Record(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(decryptRecord(dek, a)).toBe(text);
  });

  it('never treats a legacy base64 record as v2', () => {
    // Legacy records are plain base64, which has no ".".
    expect(isV2Record(Buffer.alloc(48, 7).toString('base64'))).toBe(false);
    expect(isV2Record(null)).toBe(false);
  });

  it('fails on a changed byte or another key', async () => {
    const rec = await encryptRecord(dek, 'secret seed words');
    const body = rec.slice(3);
    expect(() => decryptRecord(dek, 'v2.' + flipBase64Byte(body, 20)))
      .toThrow(expect.objectContaining({ code: VAULT_ERROR.RECORD_AUTH }));
    expect(() => decryptRecord(Buffer.alloc(32, 9), rec))
      .toThrow(expect.objectContaining({ code: VAULT_ERROR.RECORD_AUTH }));
    expect(() => decryptRecord(dek, 'v2.###'))
      .toThrow(expect.objectContaining({ code: VAULT_ERROR.FORMAT }));
  });
});

describe('cloud backup file', () => {
  const sealed = () => sealBackupFile({
    password: 'backup pass', plaintext: '{"seed":"s","channel":"electrum"}',
    backupId: 'ffeeddccbbaa99887766554433221100', createdAt: '2026-11-26T12:00:00Z',
  });

  it('round-trips and keeps no secret in the header', async () => {
    const file = await sealed();
    const { header } = parseBackupFile(file);
    expect(Object.keys(header).sort()).toEqual(['backupId', 'cipher', 'createdAt', 'kdf', 'v']);
    expect((await openBackupFile(file, 'backup pass')).plaintext).toBe('{"seed":"s","channel":"electrum"}');
    await expect(openBackupFile(file, 'backup pasS')).rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it('refuses to write a file that the reader would reject', async () => {
    await expect(sealBackupFile({
      password: 'backup pass', plaintext: 'x'.repeat(64 * 1024),
      backupId: 'ffeeddccbbaa99887766554433221100', createdAt: '2026-11-26T12:00:00Z',
    })).rejects.toMatchObject({ code: VAULT_ERROR.FORMAT });
    expect(kdfCalls).toBe(0);
  });

  it('fails the tag check when one header byte changes', async () => {
    const file = await sealed();
    const headerJson = Buffer.from(file.header.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const edited = headerJson.replace('2026-11-26', '2026-11-27');
    const header = Buffer.from(edited).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await expect(openBackupFile({ ...file, header }, 'backup pass'))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
  }, 30000);

  it('rejects damaged files and out-of-bound parameters before the KDF runs', async () => {
    const file = await sealed();
    kdfCalls = 0;
    const headerOf = obj => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { header } = parseBackupFile(file);
    const cases = [
      [{ ...file, format: 'other' }, VAULT_ERROR.FORMAT],
      [{ ...file, header: 'not*base64url' }, VAULT_ERROR.FORMAT],
      [{ ...file, header: headerOf({ ...header, v: 2 }) }, VAULT_ERROR.UNSUPPORTED],
      [{ ...file, header: headerOf({ ...header, kdf: { ...header.kdf, m: 1 << 30 } }) }, VAULT_ERROR.PARAMS],
      [{ ...file, header: headerOf({ ...header, kdf: { id: 'pbkdf2-sha256', iter: 10, salt: header.kdf.salt } }) }, VAULT_ERROR.PARAMS],
      [{ ...file, ct: 'AAAA' }, VAULT_ERROR.FORMAT],
      [{ ...file, ct: 'A'.repeat(100000) }, VAULT_ERROR.FORMAT],
      [{ ...file, header: 'A'.repeat(6000) }, VAULT_ERROR.FORMAT],
    ];
    for (const [bad, code] of cases) {
      await expect(openBackupFile(bad, 'backup pass')).rejects.toMatchObject({ code });
    }
    expect(kdfCalls).toBe(0);
  }, 30000);
});
