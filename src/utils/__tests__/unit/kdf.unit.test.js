// Known-answer and bounds tests for the KDF registry. Expected values are
// copied from the sources named on each test; none are computed by app code.
import { Buffer } from 'buffer';
import {
  createKdfParams,
  deriveKey,
  kdfAadFields,
  setKdfBackend,
  validateKdfParams,
  DEFAULT_KDF_ID,
} from '../../crypto/kdf';
import { VAULT_ERROR } from '../../crypto/vaultErrors';

const nodeBackend = require('../../../tests/helpers/nodeKdfBackend');

const hex = h => Buffer.from(h, 'hex');
const SALT16_B64 = Buffer.alloc(16, 0x5a).toString('base64');

describe('KDF backend known answers', () => {
  // The backend is the boundary to native code. The same vectors run on the
  // device through src/utils/crypto/kdfSelfTest.js.
  const { KDF_KNOWN_ANSWERS } = require('../../crypto/kdfKnownAnswers');

  it.each(KDF_KNOWN_ANSWERS.argon2id.map(v => [v.name, v]))('argon2id: %s', async (_name, v) => {
    const out = await nodeBackend.argon2id({
      password: hex(v.password),
      salt: hex(v.salt),
      memoryKiB: v.m,
      passes: v.t,
      parallelism: v.p,
      outputBytes: v.expected.length / 2,
      secret: v.secret ? hex(v.secret) : undefined,
      associatedData: v.ad ? hex(v.ad) : undefined,
    });
    expect(out.toString('hex')).toBe(v.expected);
  }, 30000);

  it.each(KDF_KNOWN_ANSWERS.pbkdf2Sha256.map(v => [v.name, v]))('pbkdf2-sha256: %s', async (_name, v) => {
    const out = await nodeBackend.pbkdf2Sha256({
      password: Buffer.from(v.password, 'utf8'),
      salt: Buffer.from(v.salt, 'utf8'),
      iterations: v.c,
      outputBytes: v.expected.length / 2,
    });
    expect(out.toString('hex')).toBe(v.expected);
  });
});

describe('KDF registry', () => {
  let calls;
  const spyBackend = {
    argon2id: jest.fn(async args => {
      calls.push(['argon2id', args]);
      return Buffer.alloc(32, 1);
    }),
    pbkdf2Sha256: jest.fn(async args => {
      calls.push(['pbkdf2Sha256', args]);
      return Buffer.alloc(32, 2);
    }),
  };

  beforeEach(() => {
    calls = [];
    setKdfBackend(spyBackend);
  });
  afterAll(() => setKdfBackend(null));

  it('creates new data with Argon2id m=64 MiB, t=3, p=1 and a 16-byte salt', () => {
    expect(DEFAULT_KDF_ID).toBe('argon2id');
    expect(createKdfParams(Buffer.alloc(16, 0x5a))).toEqual({
      id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: SALT16_B64,
    });
    expect(createKdfParams(Buffer.alloc(16, 0x5a), 'pbkdf2-sha256')).toEqual({
      id: 'pbkdf2-sha256', iter: 600000, salt: SALT16_B64,
    });
  });

  it('passes the stored parameters and the UTF-8 password bytes to the backend', async () => {
    const kdf = { id: 'argon2id', ver: 19, m: 47104, t: 1, p: 1, salt: SALT16_B64 };
    await deriveKey('pässwörd 1', kdf);
    expect(calls).toHaveLength(1);
    const [name, args] = calls[0];
    expect(name).toBe('argon2id');
    expect(args.memoryKiB).toBe(47104);
    expect(args.passes).toBe(1);
    expect(args.parallelism).toBe(1);
    expect(args.outputBytes).toBe(32);
    expect(args.salt.equals(Buffer.alloc(16, 0x5a))).toBe(true);

    await deriveKey('pw', { id: 'pbkdf2-sha256', iter: 100000, salt: SALT16_B64 });
    expect(calls[1][0]).toBe('pbkdf2Sha256');
    expect(calls[1][1].iterations).toBe(100000);
  });

  const rejectsBeforeKdf = async (kdf, code) => {
    await expect(deriveKey('pw', kdf)).rejects.toMatchObject({ code });
    expect(() => validateKdfParams(kdf)).toThrow();
    expect(calls).toHaveLength(0);
  };

  it('rejects an unknown KDF id with an "update the app" error before any work', async () => {
    await rejectsBeforeKdf({ id: 'scrypt', N: 1 << 20, salt: SALT16_B64 }, VAULT_ERROR.UNSUPPORTED);
    await rejectsBeforeKdf({ id: '__proto__', salt: SALT16_B64 }, VAULT_ERROR.UNSUPPORTED);
    await rejectsBeforeKdf({ id: 'argon2id', ver: 16, m: 65536, t: 3, p: 1, salt: SALT16_B64 }, VAULT_ERROR.UNSUPPORTED);
  });

  it.each([
    ['m below 8 MiB', { m: 8191 }],
    ['m above 256 MiB', { m: 262145 }],
    ['m = 4 GiB (a memory DoS)', { m: 4 * 1024 * 1024 }],
    ['t = 0', { t: 0 }],
    ['t above 10', { t: 11 }],
    ['p = 0', { p: 0 }],
    ['p above 4', { p: 5 }],
    ['m not an integer', { m: 65536.5 }],
    ['t as a string', { t: '3' }],
    ['salt of 15 bytes', { salt: Buffer.alloc(15).toString('base64') }],
    ['salt of 65 bytes', { salt: Buffer.alloc(65).toString('base64') }],
  ])('rejects Argon2id with %s before any work', async (_label, change) => {
    const kdf = { id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: SALT16_B64, ...change };
    await rejectsBeforeKdf(kdf, VAULT_ERROR.PARAMS);
  });

  it('accepts the bound values themselves', () => {
    for (const change of [{ m: 8192 }, { m: 262144 }, { t: 1 }, { t: 10 }, { p: 4 }]) {
      expect(() => validateKdfParams({ id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: SALT16_B64, ...change })).not.toThrow();
    }
    expect(() => validateKdfParams({ id: 'pbkdf2-sha256', iter: 100000, salt: SALT16_B64 })).not.toThrow();
    expect(() => validateKdfParams({ id: 'pbkdf2-sha256', iter: 2000000, salt: SALT16_B64 })).not.toThrow();
  });

  it.each([[99999], [2000001], [1]])('rejects PBKDF2 with %d iterations before any work', async iter => {
    await rejectsBeforeKdf({ id: 'pbkdf2-sha256', iter, salt: SALT16_B64 }, VAULT_ERROR.PARAMS);
  });

  it('rejects extra or missing fields and a malformed salt before any work', async () => {
    await rejectsBeforeKdf({ id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: SALT16_B64, extra: 1 }, VAULT_ERROR.FORMAT);
    await rejectsBeforeKdf({ id: 'argon2id', ver: 19, m: 65536, t: 3, salt: SALT16_B64 }, VAULT_ERROR.FORMAT);
    await rejectsBeforeKdf({ id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: 'not base64!' }, VAULT_ERROR.FORMAT);
  });

  it('puts every KDF field into the associated data in a fixed order', () => {
    expect(kdfAadFields({ salt: SALT16_B64, p: 1, t: 3, m: 65536, ver: 19, id: 'argon2id' }))
      .toEqual(['argon2id', '19', '65536', '3', '1', SALT16_B64]);
    expect(kdfAadFields({ salt: SALT16_B64, iter: 600000, id: 'pbkdf2-sha256' }))
      .toEqual(['pbkdf2-sha256', '600000', SALT16_B64]);
  });

  it('rejects an empty password', async () => {
    await expect(deriveKey('', { id: 'pbkdf2-sha256', iter: 100000, salt: SALT16_B64 }))
      .rejects.toMatchObject({ code: VAULT_ERROR.FORMAT });
  });
});

describe('KDF with the real backend', () => {
  beforeAll(() => setKdfBackend(nodeBackend));
  afterAll(() => setKdfBackend(null));

  // The phc-winner-argon2 test.c vector "password"/"somesalt" has an 8-byte
  // salt, which our 16-byte minimum rejects. So this checks the mapping with
  // a 16-byte salt against the backend KAT path instead: the same inputs must
  // give the same key through deriveKey and through the backend directly.
  it('derives the same key as the backend for the same stored parameters', async () => {
    const kdf = { id: 'argon2id', ver: 19, m: 8192, t: 1, p: 1, salt: SALT16_B64 };
    const viaRegistry = await deriveKey('password', kdf);
    const direct = await nodeBackend.argon2id({
      password: Buffer.from('password'), salt: Buffer.alloc(16, 0x5a), memoryKiB: 8192, passes: 1, parallelism: 1, outputBytes: 32,
    });
    expect(viaRegistry.equals(direct)).toBe(true);
    const otherPassword = await deriveKey('passwore', kdf);
    expect(otherPassword.equals(viaRegistry)).toBe(false);
  });
});

describe('on-device self-test module', () => {
  const { runKdfSelfTest } = require('../../crypto/kdfSelfTest');

  // kdfNative maps the backend arguments onto react-native-quick-crypto,
  // which Jest replaces with Node crypto at that boundary.
  it('passes every vector through the native adapter', async () => {
    const report = await runKdfSelfTest();
    expect(report.results.filter(r => !r.ok)).toEqual([]);
    expect(report).toMatchObject({ ok: true, total: 8 });
  }, 60000);

  it('reports a failure when the backend output is wrong', async () => {
    const wrong = {
      argon2id: async args => Buffer.alloc(args.outputBytes, 1),
      pbkdf2Sha256: nodeBackend.pbkdf2Sha256,
    };
    const report = await runKdfSelfTest(wrong);
    expect(report.ok).toBe(false);
    expect(report.results.filter(r => r.name.startsWith('argon2id')).every(r => !r.ok)).toBe(true);
  }, 60000);
});
