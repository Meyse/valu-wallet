// Runs the published known-answer vectors (kdfKnownAnswers.js) through the
// native KDF backend and the app's AES-256-GCM, and one vault round trip with
// the production parameters. Debug builds run it at start (index.js) and log
// one "VAULT_KAT" line, so a device check reads the result from the Metro log.
// The vectors are public test data; the log holds no wallet data.
import { Buffer } from 'buffer';
import { KDF_KNOWN_ANSWERS } from './kdfKnownAnswers';
import { gcmDecrypt, gcmEncrypt, createVault, unwrapVaultKey } from './envelope';

const hex = value => Buffer.from(value, 'hex');

const runCase = async (name, fn) => {
  const started = Date.now();
  try {
    const ok = await fn();
    return { name, ok: ok === true, ms: Date.now() - started };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - started, error: error?.code || error?.name || 'error' };
  }
};

export const runKdfSelfTest = async (backend = require('./kdfNative').default) => {
  const results = [];

  for (const v of KDF_KNOWN_ANSWERS.argon2id) {
    results.push(await runCase(`argon2id ${v.name}`, async () => {
      const out = await backend.argon2id({
        password: hex(v.password),
        salt: hex(v.salt),
        memoryKiB: v.m,
        passes: v.t,
        parallelism: v.p,
        outputBytes: v.expected.length / 2,
        secret: v.secret ? hex(v.secret) : undefined,
        associatedData: v.ad ? hex(v.ad) : undefined,
      });
      return out.toString('hex') === v.expected;
    }));
  }

  for (const v of KDF_KNOWN_ANSWERS.pbkdf2Sha256) {
    results.push(await runCase(`pbkdf2-sha256 ${v.name}`, async () => {
      const out = await backend.pbkdf2Sha256({
        password: Buffer.from(v.password, 'utf8'),
        salt: Buffer.from(v.salt, 'utf8'),
        iterations: v.c,
        outputBytes: v.expected.length / 2,
      });
      return out.toString('hex') === v.expected;
    }));
  }

  for (const v of KDF_KNOWN_ANSWERS.aes256gcm) {
    results.push(await runCase(`aes-256-gcm ${v.name}`, async () => {
      const out = gcmEncrypt(hex(v.key), hex(v.iv), hex(v.pt), hex(v.aad));
      const back = gcmDecrypt(hex(v.key), hex(v.iv), out, hex(v.aad));
      return out.toString('hex') === v.ct + v.tag && back != null && back.toString('hex') === v.pt;
    }));
  }

  // Production parameters end to end: create, unwrap, reject a wrong password.
  results.push(await runCase('vault v2 round trip (argon2id m=64 MiB, t=3, p=1)', async () => {
    const { vault, dek } = await createVault('self-test password', 'self-test-account');
    const back = await unwrapVaultKey('self-test password', 'self-test-account', vault);
    let wrongRejected = false;
    try {
      await unwrapVaultKey('self-test passworD', 'self-test-account', vault);
    } catch (error) {
      wrongRejected = error?.code === 'VAULT_WRONG_PASSWORD';
    }
    return back.equals(dek) && wrongRejected;
  }));

  const passed = results.filter(r => r.ok).length;
  return { passed, total: results.length, ok: passed === results.length, results };
};

export const logKdfSelfTest = async () => {
  const report = await runKdfSelfTest();
  for (const r of report.results) {
    console.log(`VAULT_KAT ${r.ok ? 'PASS' : 'FAIL'} ${r.ms}ms ${r.name}${r.error ? ` (${r.error})` : ''}`);
  }
  console.log(`VAULT_KAT ${report.ok ? 'ALL PASS' : 'FAILED'} ${report.passed}/${report.total}`);
  return report;
};
