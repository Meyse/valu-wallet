import {
  encryptkey,
  decryptkey,
  decryptkeyAuthenticated,
  vaultDecrypt,
  vaultEncrypt,
} from '../seedCrypt'
import {
  createVault,
  decryptRecord,
  encryptRecord,
  isV2Record,
  RECORD_AREA,
  unwrapVaultKey,
  wrapVaultKey,
} from '../crypto/envelope'
import { isVaultError, VAULT_ERROR } from '../crypto/vaultErrors'
import { Buffer } from 'buffer'
import { setSessionVaultKey } from '../vault/vaultSession'
import { convertLegacyAttestationRecords } from '../vault/attestationVaultMigration'
import { passwordFailsRule } from '../auth/passwordRule'

import { hashAccountId } from "../crypto/hash";
import {
  CHANNELS_NULL_TEMPLATE,
  DLIGHT_PRIVATE,
  ELECTRUM,
  WYRE_SERVICE, VALU_SERVICE,
} from "../constants/intervalConstants";
import { createAlert } from "../../actions/actions/alert/dispatchers/alert";
import store from '../../store';
import {
  setAccounts,
  setShowHideSeedCorruptionSetting,
  signOut,
  updateSessionKey,
  setActiveAccountPasswordRule,
} from '../../actions/actionCreators';
import {
  PERSONAL_DATA_STORAGE_INTERNAL_KEY,
  SERVICE_STORAGE_INTERNAL_KEY,
  USER_DATA_STORAGE_INTERNAL_KEY,
} from '../../../env/index';
import { VALU_SERVICE_ID, WYRE_SERVICE_ID } from '../constants/services';
import {
  getSessionCredential,
  removeSessionCredential,
} from '../keychain/keychain';
import { initSession } from '../auth/authBox';
import {
  PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
  SecureStorage,
} from '../keychain/secureStore';
import { Alert } from 'react-native';
import { SUSPICIOUS_UNICODE_CHARACTER_TEST } from '../constants/regex';
import { INCORRECT_PASSWORD_DELAY_ERROR_MS } from '../constants/errors';
import { setPersonalData } from '../../actions/actions/personal/creators/personal';
import { setServiceStored } from '../../actions/actions/services/creators/services';
import {
  queuePasswordProtectedStorageMigration,
  queueUserStorageWrite,
} from './passwordProtectedStorageQueue';
import {
  captureSessionScope,
  scopeSessionAction,
  sessionScopeIsCurrent,
} from '../../actions/actions/updates/sessionRequests';

//Set storage to hold encrypted user data
export const storeUser = (authData, users) =>
  queueUserStorageWrite(async () => {
    const accountHash = hashAccountId(authData.userName);
    // Check the durable list while holding the write queue. Two submissions
    // can carry the same stale caller list even though the first has saved.
    const storedUsersRecord = parseStoredObject(
      await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY),
      "user",
    );
    const _users = Array.isArray(storedUsersRecord.users)
      ? storedUsersRecord.users.slice()
      : users
        ? users.slice()
        : [];

    if (_users.some(user =>
      user.accountHash === accountHash || user.id === authData.userName
    )) {
      const error = new Error('A profile with this name already exists.');
      error.code = 'DUPLICATE_ACCOUNT';
      throw error;
    }

    let encryptedKeys = {...CHANNELS_NULL_TEMPLATE};
    const {seeds} = authData;

    // New wallets start in vault format v2: a random vault key encrypts the
    // seeds, and the password key only wraps the vault key.
    const {vault, dek} = await createVault(authData.password, accountHash);
    try {
      for (const seedType in authData.seeds) {
        if (seeds[seedType]) {
          encryptedKeys[seedType] = await encryptRecord(dek, seeds[seedType], {
            accountHash,
            area: RECORD_AREA.SEED,
            field: seedType,
          });
        }
      }

      // Never store a wallet that the same password cannot open again.
      const checkDek = await unwrapVaultKey(authData.password, accountHash, vault);
      try {
        if (!checkDek.equals(dek)) throw new Error('Vault check failed');
        for (const seedType in authData.seeds) {
          if (
            seeds[seedType] &&
            decryptRecord(checkDek, encryptedKeys[seedType], {
              accountHash,
              area: RECORD_AREA.SEED,
              field: seedType,
            }) !== seeds[seedType]
          ) {
            throw new Error('Vault check failed');
          }
        }
      } finally {
        checkDek.fill(0);
      }
    } finally {
      dek.fill(0);
    }

    let userObj = {
      id: authData.userName,
      accountHash,
      encryptedKeys,
      vault,
      biometry: authData.biometry ? true : false,
      hideSeedWarnings: !!(authData.hideSeedWarnings),
      keyDerivationVersion:
        authData.keyDerivationVersion == null
          ? 0
          : authData.keyDerivationVersion,
      disabledServices:
        authData.disabledServices == null
          ? encryptedKeys[WYRE_SERVICE]
            ? {}
            : {[WYRE_SERVICE_ID]: true}
          : authData.disabledServices,
      testnetOverrides: authData.testnetOverrides
    };

    _users.push(userObj);
    let _toStore = {...storedUsersRecord, users: _users};

    await SecureStorage.setItem(
      USER_DATA_STORAGE_INTERNAL_KEY,
      JSON.stringify(_toStore),
    );
    return _users;
  });



//Add user encrypted key for a channel
const addEncryptedKeyToUserUnlocked = async (accountHash, channel, seed, password, overwrite = false) => {
  try {
    const users = await getUsers()

    const userObjIndex = users.findIndex(user => user.accountHash === accountHash)
    if (userObjIndex === -1) throw new Error("User with hash " + accountHash + " not found.")
    const userObj = users[userObjIndex]

    if (userObj.encryptedKeys[channel] != null && !overwrite) {
      throw new Error(`User with hash ${accountHash} already has as ${channel} seed, cannot overwrite.`)
    } else {
      let newUserObj = {...userObj, encryptedKeys: {...userObj.encryptedKeys}}
      if (userObj.vault != null) {
        const dek = await unwrapVaultKey(password, accountHash, userObj.vault)
        try {
          newUserObj.encryptedKeys[channel] = await encryptRecord(dek, seed, {
            accountHash,
            area: RECORD_AREA.SEED,
            field: channel,
          })
        } finally {
          dek.fill(0)
        }
      } else {
        newUserObj.encryptedKeys[channel] = await encryptkey(password, seed)
      }
      
      let newUsers = [...users]
      newUsers[userObjIndex] = newUserObj

      await SecureStorage.setItem(USER_DATA_STORAGE_INTERNAL_KEY, JSON.stringify({users: newUsers}))
      return await getUsers()
    }
  } catch(e) {
    throw e
  }
};

export const addEncryptedKeyToUser = (accountHash, channel, seed, password, overwrite = false) =>
  queueUserStorageWrite(() =>
    addEncryptedKeyToUserUnlocked(accountHash, channel, seed, password, overwrite),
  );

/**
 * Atomically reads, transforms, and writes the complete user root while the
 * password-migration exclusion lock is held.
 */
export const updateUsers = updater => queueUserStorageWrite(async () => {
  if (typeof updater !== "function") {
    throw new Error("User storage updater must be a function");
  }

  const usersRecord = parseStoredObject(
    await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY),
    "user",
  );
  const users = usersRecord.users == null ? [] : usersRecord.users;
  if (!Array.isArray(users)) throw new Error("Invalid user storage");

  const nextUsers = await updater(users);
  if (!Array.isArray(nextUsers)) {
    throw new Error("User storage updater must return an array");
  }

  if (nextUsers !== users) {
    await SecureStorage.setItem(
      USER_DATA_STORAGE_INTERNAL_KEY,
      JSON.stringify({...usersRecord, users: nextUsers}),
    );
  }
  return nextUsers;
});

// Set storage to hold encrypted user data. New read-modify-write paths should
// use updateUsers so the read is covered by the same exclusion lock.
export const setUsers = users => updateUsers(() => users);

const PASSWORD_MIGRATION_VERSION = 1;
const PASSWORD_MIGRATION_KEYS = [
  USER_DATA_STORAGE_INTERNAL_KEY,
  PERSONAL_DATA_STORAGE_INTERNAL_KEY,
  SERVICE_STORAGE_INTERNAL_KEY,
];

const validatePasswordMigrationJournal = journal => {
  if (
    journal == null ||
    journal.version !== PASSWORD_MIGRATION_VERSION ||
    !["prepared", "committed"].includes(journal.phase)
  ) {
    throw new Error("Invalid password migration recovery journal");
  }

  // New committed journals are deliberately reduced to a tombstone so a
  // failed marker cleanup cannot retain deleted or superseded profile roots.
  // Continue accepting full committed journals written by older versions.
  if (
    journal.phase === "committed" &&
    journal.before == null &&
    journal.after == null
  ) {
    return;
  }

  if (journal.before == null || journal.after == null) {
    throw new Error("Incomplete password migration recovery journal");
  }

  for (const key of PASSWORD_MIGRATION_KEYS) {
    if (!(key in journal.before) || !(key in journal.after)) {
      throw new Error("Incomplete password migration recovery journal");
    }
  }
};

const createCommittedJournalTombstone = journal => ({
  version: PASSWORD_MIGRATION_VERSION,
  accountHash: journal.accountHash,
  phase: "committed",
});

const applyPasswordMigrationSnapshot = async (snapshot, afterEachKey) => {
  for (const key of PASSWORD_MIGRATION_KEYS) {
    if (snapshot[key] == null) {
      await SecureStorage.removeItem(key);
    } else {
      await SecureStorage.setItem(key, snapshot[key]);
    }
    if (afterEachKey) await afterEachKey(key);
  }
};

/**
 * Completes recovery from an interrupted password reset. A prepared migration
 * rolls back. A committed marker proves every root was already durable, so its
 * recovery only removes the marker and never replays a potentially stale
 * `after` snapshot over later data.
 */
const recoverPasswordMigrationUnlocked = async () => {
  const storedJournal = await SecureStorage.getItem(
    PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
  );

  if (storedJournal == null) return false;

  let journal;
  try {
    journal = JSON.parse(storedJournal);
  } catch (_) {
    throw new Error("Unable to parse password migration recovery journal");
  }

  validatePasswordMigrationJournal(journal);
  if (journal.phase === "prepared") {
    await applyPasswordMigrationSnapshot(journal.before);
  }
  await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
  return true;
};

export const recoverPasswordMigration = () =>
  queuePasswordProtectedStorageMigration(recoverPasswordMigrationUnlocked);

const parseStoredObject = (storedValue, recordName) => {
  if (storedValue == null) return {};

  const parsed = JSON.parse(storedValue);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid ${recordName} storage`);
  }

  return parsed;
};

// Remove the account and its encrypted data as one recoverable three-root
// transaction. A prepared journal rolls every root back after a failed write
// or interrupted process; a committed journal only needs cleanup.
export const deleteUser = accountHash =>
  queuePasswordProtectedStorageMigration(async () => {
    await recoverPasswordMigrationUnlocked();

    const storedValues = await Promise.all(
      PASSWORD_MIGRATION_KEYS.map(key => SecureStorage.getItem(key)),
    );
    const before = PASSWORD_MIGRATION_KEYS.reduce((snapshot, key, index) => {
      snapshot[key] = storedValues[index];
      return snapshot;
    }, {});
    const usersRecord = parseStoredObject(
      before[USER_DATA_STORAGE_INTERNAL_KEY],
      "user",
    );
    const users = Array.isArray(usersRecord.users)
      ? usersRecord.users.slice()
      : [];
    const userIndex = users.findIndex(user => user.accountHash === accountHash);

    if (accountHash == null || userIndex === -1) {
      Alert.alert("Error", `User with hash ${accountHash} not found`);
      throw new Error(`User with hash ${accountHash} not found`);
    }

    users.splice(userIndex, 1);
    const personalRecord = parseStoredObject(
      before[PERSONAL_DATA_STORAGE_INTERNAL_KEY],
      "personal data",
    );
    const serviceRecord = parseStoredObject(
      before[SERVICE_STORAGE_INTERNAL_KEY],
      "service data",
    );
    delete personalRecord[accountHash];
    delete serviceRecord[accountHash];

    const after = {
      [USER_DATA_STORAGE_INTERNAL_KEY]: JSON.stringify({...usersRecord, users}),
      [PERSONAL_DATA_STORAGE_INTERNAL_KEY]: JSON.stringify(personalRecord),
      [SERVICE_STORAGE_INTERNAL_KEY]: JSON.stringify(serviceRecord),
    };
    const journal = {
      version: PASSWORD_MIGRATION_VERSION,
      accountHash,
      phase: "prepared",
      before,
      after,
    };

    try {
      await SecureStorage.setItem(
        PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
        JSON.stringify(journal),
      );
      await applyPasswordMigrationSnapshot(after);
      await SecureStorage.setItem(
        PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
        JSON.stringify(createCommittedJournalTombstone(journal)),
      );
    } catch (error) {
      try {
        await applyPasswordMigrationSnapshot(before);
        await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
      } catch (rollbackError) {
        // Retain the prepared journal for startup recovery.
        console.warn(rollbackError);
      }
      throw error;
    }

    try {
      await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
    } catch (cleanupError) {
      // The committed roots are final; startup recovery only removes the marker.
      console.warn(cleanupError);
    }
    return users;
  });

// readKey and writeKey are vault keys ({password, dek}). A v2 account keeps
// its v2 records as they are (the vault key does not change); only a legacy
// record is re-encrypted. Each value is bound to accountHash, `area` and its
// key in the record.
const reencryptRecord = async (record, readKey, writeKey, recordName, accountHash, area) => {
  const nextRecord = {...record};

  for (const key of Object.keys(nextRecord)) {
    const encryptedValue = nextRecord[key];
    if (encryptedValue == null) continue;
    if (typeof encryptedValue !== "string") {
      throw new Error(`Invalid encrypted ${recordName} value for ${key}`);
    }

    const binding = {accountHash, area, field: key};
    const decryptedValue = vaultDecrypt(readKey, encryptedValue, binding);
    if (decryptedValue === false) {
      const passwordError = new Error(
        `Unable to decrypt ${recordName} value for ${key}`,
      );
      passwordError.code = "INCORRECT_PASSWORD";
      throw passwordError;
    }

    if (writeKey.dek != null && isV2Record(encryptedValue)) continue;
    nextRecord[key] = await vaultEncrypt(writeKey, decryptedValue, binding);
  }

  return nextRecord;
};

let passwordMigrationQueue = Promise.resolve();

// Wipes the plaintext vault keys of a password change when it ends, on every
// path. The session cache keeps its own copy.
const resetUserPwdTransaction = async (accountHash, newPwd, oldPwd, sessionScope) => {
  const vaultKeys = [];
  try {
    return await resetUserPwdTransactionUnwiped(
      accountHash,
      newPwd,
      oldPwd,
      sessionScope,
      vaultKeys,
    );
  } finally {
    for (const key of vaultKeys) key.fill(0);
  }
};

const resetUserPwdTransactionUnwiped = async (
  accountHash,
  newPwd,
  oldPwd,
  sessionScope,
  vaultKeys,
) => {
  const assertResetSessionCurrent = expectedScope => {
    if (!sessionScopeIsCurrent(store.getState(), expectedScope)) {
      const sessionError = new Error(
        'Account changed while the password reset was in progress.',
      );
      sessionError.code = 'SESSION_CHANGED';
      throw sessionError;
    }
  };

  assertResetSessionCurrent(sessionScope);
  // resetUserPwd already owns all three root queues here.
  await recoverPasswordMigrationUnlocked();
  assertResetSessionCurrent(sessionScope);

  const storedValues = await Promise.all(
    PASSWORD_MIGRATION_KEYS.map(key => SecureStorage.getItem(key)),
  );
  const before = PASSWORD_MIGRATION_KEYS.reduce((snapshot, key, index) => {
    snapshot[key] = storedValues[index];
    return snapshot;
  }, {});

  const usersRecord = parseStoredObject(
    before[USER_DATA_STORAGE_INTERNAL_KEY],
    "user",
  );
  const users = Array.isArray(usersRecord.users)
    ? usersRecord.users.map(user => ({...user}))
    : [];
  const userIndex = users.findIndex(user => user.accountHash === accountHash);

  if (accountHash == null || userIndex === -1) {
    Alert.alert("Error", `User with ID ${accountHash} not found`);
    return false;
  }

  const user = users[userIndex];
  user.biometry = false;
  const personalRecord = parseStoredObject(
    before[PERSONAL_DATA_STORAGE_INTERNAL_KEY],
    "personal data",
  );
  const serviceRecord = parseStoredObject(
    before[SERVICE_STORAGE_INTERNAL_KEY],
    "service data",
  );
  const oldSessionKey = store.getState().authentication.sessionKey;
  let oldSessionCredential;

  try {
    oldSessionCredential = await getSessionCredential();
  } catch (sessionError) {
    console.warn(sessionError);
    return false;
  }

  if (oldSessionKey != null && typeof oldSessionCredential === "string") {
    const sessionPassword = decryptkey(oldSessionKey, oldSessionCredential);
    if (sessionPassword === false || sessionPassword !== oldPwd) {
      Alert.alert("Authentication Error", "Incorrect password");
      return false;
    }
  }

  // Vault v2: the password key only wraps the vault key, so a password
  // change re-wraps 32 bytes and keeps every v2 record as it is.
  let vaultDek = null;
  if (user.vault != null) {
    try {
      vaultDek = await unwrapVaultKey(oldPwd, accountHash, user.vault);
      vaultKeys.push(vaultDek);
    } catch (vaultError) {
      if (isVaultError(vaultError, VAULT_ERROR.WRONG_PASSWORD)) {
        Alert.alert("Authentication Error", "Incorrect password");
        return false;
      }
      throw vaultError;
    }
  }
  if (vaultDek != null) {
    // Attestations live outside the journal. Convert any legacy record now,
    // while the old password still reads it (best effort, as on unlock).
    await convertLegacyAttestationRecords(accountHash, oldPwd, vaultDek);
  }
  const readKey = {password: oldPwd, dek: vaultDek};
  const writeKey = vaultDek != null ? {dek: vaultDek} : {password: newPwd};

  try {
    user.encryptedKeys = await reencryptRecord(
      user.encryptedKeys || {},
      readKey,
      writeKey,
      "account key",
      accountHash,
      RECORD_AREA.SEED,
    );

    if (personalRecord[accountHash] != null) {
      personalRecord[accountHash] = await reencryptRecord(
        personalRecord[accountHash],
        readKey,
        writeKey,
        "personal data",
        accountHash,
        RECORD_AREA.PERSONAL,
      );
    }

    if (serviceRecord[accountHash] != null) {
      serviceRecord[accountHash] = await reencryptRecord(
        serviceRecord[accountHash],
        readKey,
        writeKey,
        "service data",
        accountHash,
        RECORD_AREA.SERVICE,
      );
    }
  } catch (encryptionError) {
    if (encryptionError.code === "INCORRECT_PASSWORD") {
      Alert.alert("Authentication Error", "Incorrect password");
      return false;
    }

    throw encryptionError;
  }

  if (vaultDek != null) {
    user.vault = await wrapVaultKey(vaultDek, newPwd, accountHash);
    // Verify the new wrap with a fresh derivation before anything is written.
    const checkDek = await unwrapVaultKey(newPwd, accountHash, user.vault);
    const wrapMatches = checkDek.equals(vaultDek);
    checkDek.fill(0);
    if (!wrapMatches) {
      throw new Error("Vault re-wrap check failed");
    }
  }

  const after = {
    [USER_DATA_STORAGE_INTERNAL_KEY]: JSON.stringify({...usersRecord, users}),
    [PERSONAL_DATA_STORAGE_INTERNAL_KEY]: JSON.stringify(personalRecord),
    [SERVICE_STORAGE_INTERNAL_KEY]: JSON.stringify(serviceRecord),
  };

  const journal = {
    version: PASSWORD_MIGRATION_VERSION,
    accountHash,
    phase: "prepared",
    before,
    after,
  };
  // Checked before the first write: a journal that startup cannot read back
  // must never be written.
  const journalString = serializePreparedJournal(journal);
  let committedDurable = false;
  let sessionCredentialMutationStarted = false;

  try {
    assertResetSessionCurrent(sessionScope);
    await SecureStorage.setItem(
      PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
      journalString,
    );
    await applyPasswordMigrationSnapshot(after);

    // The committed marker is the durable boundary: every protected root is
    // already in its new version, while no new session or Redux data has been
    // exposed yet. A marker failure therefore remains safely rollbackable.
    assertResetSessionCurrent(sessionScope);
    await SecureStorage.setItem(
      PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
      JSON.stringify(createCommittedJournalTombstone(journal)),
    );
    committedDurable = true;

    // initSession writes the process-wide Keychain credential. Mark the
    // mutation attempt before awaiting so an account switch during that await
    // is handled by fail-closed global session invalidation.
    assertResetSessionCurrent(sessionScope);
    sessionCredentialMutationStarted = true;
    const sessionKey = await initSession(newPwd);
    assertResetSessionCurrent(sessionScope);
    if (vaultDek != null) {
      setSessionVaultKey(accountHash, sessionKey, vaultDek);
    }
    store.dispatch(
      scopeSessionAction(updateSessionKey(sessionKey), sessionScope),
    );
    const postResetSessionScope = {
      ...sessionScope,
      sessionEpoch: sessionScope.sessionEpoch + 1,
    };
    assertResetSessionCurrent(postResetSessionScope);

    const nextPersonalData = personalRecord[accountHash] || {};
    const nextServiceData = serviceRecord[accountHash] || {};
    store.dispatch(scopeSessionAction(
      setPersonalData(nextPersonalData),
      postResetSessionScope,
    ));
    assertResetSessionCurrent(postResetSessionScope);
    if (store.getState().personal !== nextPersonalData) {
      throw new Error('Failed to publish migrated personal data');
    }
    store.dispatch(scopeSessionAction(
      setServiceStored(nextServiceData),
      postResetSessionScope,
    ));
    assertResetSessionCurrent(postResetSessionScope);
    if (store.getState().services.stored !== nextServiceData) {
      throw new Error('Failed to publish migrated service data');
    }
    store.dispatch(scopeSessionAction(
      setActiveAccountPasswordRule(passwordFailsRule(newPwd)),
      postResetSessionScope,
    ));

    try {
      await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
    } catch (cleanupError) {
      // Roots and visible state are committed. Retain the marker so normal
      // protected writes fail closed until explicit recovery finishes cleanup.
      console.warn(cleanupError);
    }

    return users;
  } catch (err) {
    console.warn(err);

    if (committedDurable) {
      if (sessionCredentialMutationStarted) {
        // The Keychain credential is process-wide. Never restore account A's
        // old credential after a concurrent switch to account B; invalidate
        // the current session globally and require fresh authentication.
        try {
          await removeSessionCredential();
        } catch (credentialCleanupError) {
          console.warn(credentialCleanupError);
        }
        store.dispatch(signOut());
      }

      // A committed transaction cannot be rolled back or replayed. Keep its
      // marker so startup recovery can finish cleanup without touching roots.
      return false;
    }

    try {
      await applyPasswordMigrationSnapshot(before);
      await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
    } catch (rollbackError) {
      // Keep the prepared journal so the next startup can finish rolling back.
      console.warn(rollbackError);
    }

    return false;
  }
};

export const resetUserPwd = (
  accountHash,
  newPwd,
  oldPwd,
  sessionScope = captureSessionScope(store.getState(), accountHash),
) => {
  const migration = passwordMigrationQueue.then(
    () => queuePasswordProtectedStorageMigration(
      () => resetUserPwdTransaction(
        accountHash,
        newPwd,
        oldPwd,
        sessionScope,
      ),
    ),
    () => queuePasswordProtectedStorageMigration(
      () => resetUserPwdTransaction(
        accountHash,
        newPwd,
        oldPwd,
        sessionScope,
      ),
    ),
  );

  passwordMigrationQueue = migration.catch(() => {});
  return migration;
};

const setUserSetting = (accountHash, settingKey, setting) =>
  queueUserStorageWrite(() => new Promise((resolve, reject) => {
    SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)
      .then(async (res) => {
        const storedRecord = res ? JSON.parse(res) : {users: []};
        let _users = storedRecord.users;
        if(accountHash !== null) {
          let userIndex = _users.findIndex(n => n.accountHash === accountHash);

          if (userIndex > -1) {
            _users[userIndex][settingKey] = setting
            await SecureStorage.setItem(USER_DATA_STORAGE_INTERNAL_KEY, JSON.stringify({...storedRecord, users: _users}))
            resolve(_users)
          } else {
            throw new Error("User with hash " + accountHash + " not found")
          }
        } else {
          throw new Error("UserID is null")
        }
      })
      .catch(err => {
        reject(err)
        console.warn(err)
      });
  }));

export const setUserBiometry = (accountHash, biometry) => {
  return setUserSetting(accountHash, "biometry", biometry)
};

export const setUserHideSeedWarnings = (accountHash, hideSeedWarnings) => {
  return setUserSetting(accountHash, "hideSeedWarnings", hideSeedWarnings)
};

export const setUserKeyDerivationVersion = (accountHash, keyDerivationVersion) => {
  return setUserSetting(accountHash, "keyDerivationVersion", keyDerivationVersion)
};

export const setUserDisabledServices = (accountHash, disabledServices) => {
  return setUserSetting(accountHash, "disabledServices", disabledServices)
};

export const setUserTestnetOverrides = (accountHash, testnetOverrides) => {
  return setUserSetting(accountHash, "testnetOverrides", testnetOverrides)
}

//TODO: Stop using wifKey to encrypt payment methods before using them in production
export const putUserPaymentMethods = async (user, paymentMethods) => {
  //const encryptedPaymentMethods = encryptkey(user.wifKey, JSON.stringify(paymentMethods))
  const encryptedPaymentMethods = "none"
  return await putUser(user.id, {
    paymentMethods: encryptedPaymentMethods,
  })
}

export const putUser = (userID, userParams) =>
  queueUserStorageWrite(() => new Promise((resolve, reject) => {
    SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)
      .then(res => {
        const _users = res ? JSON.parse(res).users : [];
        if(userID !== null) {
          let userIndex = _users.findIndex(n => n.id === userID);

          if (userIndex > -1) {
            _users[userIndex] = {
              ..._users[userIndex],
              ...userParams,
            }
            const _toStore = { users: _users }
            const promiseArr = [SecureStorage.setItem(USER_DATA_STORAGE_INTERNAL_KEY, JSON.stringify(_toStore)), _users]
            return Promise.all(promiseArr)
          }
        }
        return 'error'
      })
      .then((res) => {
        if (res === "error") {
          resolve(false);
        } else if (Array.isArray(res)) {
          let _users = res.pop()
          resolve(_users);
        }
      })
      .catch(err => {
        reject(err)
        console.warn(err)
      });
  }));

//Get array of encrypted user data
export const getUsers = () => {
  let users = {}
  return new Promise((resolve, reject) => {
    SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY)
      .then(res => {
        users = res ? JSON.parse(res) : {users: []};
        resolve(users.users)
      })
      .catch(err => reject(err));
  })
};

// Decrypts every seed of a stored user with the typed password. Returns
// { seeds, dek } (dek is null for a legacy user), or null for a wrong
// password. A v2 user is checked by unwrapping the vault key: one KDF and one
// tag check.
const readUserSeeds = async (pin, user) => {
  let dek = null;
  if (user.vault != null) {
    if (typeof pin !== 'string' || pin.length === 0) return null;
    try {
      dek = await unwrapVaultKey(pin, user.accountHash, user.vault);
    } catch (vaultError) {
      if (isVaultError(vaultError, VAULT_ERROR.WRONG_PASSWORD)) return null;
      throw vaultError;
    }
  }

  const vaultKey = {password: pin, dek};
  const encryptedKeys = user.encryptedKeys || {};
  const seeds = {};
  for (const channel of [ELECTRUM, DLIGHT_PRIVATE, WYRE_SERVICE, VALU_SERVICE]) {
    const encrypted = encryptedKeys[channel];
    seeds[channel] = encrypted != null
      ? vaultDecrypt(vaultKey, encrypted, {
        accountHash: user.accountHash,
        area: RECORD_AREA.SEED,
        field: channel,
      })
      : null;
    if (encrypted != null && !seeds[channel]) {
      if (dek != null) {
        // The vault key is right, so this is damaged data, not a wrong password.
        dek.fill(0);
        const error = new Error(`Unable to read the ${channel} seed`);
        error.code = VAULT_ERROR.RECORD_AUTH;
        throw error;
      }
      return null;
    }
  }

  return {seeds, dek};
};

const findStoredUser = async userName => {
  const res = await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY);
  const users = res ? JSON.parse(res) : {users: []};
  return users.users ? users.users.find(n => n.id === userName) : null;
};

/**
 * Checks the password and returns { seeds, user, dek }. `user` is the stored
 * record (read now, not a cached copy). `dek` is the vault key of a v2 user
 * and null for a legacy user. Rejects with "Incorrect password" after the
 * usual delay.
 */
export const unlockUserVault = (pin, userName, alertOnFail = true, alertOnCorruptedSeed = false) =>
  queueUserStorageWrite(async () => {
    if (pin == null) {
      if (alertOnFail) Alert.alert("Authentication Error", "Please enter a password")
      throw new Error("Please enter a password");
    }

    const user = await findStoredUser(userName);
    if (!user) {
      if (alertOnFail) Alert.alert("Authentication Error", "Please select an existing user")
      throw new Error("Please select an existing user");
    }

    const result = await readUserSeeds(pin, user);
    if (result == null) {
      await new Promise(resolve => setTimeout(resolve, INCORRECT_PASSWORD_DELAY_ERROR_MS));
      if (alertOnFail) Alert.alert("Authentication Error", "Incorrect password");
      throw new Error("Incorrect password");
    }

    const _decryptedSeeds = result.seeds;
    let seedPotentiallyCorrupted = false;

    // Legacy decryption is unauthenticated; password checks must not rewrite seeds.
    for (const channel in _decryptedSeeds) {
      if (_decryptedSeeds[channel]) {
        try {
          if (alertOnCorruptedSeed) {
            seedPotentiallyCorrupted = (SUSPICIOUS_UNICODE_CHARACTER_TEST).test(_decryptedSeeds[channel])
          }
        } catch (e) {
          Alert.alert("Authentication Error", "Internal authentication error.");
        }
      }
    }

    if (seedPotentiallyCorrupted) {
      if (!user.hideSeedWarnings) {
        Alert.alert(
          "Possible Seed Corruption Detected",
          "Non-standard characters were detected in your profile seed.\n\nIf your seed is a standard word-based phrase, or a WIF key, this could indicate that your seed data was corrupted, and may not match your seed backup.\n\nCheck your seed by going into Settings > Profile > Recover Seed. If it does not match your backup, create a new profile from your backup and send any funds on this profile to that new profile.\n\nYou can disable this warning in Profile > Settings."
        );
      }

      store.dispatch(setShowHideSeedCorruptionSetting(true));
    }

    return {seeds: _decryptedSeeds, user, dek: result.dek};
  });

// Check user password. Resolves the decrypted seeds.
export const checkPinForUser = async (pin, userName, alertOnFail = true, alertOnCorruptedSeed = false) => {
  const {seeds, dek} = await unlockUserVault(pin, userName, alertOnFail, alertOnCorruptedSeed);
  if (dek != null) dek.fill(0);
  return seeds;
};

// ---------------------------------------------------------------------------
// Migration of a legacy user to vault v2 (plan A4)

export const VAULT_MIGRATION_ERROR = Object.freeze({
  NOT_FOUND: 'VAULT_MIGRATION_NOT_FOUND',
  NO_ACCOUNT_HASH: 'VAULT_MIGRATION_NO_ACCOUNT_HASH',
  UNREADABLE: 'VAULT_MIGRATION_UNREADABLE',
  MIXED: 'VAULT_MIGRATION_MIXED_RECORDS',
  VERIFY: 'VAULT_MIGRATION_VERIFY_FAILED',
  NOT_PROVEN: 'VAULT_MIGRATION_PASSWORD_NOT_PROVEN',
  TOO_LARGE: 'VAULT_MIGRATION_TOO_LARGE',
});

// The journal holds the old and new copy of all three roots in one storage
// row. Android AsyncStorage cannot read a row near its 2 MB cursor window, and
// SecureStorage adds encryption overhead, so stay far below it.
const VAULT_MIGRATION_JOURNAL_MAX_CHARS = 512 * 1024;

const migrationError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

// The vault migration and the password change write their prepared journal
// through this check, before their first storage write.
const serializePreparedJournal = journal => {
  const journalString = JSON.stringify(journal);
  if (journalString.length > VAULT_MIGRATION_JOURNAL_MAX_CHARS) {
    throw migrationError(VAULT_MIGRATION_ERROR.TOO_LARGE, 'Migration journal too large');
  }
  return journalString;
};

// Decrypts every value of a legacy record with the password. Any value that
// does not decrypt aborts the migration; nothing is written. `proof` records
// whether one value passed the GCM tag check: the old CTR reader accepts a
// wrong password when the output happens to look like text.
const decryptLegacyRecord = (record, password, recordName, proof) => {
  const plain = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value == null) continue;
    if (typeof value !== 'string') {
      throw migrationError(VAULT_MIGRATION_ERROR.UNREADABLE, `Invalid ${recordName} value`);
    }
    if (isV2Record(value)) {
      throw migrationError(VAULT_MIGRATION_ERROR.MIXED, `A ${recordName} value is already v2`);
    }
    let decrypted = decryptkeyAuthenticated(password, value);
    if (decrypted !== false) {
      proof.authenticated = true;
    } else {
      decrypted = decryptkey(password, value);
    }
    if (decrypted === false) {
      throw migrationError(VAULT_MIGRATION_ERROR.UNREADABLE, `A ${recordName} value does not decrypt`);
    }
    plain[key] = decrypted;
  }
  return plain;
};

const encryptPlainRecord = async (record, plain, dek, accountHash, area) => {
  const next = {...record};
  for (const key of Object.keys(plain)) {
    next[key] = await encryptRecord(dek, plain[key], {accountHash, area, field: key});
  }
  return next;
};

const assertRecordMatches = (record, plain, dek, accountHash, area) => {
  const encryptedKeys = Object.keys(record || {}).filter(key => record[key] != null);
  if (encryptedKeys.length !== Object.keys(plain).length) {
    throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'Record count changed');
  }
  for (const key of encryptedKeys) {
    let decrypted;
    try {
      decrypted = decryptRecord(dek, record[key], {accountHash, area, field: key});
    } catch (_) {
      decrypted = null;
    }
    if (!(key in plain) || decrypted !== plain[key]) {
      throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'A migrated record does not match');
    }
  }
};

const withoutAccount = (snapshot, accountHash) => {
  const users = parseStoredObject(snapshot[USER_DATA_STORAGE_INTERNAL_KEY], 'user');
  const personal = parseStoredObject(snapshot[PERSONAL_DATA_STORAGE_INTERNAL_KEY], 'personal data');
  const service = parseStoredObject(snapshot[SERVICE_STORAGE_INTERNAL_KEY], 'service data');
  delete personal[accountHash];
  delete service[accountHash];
  return JSON.stringify({
    users: {
      ...users,
      users: (users.users || []).filter(user => user.accountHash !== accountHash),
    },
    personal,
    service,
  });
};

// Checks the exact strings that will be written: the vault key unwraps again
// from the password with a fresh KDF run, every record decrypts to the legacy
// plaintext, and nothing outside this account changed.
const verifyMigrationSnapshot = async ({before, after, accountHash, password, dek, plain}) => {
  const usersRecord = parseStoredObject(after[USER_DATA_STORAGE_INTERNAL_KEY], 'user');
  const user = (usersRecord.users || []).find(candidate => candidate.accountHash === accountHash);
  if (user == null || user.vault == null) {
    throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'The migrated user has no vault');
  }

  let checkDek;
  try {
    checkDek = await unwrapVaultKey(password, accountHash, user.vault);
  } catch (_) {
    throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'The new vault does not open');
  }
  try {
    if (!checkDek.equals(dek)) {
      throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'The new vault key does not match');
    }
    assertRecordMatches(user.encryptedKeys, plain.keys, checkDek, accountHash, RECORD_AREA.SEED);
    const personal = parseStoredObject(after[PERSONAL_DATA_STORAGE_INTERNAL_KEY], 'personal data');
    const service = parseStoredObject(after[SERVICE_STORAGE_INTERNAL_KEY], 'service data');
    assertRecordMatches(personal[accountHash], plain.personal, checkDek, accountHash, RECORD_AREA.PERSONAL);
    assertRecordMatches(service[accountHash], plain.service, checkDek, accountHash, RECORD_AREA.SERVICE);
  } finally {
    checkDek.fill(0);
  }

  if (withoutAccount(before, accountHash) !== withoutAccount(after, accountHash)) {
    throw migrationError(VAULT_MIGRATION_ERROR.VERIFY, 'Data outside the account changed');
  }
};

// Debug builds only: lets a device test kill the app at one stage of the
// commit (see src/utils/vault/devMigrationPause.js). Release builds skip it.
const reachStage = async stage => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const {MIGRATION_PAUSE_STAGE, MIGRATION_PAUSE_MS} = require('../vault/devMigrationPause');
  if (MIGRATION_PAUSE_STAGE !== stage) return;
  console.warn(`VAULT_MIGRATION_PAUSED ${stage}`);
  await new Promise(resolve => setTimeout(resolve, MIGRATION_PAUSE_MS));
};

const migrateUserVaultTransaction = async (accountHash, password) => {
  await recoverPasswordMigrationUnlocked();

  const storedValues = await Promise.all(
    PASSWORD_MIGRATION_KEYS.map(key => SecureStorage.getItem(key)),
  );
  const before = PASSWORD_MIGRATION_KEYS.reduce((snapshot, key, index) => {
    snapshot[key] = storedValues[index];
    return snapshot;
  }, {});

  const usersRecord = parseStoredObject(before[USER_DATA_STORAGE_INTERNAL_KEY], 'user');
  const users = Array.isArray(usersRecord.users)
    ? usersRecord.users.map(user => ({...user}))
    : [];
  const userIndex = accountHash == null
    ? -1
    : users.findIndex(user => user.accountHash === accountHash);
  if (userIndex === -1) {
    throw migrationError(VAULT_MIGRATION_ERROR.NOT_FOUND, 'User not found');
  }

  const user = users[userIndex];
  if (user.vault != null) return {status: 'already', users: usersRecord.users};

  const personalRecord = parseStoredObject(before[PERSONAL_DATA_STORAGE_INTERNAL_KEY], 'personal data');
  const serviceRecord = parseStoredObject(before[SERVICE_STORAGE_INTERNAL_KEY], 'service data');

  // 1. Read every legacy record with the password. Plaintext stays in memory.
  const proof = {authenticated: false};
  const plain = {
    keys: decryptLegacyRecord(user.encryptedKeys || {}, password, 'account key', proof),
    personal: personalRecord[accountHash] != null
      ? decryptLegacyRecord(personalRecord[accountHash], password, 'personal data', proof)
      : {},
    service: serviceRecord[accountHash] != null
      ? decryptLegacyRecord(serviceRecord[accountHash], password, 'service data', proof)
      : {},
  };
  // Migrate only when the password is proven by a GCM tag. A wallet with only
  // CTR-era records (or none) stays legacy, which still opens as before.
  if (!proof.authenticated) {
    throw migrationError(VAULT_MIGRATION_ERROR.NOT_PROVEN, 'No authenticated legacy record');
  }

  // 2. New vault key, wrapped by a new password key; every record under it.
  const {vault, dek} = await createVault(password, accountHash);
  let committed = false;
  try {
    user.encryptedKeys = await encryptPlainRecord(user.encryptedKeys || {}, plain.keys, dek, accountHash, RECORD_AREA.SEED);
    user.vault = vault;
    if (personalRecord[accountHash] != null) {
      personalRecord[accountHash] = await encryptPlainRecord(personalRecord[accountHash], plain.personal, dek, accountHash, RECORD_AREA.PERSONAL);
    }
    if (serviceRecord[accountHash] != null) {
      serviceRecord[accountHash] = await encryptPlainRecord(serviceRecord[accountHash], plain.service, dek, accountHash, RECORD_AREA.SERVICE);
    }

    const after = {
      [USER_DATA_STORAGE_INTERNAL_KEY]: JSON.stringify({...usersRecord, users}),
      [PERSONAL_DATA_STORAGE_INTERNAL_KEY]: before[PERSONAL_DATA_STORAGE_INTERNAL_KEY] == null &&
        Object.keys(personalRecord).length === 0
        ? null
        : JSON.stringify(personalRecord),
      [SERVICE_STORAGE_INTERNAL_KEY]: before[SERVICE_STORAGE_INTERNAL_KEY] == null &&
        Object.keys(serviceRecord).length === 0
        ? null
        : JSON.stringify(serviceRecord),
    };

    // 3. Verify before commit. A mismatch aborts with nothing written.
    await verifyMigrationSnapshot({before, after, accountHash, password, dek, plain});
    await reachStage('verified');

    // 4. The existing journal: prepared (with the old data), apply, committed.
    const journal = {
      version: PASSWORD_MIGRATION_VERSION,
      accountHash,
      phase: "prepared",
      before,
      after,
    };
    const journalString = serializePreparedJournal(journal);

    try {
      await SecureStorage.setItem(
        PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
        journalString,
      );
      await reachStage('prepared');
      let appliedRoots = 0;
      await applyPasswordMigrationSnapshot(after, () =>
        reachStage(`applied-${++appliedRoots}`),
      );
      await SecureStorage.setItem(
        PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY,
        JSON.stringify(createCommittedJournalTombstone(journal)),
      );
      committed = true;
      await reachStage('committed');
    } catch (error) {
      if (!committed) {
        try {
          await applyPasswordMigrationSnapshot(before);
          await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
        } catch (_) {
          // Keep the prepared journal: startup recovery rolls back to `before`.
          console.warn('Vault migration rollback deferred to the next start');
        }
        throw error;
      }
    }

    try {
      await SecureStorage.removeItem(PASSWORD_MIGRATION_STORAGE_INTERNAL_KEY);
    } catch (_) {
      // The roots are final. Startup recovery only removes the marker.
      console.warn('Vault migration marker cleanup deferred to the next start');
    }

    const result = {status: 'migrated', users, user, dek: Buffer.from(dek)};
    return result;
  } finally {
    dek.fill(0);
  }
};

/**
 * Moves a legacy user to vault v2 with the password that just unlocked it.
 * Resolves { status: 'migrated', user, users, dek } or { status: 'already' }.
 * Rejects with a coded error when the migration cannot run; the stored data
 * is then the old data, unchanged, and the next unlock tries again.
 */
export const migrateUserVault = (accountHash, password) =>
  queuePasswordProtectedStorageMigration(() =>
    migrateUserVaultTransaction(accountHash, password),
  );

