// Vault v2 (WP4) and the migration of legacy wallets on unlock (WP5).
//
// Safety rule under test: a wallet never becomes unreadable. Each fault case
// ends with a simulated restart (startup recovery) and proves the old
// password still opens the wallet with every value unchanged.
jest.setTimeout(120000);

// Real randomness: the global Jest setup returns zero bytes.
jest.mock('react-native-randombytes', () => ({
  randomBytes: (length, cb) => cb(null, require('crypto').randomBytes(length)),
}));

// The global keychain mock returns a fixed value; keep the session
// credential in memory so requestVaultKey can read it back.
let mockSessionCredential = null;
jest.mock('../../keychain/keychain', () => ({
  ...jest.requireActual('../../keychain/keychain'),
  getSessionCredential: jest.fn(async () => mockSessionCredential),
  setSessionCredential: jest.fn(async value => { mockSessionCredential = value; }),
  removeSessionCredential: jest.fn(async () => { mockSessionCredential = null; }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PERSONAL_DATA_STORAGE_INTERNAL_KEY,
  SERVICE_STORAGE_INTERNAL_KEY,
  USER_DATA_STORAGE_INTERNAL_KEY,
} from '../../../../env/index';
import {
  migrateUserVault,
  recoverPasswordMigration,
  resetUserPwd,
  storeUser,
  unlockUserVault,
  VAULT_MIGRATION_ERROR,
} from '../../asyncStore/authDataStorage';
import {
  PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
  SecureStorage,
} from '../../keychain/secureStore';
import aes256 from '../../crypto/aes256';
import * as envelope from '../../crypto/envelope';
import { VAULT_ERROR } from '../../crypto/vaultErrors';
import { hashAccountId } from '../../crypto/hash';
import { decryptkey, encryptkey } from '../../seedCrypt';
import * as authBox from '../../auth/authBox';
import {
  clearSessionVaultKey,
  getSessionVaultKey,
  setSessionVaultKey,
} from '../../vault/vaultSession';
import store from '../../../store';
import { authenticateUser, signIntoAuthenticatedAccount } from '../../../actions/actionCreators';
import { validateLogin } from '../../../actions/actions/UserData';
import { storeLegacyUser } from '../../../tests/helpers/legacyUserFixture';
import * as attestationStorage from '../../nativeStore/attestationDataStorage';
import { convertLegacyAttestationRecords } from '../../vault/attestationVaultMigration';

const NAME = 'Vault fixture';
const HASH = hashAccountId(NAME);
const PW = 'fixture password one';
const NEW_PW = 'fixture password two';
const OTHER_NAME = 'Other fixture';
const OTHER_HASH = hashAccountId(OTHER_NAME);
const OTHER_PW = 'other fixture password';

const SEEDS = {
  electrum: 'fixture electrum seed words',
  dlight_private: 'fixture private seed words that are long enough for zip32',
};
// A record written by the old AES-256-CTR code path (alphanumeric, as the
// legacy reader requires).
const CTR_CHANNEL = 'future_channel';
const CTR_SEED = 'legacy ctr seed 123';
const PERSONAL = JSON.stringify({ name: 'Fixture Person' });
const SERVICE = JSON.stringify({ token: 'fixture service token' });

const ROOT_KEYS = [
  USER_DATA_STORAGE_INTERNAL_KEY,
  PERSONAL_DATA_STORAGE_INTERNAL_KEY,
  SERVICE_STORAGE_INTERNAL_KEY,
  PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
];

const readAll = async () => {
  const out = {};
  for (const key of ROOT_KEYS) out[key] = await SecureStorage.getItem(key);
  return out;
};

const parse = value => (value == null ? null : JSON.parse(value));

const seedLegacyFixture = async () => {
  await AsyncStorage.clear();
  await storeLegacyUser({ userName: NAME, password: PW, seeds: SEEDS, biometry: true });
  await storeLegacyUser({ userName: OTHER_NAME, password: OTHER_PW, seeds: { electrum: 'other seed words' } });

  // Add one CTR-era record to the first account.
  const record = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY));
  record.users[0].encryptedKeys[CTR_CHANNEL] = await aes256.legacy_encrypt(PW, CTR_SEED);
  await SecureStorage.setItem(USER_DATA_STORAGE_INTERNAL_KEY, JSON.stringify(record));

  await SecureStorage.setItem(PERSONAL_DATA_STORAGE_INTERNAL_KEY, JSON.stringify({
    [HASH]: { contact: await encryptkey(PW, PERSONAL) },
    [OTHER_HASH]: { contact: await encryptkey(OTHER_PW, PERSONAL) },
  }));
  await SecureStorage.setItem(SERVICE_STORAGE_INTERNAL_KEY, JSON.stringify({
    [HASH]: { service: await encryptkey(PW, SERVICE) },
    [OTHER_HASH]: { service: await encryptkey(OTHER_PW, SERVICE) },
  }));
};

const EXPECTED = {
  keys: { ...SEEDS, [CTR_CHANNEL]: CTR_SEED },
  personal: { contact: PERSONAL },
  service: { service: SERVICE },
};

// Reads account A the way the app does after a restart and checks every
// value. Works for a legacy or a migrated wallet. Returns the format seen.
const expectWalletOpens = async (password = PW) => {
  expect(await SecureStorage.getItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY)).toBeNull();
  const all = await readAll();
  const user = parse(all[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);
  const personal = parse(all[PERSONAL_DATA_STORAGE_INTERNAL_KEY])[HASH];
  const service = parse(all[SERVICE_STORAGE_INTERNAL_KEY])[HASH];

  let read;
  if (user.vault == null) {
    read = value => decryptkey(password, value);
  } else {
    const dek = await envelope.unwrapVaultKey(password, HASH, user.vault);
    read = value => envelope.decryptRecord(dek, value);
  }
  for (const [channel, seed] of Object.entries(EXPECTED.keys)) {
    expect(read(user.encryptedKeys[channel])).toBe(seed);
  }
  expect(read(personal.contact)).toBe(PERSONAL);
  expect(read(service.service)).toBe(SERVICE);

  const unlocked = await unlockUserVault(password, NAME, false);
  expect(unlocked.seeds.electrum).toBe(SEEDS.electrum);
  expect(unlocked.seeds.dlight_private).toBe(SEEDS.dlight_private);
  return user.vault == null ? 'legacy' : 'v2';
};

// Account B is never touched by A's migration.
const otherAccountSnapshot = all => {
  const users = parse(all[USER_DATA_STORAGE_INTERNAL_KEY]).users.filter(u => u.accountHash === OTHER_HASH);
  return JSON.stringify({
    users,
    personal: parse(all[PERSONAL_DATA_STORAGE_INTERNAL_KEY])[OTHER_HASH],
    service: parse(all[SERVICE_STORAGE_INTERNAL_KEY])[OTHER_HASH],
  });
};

// Wraps every SecureStorage mutation. `fail(i)` decides for the i-th call.
const instrumentWrites = fail => {
  const calls = [];
  const realSet = SecureStorage.setItem.bind(SecureStorage);
  const realRemove = SecureStorage.removeItem.bind(SecureStorage);
  const guard = (op, real) => async (key, ...rest) => {
    const index = calls.length;
    calls.push({ op, key });
    if (fail && fail(index)) throw new Error(`Injected ${op} failure #${index}`);
    return real(key, ...rest);
  };
  jest.spyOn(SecureStorage, 'setItem').mockImplementation(guard('set', realSet));
  jest.spyOn(SecureStorage, 'removeItem').mockImplementation(guard('remove', realRemove));
  return calls;
};

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  clearSessionVaultKey();
  await seedLegacyFixture();
});

afterEach(() => jest.restoreAllMocks());

describe('migration of a legacy wallet', () => {
  it('moves every record to the vault and every value reads the same', async () => {
    const before = await readAll();
    const result = await migrateUserVault(HASH, PW);

    expect(result.status).toBe('migrated');
    const after = await readAll();
    const user = parse(after[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);
    expect(user.vault.kdf).toMatchObject({ id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1 });
    expect(user.biometry).toBe(true);
    for (const channel of Object.keys(EXPECTED.keys)) {
      expect(envelope.isV2Record(user.encryptedKeys[channel])).toBe(true);
    }
    expect(envelope.isV2Record(parse(after[PERSONAL_DATA_STORAGE_INTERNAL_KEY])[HASH].contact)).toBe(true);
    expect(envelope.isV2Record(parse(after[SERVICE_STORAGE_INTERNAL_KEY])[HASH].service)).toBe(true);
    // The old password no longer opens a record directly; only the vault.
    expect(decryptkey(PW, user.encryptedKeys.electrum)).toBe(false);

    expect(await expectWalletOpens()).toBe('v2');
    expect(otherAccountSnapshot(after)).toBe(otherAccountSnapshot(before));

    const unlocked = await unlockUserVault(PW, NAME, false);
    expect(unlocked.dek.equals(result.dek)).toBe(true);
    await expect(migrateUserVault(HASH, PW)).resolves.toMatchObject({ status: 'already' });
  });

  it('starts no migration and writes nothing for a wrong password', async () => {
    const before = await readAll();
    const calls = instrumentWrites();

    await expect(unlockUserVault('wrong password', NAME, false)).rejects.toThrow('Incorrect password');
    await expect(migrateUserVault(HASH, 'wrong password'))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.UNREADABLE });

    expect(calls).toEqual([]);
    expect(await readAll()).toEqual(before);
  });

  it('writes nothing when the verify step finds a mismatch', async () => {
    const before = await readAll();
    const realEncrypt = envelope.encryptRecord;
    jest.spyOn(envelope, 'encryptRecord').mockImplementation((dek, text) =>
      realEncrypt(dek, text === SERVICE ? 'changed' : text));
    const calls = instrumentWrites();

    await expect(migrateUserVault(HASH, PW))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.VERIFY });
    expect(calls).toEqual([]);
    expect(await readAll()).toEqual(before);
  });

  it('keeps the wallet when one record does not decrypt', async () => {
    const record = parse(await SecureStorage.getItem(PERSONAL_DATA_STORAGE_INTERNAL_KEY));
    record[HASH].broken = await encryptkey('another password', PERSONAL);
    await SecureStorage.setItem(PERSONAL_DATA_STORAGE_INTERNAL_KEY, JSON.stringify(record));
    const before = await readAll();

    await expect(migrateUserVault(HASH, PW))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.UNREADABLE });
    expect(await readAll()).toEqual(before);
  });
});

describe('migration guards', () => {
  it('keeps a wallet with only CTR-era records legacy (no tag proves the password)', async () => {
    await AsyncStorage.clear();
    await storeLegacyUser({ userName: NAME, password: PW, seeds: {} });
    const record = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY));
    record.users[0].encryptedKeys.electrum = await aes256.legacy_encrypt(PW, 'legacy ctr seed words');
    await SecureStorage.setItem(USER_DATA_STORAGE_INTERNAL_KEY, JSON.stringify(record));
    const before = await readAll();

    await expect(migrateUserVault(HASH, PW))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.NOT_PROVEN });
    expect(await readAll()).toEqual(before);
    expect((await unlockUserVault(PW, NAME, false)).seeds.electrum).toBe('legacy ctr seed words');
  });

  it('writes nothing when the journal would be too large for one storage row', async () => {
    const service = parse(await SecureStorage.getItem(SERVICE_STORAGE_INTERNAL_KEY));
    service[HASH].big = await encryptkey(PW, 'x'.repeat(400 * 1024));
    await SecureStorage.setItem(SERVICE_STORAGE_INTERNAL_KEY, JSON.stringify(service));
    const before = await readAll();
    const calls = instrumentWrites();

    await expect(migrateUserVault(HASH, PW))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.TOO_LARGE });
    expect(calls).toEqual([]);
    expect(await readAll()).toEqual(before);
  });
});

describe('a storage fault at each write of the migration', () => {
  // Count the mutating storage calls of one clean migration.
  const countWrites = async () => {
    const calls = instrumentWrites();
    await migrateUserVault(HASH, PW);
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await seedLegacyFixture();
    return calls;
  };

  const restartAndCheck = async beforeOther => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Simulated restart: startup recovery, then an unlock with the old password.
    await recoverPasswordMigration();
    const format = await expectWalletOpens();
    expect(otherAccountSnapshot(await readAll())).toBe(beforeOther);
    // The next unlock retries the migration and completes it.
    await expect(migrateUserVault(HASH, PW)).resolves.toMatchObject({
      status: format === 'legacy' ? 'migrated' : 'already',
    });
    expect(await expectWalletOpens()).toBe('v2');
    expect(otherAccountSnapshot(await readAll())).toBe(beforeOther);
    return format;
  };

  it('has the expected journal write sequence', async () => {
    const calls = await countWrites();
    expect(calls.map(c => `${c.op}:${c.key}`)).toEqual([
      `set:${PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY}`,
      `set:${USER_DATA_STORAGE_INTERNAL_KEY}`,
      `set:${PERSONAL_DATA_STORAGE_INTERNAL_KEY}`,
      `set:${SERVICE_STORAGE_INTERNAL_KEY}`,
      `set:${PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY}`,
      `remove:${PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY}`,
    ]);
  });

  // An exception at one write; the code then rolls back.
  it.each([0, 1, 2, 3, 4, 5])('recovers from an exception at write %i', async failAt => {
    const beforeOther = otherAccountSnapshot(await readAll());
    instrumentWrites(index => index === failAt);
    const outcome = await migrateUserVault(HASH, PW).then(r => r.status, () => 'failed');
    // Only a failed marker cleanup (after the commit) lets the migration finish.
    expect(outcome).toBe(failAt === 5 ? 'migrated' : 'failed');
    const format = await restartAndCheck(beforeOther);
    expect(format).toBe(failAt >= 5 ? 'v2' : 'legacy');
  });

  // An app kill before one write: that write and every later one never
  // happen, so the rollback cannot run either.
  it.each([0, 1, 2, 3, 4, 5])('recovers from an app kill before write %i', async killAt => {
    const beforeOther = otherAccountSnapshot(await readAll());
    instrumentWrites(index => index >= killAt);
    await migrateUserVault(HASH, PW).catch(() => {});
    const format = await restartAndCheck(beforeOther);
    // The committed marker (write 4) is the boundary.
    expect(format).toBe(killAt >= 5 ? 'v2' : 'legacy');
  });
});

describe('vault v2 accounts', () => {
  it('creates new wallets as v2', async () => {
    await AsyncStorage.clear();
    const users = await storeUser({ userName: NAME, password: PW, seeds: SEEDS }, []);
    const user = users[0];
    expect(user.vault).toBeDefined();
    expect(envelope.isV2Record(user.encryptedKeys.electrum)).toBe(true);
    expect(envelope.isV2Record(user.encryptedKeys.dlight_private)).toBe(true);
    const unlocked = await unlockUserVault(PW, NAME, false);
    expect(unlocked.seeds.electrum).toBe(SEEDS.electrum);
    expect(Buffer.isBuffer(unlocked.dek)).toBe(true);
  });

  it('changes only the key wrap on a password change after migration', async () => {
    const { dek } = await migrateUserVault(HASH, PW);
    const before = await readAll();
    const userBefore = parse(before[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);

    const sessionKey = await authBox.initSession(PW);
    store.dispatch(authenticateUser({ ...userBefore, vaultVersion: 2 }, sessionKey));
    store.dispatch(signIntoAuthenticatedAccount());
    await expect(resetUserPwd(HASH, NEW_PW, PW)).resolves.not.toBe(false);

    const after = await readAll();
    const userAfter = parse(after[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);
    expect(userAfter.encryptedKeys).toEqual(userBefore.encryptedKeys);
    expect(parse(after[PERSONAL_DATA_STORAGE_INTERNAL_KEY])).toEqual(parse(before[PERSONAL_DATA_STORAGE_INTERNAL_KEY]));
    expect(parse(after[SERVICE_STORAGE_INTERNAL_KEY])).toEqual(parse(before[SERVICE_STORAGE_INTERNAL_KEY]));
    expect(userAfter.vault.kdf.salt).not.toBe(userBefore.vault.kdf.salt);
    expect((await envelope.unwrapVaultKey(NEW_PW, HASH, userAfter.vault)).equals(dek)).toBe(true);
    await expect(envelope.unwrapVaultKey(PW, HASH, userAfter.vault))
      .rejects.toMatchObject({ code: VAULT_ERROR.WRONG_PASSWORD });
    expect(await expectWalletOpens(NEW_PW)).toBe('v2');
  });

  it('rejects a wrong old password on a v2 password change and writes nothing', async () => {
    await migrateUserVault(HASH, PW);
    const userBefore = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    // No session credential: the vault unwrap is the only password check.
    store.dispatch(authenticateUser({ ...userBefore, vaultVersion: 2 }, null));
    const before = await readAll();
    await expect(resetUserPwd(HASH, NEW_PW, 'wrong password')).resolves.toBe(false);
    expect(await readAll()).toEqual(before);
  });
  it('writes nothing when the password change journal would be too large', async () => {
    const { dek } = await migrateUserVault(HASH, PW);
    // Each root fits one storage row; the journal holds two copies of all three.
    const service = parse(await SecureStorage.getItem(SERVICE_STORAGE_INTERNAL_KEY));
    service[HASH].big = await envelope.encryptRecord(dek, 'x'.repeat(300 * 1024));
    await SecureStorage.setItem(SERVICE_STORAGE_INTERNAL_KEY, JSON.stringify(service));
    const user = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    const sessionKey = await authBox.initSession(PW);
    store.dispatch(authenticateUser({ ...user, vaultVersion: 2 }, sessionKey));
    store.dispatch(signIntoAuthenticatedAccount());
    const before = await readAll();
    const calls = instrumentWrites();

    await expect(resetUserPwd(HASH, NEW_PW, PW))
      .rejects.toMatchObject({ code: VAULT_MIGRATION_ERROR.TOO_LARGE });
    expect(calls).toEqual([]);
    expect(await readAll()).toEqual(before);
    expect(await expectWalletOpens(PW)).toBe('v2');
  });
});

describe('unlock (password and biometric login share validateLogin)', () => {
  it('migrates a legacy wallet and hands the vault key to the session', async () => {
    const account = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    const result = await validateLogin(account, PW, true, false);

    expect(result.activeAccount.vaultVersion).toBe(2);
    expect(Buffer.isBuffer(result.vaultKey)).toBe(true);
    expect(envelope.isV2Record(result.activeAccount.seeds.electrum)).toBe(true);
    expect(await expectWalletOpens()).toBe('v2');
  });

  it('does not migrate on a wrong password', async () => {
    const before = await readAll();
    const account = parse(before[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);
    await expect(validateLogin(account, 'wrong password', true, false)).rejects.toThrow('Incorrect password');
    expect(await readAll()).toEqual(before);
  });

  it('opens no legacy session while a failed migration journal is pending', async () => {
    const account = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    // Write 1 fails and so does the rollback: the prepared journal stays.
    // Writes made by a session now would be lost by the next startup recovery.
    instrumentWrites(index => index >= 1);
    await expect(validateLogin(account, PW, true, false)).rejects.toThrow();
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await recoverPasswordMigration();
    expect(await expectWalletOpens()).toBe('legacy');
  });

  it('keeps the wallet usable when the migration fails', async () => {
    const before = await readAll();
    const account = parse(before[USER_DATA_STORAGE_INTERNAL_KEY]).users.find(u => u.accountHash === HASH);
    instrumentWrites(index => index === 1);
    const result = await validateLogin(account, PW, true, false);
    jest.restoreAllMocks();

    expect(result.activeAccount.vaultVersion).toBeNull();
    expect(result.vaultKey).toBeNull();
    expect(await readAll()).toEqual(before);
  });
});

describe('attestation records', () => {
  const ATTEST = JSON.stringify({ claim: 'fixture attestation' });

  const fakeAttestationFile = async records => {
    let file = { [HASH]: records, [OTHER_HASH]: { kept: 'other account value' } };
    jest.spyOn(attestationStorage, 'updateAttestationData').mockImplementation(async updater => {
      const next = await updater({ ...file });
      if (next !== undefined) file = next;
      return next;
    });
    return () => file;
  };

  it('converts legacy records to the vault key and leaves the rest', async () => {
    const { dek } = await migrateUserVault(HASH, PW);
    const otherPasswordRecord = await encryptkey('another password', ATTEST);
    const readFile = await fakeAttestationFile({
      attestations: await encryptkey(PW, ATTEST),
      unreadable: otherPasswordRecord,
      attestations_provisioned: null,
    });

    await expect(convertLegacyAttestationRecords(HASH, PW, dek)).resolves.toBe(true);
    const after = readFile();
    expect(envelope.decryptRecord(dek, after[HASH].attestations)).toBe(ATTEST);
    expect(after[HASH].unreadable).toBe(otherPasswordRecord);
    expect(after[OTHER_HASH]).toEqual({ kept: 'other account value' });
  });

  it('converts legacy records with the old password before a v2 password change', async () => {
    const { dek } = await migrateUserVault(HASH, PW);
    const readFile = await fakeAttestationFile({ attestations: await encryptkey(PW, ATTEST) });
    const user = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    const sessionKey = await authBox.initSession(PW);
    store.dispatch(authenticateUser({ ...user, vaultVersion: 2 }, sessionKey));

    await expect(resetUserPwd(HASH, NEW_PW, PW)).resolves.not.toBe(false);
    expect(envelope.decryptRecord(dek, readFile()[HASH].attestations)).toBe(ATTEST);
  });
});

describe('session vault key', () => {
  it('is bound to the account and session key, and sign-out wipes it', () => {
    const dek = Buffer.alloc(32, 7);
    setSessionVaultKey('acct', 'session-1', dek);
    expect(getSessionVaultKey('acct', 'session-1').equals(dek)).toBe(true);
    expect(getSessionVaultKey('acct', 'session-2')).toBeNull();
    expect(getSessionVaultKey('other', 'session-1')).toBeNull();
    clearSessionVaultKey();
    expect(getSessionVaultKey('acct', 'session-1')).toBeNull();
    expect(dek.equals(Buffer.alloc(32, 7))).toBe(true);
  });

  it('never returns the key when the session changes during the unwrap', async () => {
    await migrateUserVault(HASH, PW);
    const user = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    const sessionKey = await authBox.initSession(PW);
    store.dispatch(authenticateUser({ ...user, vaultVersion: 2 }, sessionKey));
    clearSessionVaultKey();
    const realUnwrap = envelope.unwrapVaultKey;
    jest.spyOn(envelope, 'unwrapVaultKey').mockImplementation(async (...args) => {
      const dek = await realUnwrap(...args);
      // Sign-out or another login while the KDF ran.
      store.dispatch(authenticateUser({ accountHash: 'someone-else', seeds: {}, keys: {} }, 'other-session'));
      return dek;
    });

    await expect(authBox.requestVaultKey()).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(getSessionVaultKey(HASH, sessionKey)).toBeNull();
  });

  it('unwraps the stored vault again when the cache is empty', async () => {
    const { dek } = await migrateUserVault(HASH, PW);
    const user = parse(await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)).users
      .find(u => u.accountHash === HASH);
    const sessionKey = await authBox.initSession(PW);
    store.dispatch(authenticateUser({ ...user, vaultVersion: 2 }, sessionKey));
    clearSessionVaultKey();

    const vaultKey = await authBox.requestVaultKey();
    expect(vaultKey.dek.equals(dek)).toBe(true);
    expect(getSessionVaultKey(HASH, sessionKey).equals(dek)).toBe(true);
  });
});
