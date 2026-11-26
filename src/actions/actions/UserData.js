import {
  setAccounts,
  signOut,
  updateAccountKeys,
  authenticateUser,
} from '../actionCreators';
import {
  storeUser,
  getActiveCoinList,
  resetUserPwd,
  addEncryptedKeyToUser,
  deleteUser,
  setUserBiometry,
  setUserKeyDerivationVersion,
  setUserDisabledServices,
  setUserTestnetOverrides,
  setUserHideSeedWarnings,
  updateUsers,
  unlockUserVault,
  migrateUserVault,
} from '../../utils/asyncStore/asyncStore';
import {passwordFailsRule} from '../../utils/auth/passwordRule';
import {convertLegacyAttestationRecords} from '../../utils/vault/attestationVaultMigration';
import {deriveKeyPair} from '../../utils/keys';
import {vaultDecrypt, vaultEncrypt} from '../../utils/seedCrypt';
import {hashAccountId} from '../../utils/crypto/hash';
import {
  CHANNELS,
  ELECTRUM,
  ERC20,
  ETH,
  DLIGHT_PRIVATE,
  IS_PBAAS,
  VRPC,
  WYRE_SERVICE,
} from '../../utils/constants/intervalConstants';
import {
  KEY_DERIVATION_VERSION,
  SERVICES_DISABLED_DEFAULT,
} from '../../../env/index';
import {
  BIOMETRIC_AUTH,
  HIDE_SEED_WARNINGS,
  SET_ACCOUNTS,
  UPDATE_ACCOUNT_DISABLED_SERVICES,
  UPDATE_ACCOUNT_TESTNET_OVERRIDES,
} from '../../utils/constants/storeType';
import {removeExistingCoin} from './coins/Coins';
import {
  initSession,
  requestSeeds,
  requestVaultKey,
} from '../../utils/auth/authBox';
import {
  captureAccountTeardownContext,
  clearActiveAccountLifecycles,
} from './account/dispatchers/account';
import {WYRE_SERVICE_ID} from '../../utils/constants/services';
import store from '../../store';
import {
  captureSessionScope,
  scopeSessionAction,
  sessionScopeIsCurrent,
} from './updates/sessionRequests';
import {removeSessionCredential} from '../../utils/keychain/keychain';
import {
  clearDlightTeardownSeed,
} from '../../utils/dlightTeardownSeed';

const getRequestSessionScope = requestContext =>
  requestContext?.sessionScope ||
  (requestContext?.sessionScoped ? requestContext : null) ||
  captureSessionScope(store.getState());

const assertRequestSessionCurrent = (sessionScope, requestContext) => {
  if (
    requestContext?.signal?.aborted === true ||
    !sessionScopeIsCurrent(store.getState(), sessionScope)
  ) {
    const error = new Error(
      'Account changed while wallet keys were being generated.',
    );
    error.code = 'SESSION_CHANGED';
    throw error;
  }
};

export const addUser = async (
  userName,
  seeds,
  password,
  users,
  biometry = false,
  keyDerivationVersion = KEY_DERIVATION_VERSION,
  disabledServices = SERVICES_DISABLED_DEFAULT,
  testnetOverrides = {},
) => {
  const sessionScope = captureSessionScope(store.getState());
  const res = await storeUser(
    {
      seeds,
      password,
      userName,
      biometry,
      keyDerivationVersion,
      disabledServices,
      testnetOverrides,
    },
    users,
  )

  return scopeSessionAction(setAccounts(res), sessionScope);
};

export const resetPwd = (accountHash, newPwd, oldPwd) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    resetUserPwd(accountHash, newPwd, oldPwd, sessionScope)
      .then(res => {
        if (res) {
          const postResetSessionScope = captureSessionScope(
            store.getState(),
            accountHash,
          );

          if (
            postResetSessionScope.sessionEpoch !==
              sessionScope.sessionEpoch + 1 ||
            !sessionScopeIsCurrent(store.getState(), postResetSessionScope)
          ) {
            throw new Error(
              'Account changed while the password reset was in progress.',
            );
          }

          resolve(scopeSessionAction({
            type: BIOMETRIC_AUTH,
            payload: {
              biometry: false,
              accountHash,
              accounts: res,
            },
          }, postResetSessionScope));
        } else {
          resolve(false);
        }
      })
      .catch(err => reject(err));
  });
};

export const addEncryptedKey = (accountHash, channel, seed, password) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    addEncryptedKeyToUser(accountHash, channel, seed, password)
      .then(res => {
        if (res) {
          resolve(scopeSessionAction(setAccounts(res), sessionScope));
        } else {
          resolve(false);
        }
      })
      .catch(err => reject(err));
  });
};

export const setBiometry = (accountHash, biometry) => {
  return new Promise((resolve, reject) => {
    setUserBiometry(accountHash, biometry)
      .then(accounts => {
        // Biometry is persisted account metadata, not active-session data. The
        // reducer only updates activeAccount when this hash is actually active.
        resolve({
          type: BIOMETRIC_AUTH,
          payload: {biometry, accountHash, accounts},
        });
      })
      .catch(err => reject(err));
  });
};

export const setHideSeedWarnings = (accountHash, hideSeedWarnings) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    setUserHideSeedWarnings(accountHash, hideSeedWarnings)
      .then(accounts => {
        resolve(scopeSessionAction({
          type: HIDE_SEED_WARNINGS,
          payload: {hideSeedWarnings, accountHash, accounts},
        }, sessionScope));
      })
      .catch(err => reject(err));
  });
};

// Requires user to logout and log back in
export const setKeyDerivationVersion = async (accountHash, keyDerivationVersion) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    setUserKeyDerivationVersion(accountHash, keyDerivationVersion)
      .then(accounts => {
        resolve(scopeSessionAction({
          type: SET_ACCOUNTS,
          payload: {accounts},
        }, sessionScope));
      })
      .catch(err => reject(err));
  });
};

export const setDisabledServices = async (accountHash, disabledServices) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    setUserDisabledServices(accountHash, disabledServices)
      .then(accounts => {
        resolve(scopeSessionAction({
          type: UPDATE_ACCOUNT_DISABLED_SERVICES,
          payload: {disabledServices, accountHash, accounts},
        }, sessionScope));
      })
      .catch(err => reject(err));
  });
};

export const setTestnetOverrides = async (accountHash, testnetOverrides) => {
  const sessionScope = captureSessionScope(store.getState(), accountHash);

  return new Promise((resolve, reject) => {
    setUserTestnetOverrides(accountHash, testnetOverrides)
      .then(accounts => {
        resolve(scopeSessionAction({
          type: UPDATE_ACCOUNT_TESTNET_OVERRIDES,
          payload: {testnetOverrides, accountHash, accounts},
        }, sessionScope));
      })
      .catch(err => reject(err));
  });
};

export const deleteProfile = async (account, dispatch) => {
  const sessionScope = captureSessionScope(
    store.getState(),
    account.accountHash,
  );
  const dispatchForAccount = action =>
    dispatch(scopeSessionAction(action, sessionScope));
  let dlightSeed = null;

  if (!sessionScopeIsCurrent(store.getState(), sessionScope)) {
    const error = new Error(
      'Account changed while preparing to delete the profile.',
    );
    error.code = 'SESSION_CHANGED';
    throw error;
  }

  const teardownContext = captureAccountTeardownContext({
    account,
    sessionScope,
    clearDb: true,
  });
  const needsDlightErase = teardownContext.activeCoinsForUser.some(coin =>
    (coin.compatible_channels || []).includes(DLIGHT_PRIVATE),
  );
  if (
    needsDlightErase &&
    account.seeds?.[DLIGHT_PRIVATE] != null
  ) {
    dlightSeed = (await requestSeeds())[DLIGHT_PRIVATE];
    if (!sessionScopeIsCurrent(store.getState(), sessionScope)) {
      dlightSeed = null;
      const error = new Error(
        'Account changed while preparing to delete the profile.',
      );
      error.code = 'SESSION_CHANGED';
      throw error;
    }
  }

  let teardownError = null;

  // Close/erase every native resource using the profile owner's captured
  // accountHash. This remains targeted even if another profile signs in.
  try {
    try {
      const lifecycleTeardown = clearActiveAccountLifecycles(
        teardownContext,
        dlightSeed,
      );
      // The lifecycle queue now owns a DLight-only holder. Do not retain a
      // duplicate plaintext reference in this generic profile-deletion frame.
      dlightSeed = null;
      await lifecycleTeardown;
    } catch (error) {
      teardownError = error;
      console.warn(error);
    }

    try {
      await removeExistingCoin(
        null,
        account.id,
        dispatchForAccount,
        true,
        {...teardownContext, skipTeardown: true},
      );
    } catch (error) {
      teardownError = error;
      console.warn(error);
    }
  } finally {
    clearDlightTeardownSeed(teardownContext);
    dlightSeed = null;

    if (!teardownError) {
      const remainingAccounts = await deleteUser(account.accountHash);

      try {
        dispatchForAccount(setAccounts(remainingAccounts));
      } catch (error) {
        console.warn(error);
      }
    } else {
      throw teardownError;
    }
  }

  return;
};

export const fetchUsers = async () => {
  const users = await updateUsers(storedUsers => {
    let nextUsers = storedUsers;

    // Update for new user representation post v0.2.0 while the user-root
    // exclusion queue covers both the read and the eventual write.
    if (
      nextUsers.some(value => value.encryptedKeys == null && value.encryptedKey)
    ) {
      console.warn('Updating users to key structure post v0.2.0');

      nextUsers = nextUsers.map(user => {
        if (user.encryptedKeys == null && user.encryptedKey) {
          return {
            id: user.id,
            accountHash: hashAccountId(user.id),
            encryptedKeys: {
              [ELECTRUM]: user.encryptedKey,
            },
            biometry: false,
            keyDerivationVersion:
              user.keyDerivationVersion == null
                ? 0
                : user.keyDerivationVersion,
            disabledServices:
              user.disabledServices == null ? {} : user.disabledServices,
            testnetOverrides:
              user.testnetOverrides == null ? {} : user.testnetOverrides,
          };
        }

        return user;
      });
    }

    // Update testnet overrides to include ETH in the same queued transaction.
    if (
      nextUsers.some(
        value =>
          value.testnetOverrides != null &&
          value.testnetOverrides.hasOwnProperty('VRSC') &&
          !value.testnetOverrides.hasOwnProperty('ETH'),
      )
    ) {
      console.warn('Updating testnet profile to account for goerli ETH');

      nextUsers = nextUsers.map(user => {
        if (
          user.testnetOverrides != null &&
          user.testnetOverrides.hasOwnProperty('VRSC') &&
          !user.testnetOverrides.hasOwnProperty('ETH')
        ) {
          return {
            ...user,
            testnetOverrides: {...user.testnetOverrides, ETH: 'GETH'},
          };
        }

        return user;
      });
    }

    return nextUsers;
  });

  return setAccounts(users);
};

// `dek` is the unlocked vault key of a v2 account (null for legacy). The
// resolved action carries it as `vaultKey`; initializeAccountData moves it into
// the in-memory session cache and never dispatches it to Redux.
export const authenticateAccount = async (
  account,
  password,
  deferSessionInitialization = false,
  dek = null,
) => {
  let _keys = {};

  let seeds = account.encryptedKeys;
  if (account.vault != null && dek == null) {
    throw new Error('The vault key is required for this account');
  }
  const vaultKey = {password, dek};

  return new Promise((resolve, reject) => {
    getActiveCoinList()
      .then(async activeCoins => {
        for (let i = 0; i < activeCoins.length; i++) {
          if (activeCoins[i].users.includes(account.id)) {
            _keys[activeCoins[i].id] = {};

            for (const channel of CHANNELS) {
             if (
                (activeCoins[i].compatible_channels.includes(channel) &&
                  seeds[channel]) ||
                (channel === DLIGHT_PRIVATE &&
                  seeds[DLIGHT_PRIVATE] &&
                  activeCoins[i].testnet &&
                  activeCoins[i].tags &&
                  activeCoins[i].tags.includes(IS_PBAAS)) ||
                channel === ETH ||
                channel === ERC20 ||
                channel === VRPC
              ) {
                try {
                  const seedChannel =
                    channel === ETH || channel === ERC20 || channel === VRPC
                      ? ELECTRUM
                      : channel;

                  if (seeds[seedChannel] == null) throw new Error('No seed for channel ' + seedChannel);

                  const decryptedSeed = vaultDecrypt(vaultKey, seeds[seedChannel]);

                  if (!decryptedSeed) throw new Error('Failed to decrypt seed for channel ' + seedChannel);

                  const keyObj = await deriveKeyPair(
                    decryptedSeed,
                    activeCoins[i],
                    channel,
                    account.keyDerivationVersion == null
                      ? 0
                      : account.keyDerivationVersion,
                  );

                  _keys[activeCoins[i].id][channel] = {
                    pubKey: keyObj.pubKey,
                    encryptedPrivKey: await vaultEncrypt(
                      vaultKey,
                      keyObj.privKey,
                    ),
                    encryptedViewingKey:
                      keyObj.viewingKey == null
                        ? null
                        : await vaultEncrypt(vaultKey, keyObj.viewingKey),
                    addresses: keyObj.addresses,
                  };
                } catch (e) {
                  console.warn(
                    `Key generation failed for ${activeCoins[i].display_ticker} channel ${channel}`,
                  );
                  console.warn(e);
                }
              }
            }
          }
        }

        const activeAccount = {
              id: account.id,
              accountHash: account.accountHash
                ? account.accountHash
                : hashAccountId(account.id),
              seeds,
              keys: _keys,
              paymentMethods: {},
              biometry: account.biometry ? true : false,
              hideSeedWarnings: !!(account.hideSeedWarnings),
              keyDerivationVersion:
                account.keyDerivationVersion == null
                  ? 0
                  : account.keyDerivationVersion,
              disabledServices:
                account.disabledServices == null
                  ? account.encryptedKeys && account.encryptedKeys[WYRE_SERVICE]
                    ? {}
                    : {[WYRE_SERVICE_ID]: true}
                  : account.disabledServices,
              testnetOverrides:
                account.testnetOverrides == null
                  ? {}
                  : account.testnetOverrides,
              // Not secret: tells authBox that this account needs its DEK.
              vaultVersion: account.vault != null ? account.vault.v : null,
              passwordFailsRule: passwordFailsRule(password),
            };

        let sessionKey = null;
        let sessionCredentialMutationStarted = false;

        try {
          if (!deferSessionInitialization) {
            sessionCredentialMutationStarted = true;
            sessionKey = await initSession(password);
          }

          resolve({...authenticateUser(activeAccount, sessionKey), vaultKey: dek});
        } catch (sessionError) {
          if (sessionCredentialMutationStarted) {
            try {
              await removeSessionCredential();
            } catch (credentialError) {
              console.warn(credentialError);
            }
            store.dispatch(signOut());
          }

          throw sessionError;
        }
      })
      .catch(err => reject(err));
  });
};

// Moves a legacy account to vault v2 after a successful unlock. A failure
// never blocks the unlock: the stored data is still the old data, and the next
// unlock tries again. Only the error code is logged.
const migrateAfterUnlock = async (user, password) => {
  if (user.vault != null) return null;
  if (user.accountHash == null) {
    console.warn('Vault migration skipped: VAULT_MIGRATION_NO_ACCOUNT_HASH');
    return null;
  }
  try {
    const result = await migrateUserVault(user.accountHash, password);
    if (result.status === 'already') {
      // Another unlock migrated this user after our read. Read it again so the
      // session uses the stored v2 records and the vault key.
      const again = await unlockUserVault(password, user.id, false, false);
      store.dispatch(setAccounts(result.users));
      return {user: again.user, dek: again.dek};
    }
    if (result.status !== 'migrated') return null;
    store.dispatch(setAccounts(result.users));
    return result;
  } catch (error) {
    console.warn(`Vault migration failed: ${error?.code || error?.name || 'unknown'}`);
    return null;
  }
};

export const validateLogin = async (
  account,
  password,
  deferSessionInitialization = false,
  alertOnFail = true,
) => {
  try {
    const unlocked = await unlockUserVault(password, account.id, alertOnFail, true);
    let user = unlocked.user;
    let dek = unlocked.dek;

    const migrated = await migrateAfterUnlock(user, password);
    if (migrated != null) {
      user = migrated.user;
      dek = migrated.dek;
    }

    if (dek != null) {
      await convertLegacyAttestationRecords(user.accountHash, password, dek);
    }

    return await authenticateAccount(
      {...account, ...user},
      password,
      deferSessionInitialization,
      dek,
    );
  } catch (err) {
    console.warn(err);
    throw err;
  }
};

export const addKeypairs = async (
  coinObj,
  keys,
  derivationVersion = KEY_DERIVATION_VERSION,
  requestContext = null,
) => {
  const sessionScope = getRequestSessionScope(requestContext);
  const assertCurrent = () =>
    assertRequestSessionCurrent(sessionScope, requestContext);
  assertCurrent();
  let keypairs = {};
  const coinID = coinObj.id;
  const vaultKey = await requestVaultKey(sessionScope);
  assertCurrent();
  const accountSeeds = await requestSeeds();
  assertCurrent();

  for (const seedType of CHANNELS) {
    assertCurrent();
    const seed = accountSeeds[seedType]
      ? accountSeeds[seedType]
      : accountSeeds[ELECTRUM];

    if (!seed) throw new Error('No seed found for account');
    
    if (
      (coinObj.compatible_channels.includes(seedType) &&
      (seedType !== DLIGHT_PRIVATE || accountSeeds[seedType])) ||
      (seedType === DLIGHT_PRIVATE &&
        accountSeeds[DLIGHT_PRIVATE] &&
        coinObj.testnet &&
        coinObj.tags &&
        coinObj.tags.includes(IS_PBAAS))
    ) {
      const keyObj = await deriveKeyPair(
        seed,
        coinObj,
        seedType,
        derivationVersion,
      );
      assertCurrent();

      keypairs[seedType] = {
        pubKey: keyObj.pubKey,
        encryptedPrivKey: await vaultEncrypt(vaultKey, keyObj.privKey),
        encryptedViewingKey:
          keyObj.viewingKey == null
            ? null
            : await vaultEncrypt(vaultKey, keyObj.viewingKey),
        addresses: keyObj.addresses,
      };
      assertCurrent();
    }
  }

  assertCurrent();
  return scopeSessionAction(
    updateAccountKeys({...keys, [coinID]: keypairs}),
    sessionScope,
  );
};
