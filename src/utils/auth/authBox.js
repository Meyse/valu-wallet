// This is where you can retrieve private keys and seeds,
// provided you pass the required authentication checks
// This only works if a user is logged in

import store from "../../store";
import { CHANNELS, ELECTRUM, VALU_SERVICE } from "../constants/intervalConstants";
import { randomBytes } from "../crypto/randomBytes";
import { getSessionCredential, setSessionCredential } from "../keychain/keychain";
import { arrayToObject } from "../objectManip";
import { decryptkey, encryptkey, vaultDecrypt } from "../seedCrypt";
import { getSessionVaultKey, setSessionVaultKey } from "../vault/vaultSession";
import { isV2Record, unwrapVaultKey } from "../crypto/envelope";

const getRequestSessionScope = requestContext =>
  requestContext?.sessionScope ||
  (requestContext?.sessionScoped ? requestContext : null);

const sessionScopeIsCurrent = (state, sessionScope) => {
  if (sessionScope == null) return true;

  const activeAccountHash =
    state.authentication.activeAccount == null
      ? null
      : state.authentication.activeAccount.accountHash;

  return (
    sessionScope.sessionScoped === true &&
    sessionScope.accountHash === activeAccountHash &&
    sessionScope.sessionEpoch === (state.authentication.sessionEpoch || 0)
  );
};

const assertRequestSessionCurrent = (sessionScope, message) => {
  if (sessionScopeIsCurrent(store.getState(), sessionScope)) return;

  const error = new Error(message);
  error.code = 'SESSION_CHANGED';
  throw error;
};

const requestPasswordForState = async (
  state,
  sessionScope = null,
  sessionError = 'Account changed while the password was being requested.',
) => {
  if (
    state.authentication.activeAccount == null ||
    state.authentication.sessionKey == null
  ) {
    throw new Error("You must be signed in to retrieve sensitive info");
  }

  const sessionPass = await getSessionCredential();
  assertRequestSessionCurrent(sessionScope, sessionError);
  const password = decryptkey(state.authentication.sessionKey, sessionPass);

  if (password !== false) return password;

  throw new Error("Unable to decrypt sensitive info");
};

// Returns { password, dek } for the active account. A v2 account always gets
// its DEK: from the session cache, or (if the cache was lost) by unwrapping
// the stored vault again. A legacy account gets dek = null. Callers pass the
// result to vaultEncrypt / vaultDecrypt.
const requestVaultKeyForState = async (
  state,
  sessionScope = null,
  sessionError = 'Account changed while the vault key was being requested.',
) => {
  const password = await requestPasswordForState(state, sessionScope, sessionError);
  const {activeAccount, sessionKey} = state.authentication;

  if (activeAccount.vaultVersion == null) return {password, dek: null};

  const cached = getSessionVaultKey(activeAccount.accountHash, sessionKey);
  if (cached != null) return {password, dek: cached};

  // Lazy require: authDataStorage imports this module.
  const {getUsers} = require('../asyncStore/authDataStorage');
  const user = (await getUsers()).find(
    candidate => candidate.accountHash === activeAccount.accountHash,
  );
  if (user == null || user.vault == null) {
    throw new Error("Unable to load the wallet vault");
  }
  const dek = await unwrapVaultKey(password, user.accountHash, user.vault);
  // The KDF takes time. Never return the key when the session changed while
  // it ran (sign-out, account switch, new login), even for an unscoped call.
  const current = store.getState().authentication;
  if (
    current.activeAccount?.accountHash !== activeAccount.accountHash ||
    current.sessionKey !== sessionKey ||
    !sessionScopeIsCurrent(store.getState(), sessionScope)
  ) {
    dek.fill(0);
    const error = new Error(sessionError);
    error.code = 'SESSION_CHANGED';
    throw error;
  }
  setSessionVaultKey(activeAccount.accountHash, sessionKey, dek);
  return {password, dek};
};

// `password` is an explicit (old) password for a legacy record. As before
// vault v2, it reads that record without the session. A v2 record always
// needs the session vault key.
const recordVaultKeyForState = async (state, record, password) =>
  password && !isV2Record(record)
    ? {password, dek: null}
    : requestVaultKeyForState(state);

export const requestVaultKey = async (requestContext = null) =>
  requestVaultKeyForState(
    store.getState(),
    getRequestSessionScope(requestContext),
  );

// Saves the session password to the keychain and returns the 
// session key
export const initSession = async (password) => {
  const sessionKey = (await randomBytes(32)).toString('hex')
  const sessionPass = await encryptkey(sessionKey, password)
  await setSessionCredential(sessionPass)

  return sessionKey
}

export const initInstance = async () => {
  return (await randomBytes(32)).toString('hex')
}

export const requestPassword = async (requestContext = null) => {
  return requestPasswordForState(
    store.getState(),
    getRequestSessionScope(requestContext),
  );
}

export const requestSeeds = async () => {
  const state = store.getState()

  if (
    state.authentication.activeAccount == null
  ) {
    throw new Error("You must be signed in to retrieve seeds");
  } else {
    const vaultKey = await requestVaultKeyForState(state)
    let seeds = arrayToObject(
      CHANNELS,
      (acc, key) => {
        if (state.authentication.activeAccount.seeds[key]) {
          const seed = vaultDecrypt(vaultKey, state.authentication.activeAccount.seeds[key]);

          if (!seed) {
            throw new Error("Unable to decrypt seed");
          } else return seed;
        } else return null;
      },
      true
    );

    // The Valu service never had its own onboarding/import step for most
    // users, it piggybacks on the wallet's primary seed unless a distinct
    // valu_service seed was explicitly linked (see ValuServiceIntroSlider).
    if (seeds[VALU_SERVICE] == null) {
      seeds[VALU_SERVICE] = seeds[ELECTRUM] || null;
    }

    return seeds;
  }
}

export const requestPrivKey = async (
  chainTicker,
  channel,
  requestContext = null,
) => {
  const sessionScope = getRequestSessionScope(requestContext);
  const sessionError =
    "Account changed while the private key was being requested.";

  assertRequestSessionCurrent(sessionScope, sessionError);
  const state = store.getState()

  if (
    state.authentication.activeAccount == null
  ) {
    throw new Error("You must be signed in to retrieve keys");
  } else {
    if (
      state.authentication.activeAccount.keys[chainTicker] == null ||
      state.authentication.activeAccount.keys[chainTicker][channel] == null
    ) {
      throw new Error(
        `Could not get ${chainTicker} key for channel ${channel}, either channel isn't supported or coin is inactive`
      );
    } else {
      // Bind both encrypted inputs to the account snapshot that was validated
      // above. requestPasswordForState must not re-read a newly active account
      // while its Keychain request is pending.
      const encryptedPrivKey =
        state.authentication.activeAccount.keys[chainTicker][channel]
          .encryptedPrivKey;
      const vaultKey = await requestVaultKeyForState(
        state,
        sessionScope,
        sessionError,
      )

      assertRequestSessionCurrent(sessionScope, sessionError);
      const key = vaultDecrypt(vaultKey, encryptedPrivKey)
      
      if (key !== false) {
        assertRequestSessionCurrent(sessionScope, sessionError);
        return key
      } else {
        throw new Error("Unable to decrypt key");
      }
    }
  }
}

export const requestViewingKey = async (chainTicker, channel) => {
  const state = store.getState()

  if (
    state.authentication.activeAccount == null
  ) {
    throw new Error("You must be signed in to retrieve viewing keys");
  } else {
    if (
      state.authentication.activeAccount.keys[chainTicker] == null ||
      state.authentication.activeAccount.keys[chainTicker][channel] == null
    ) {
      throw new Error(
        `Could not get ${chainTicker} viewing key for channel ${channel}, either channel isn't supported or coin is inactive`
      );
    } else {
      if (
        state.authentication.activeAccount.keys[chainTicker][channel]
          .encryptedViewingKey == null
      ) {
        throw new Error(
          `${channel} is not a channel that contains a viewing key, or the viewing key isn't loaded`
        );
      }

      const vaultKey = await requestVaultKeyForState(state)
      const key = vaultDecrypt(vaultKey, state.authentication.activeAccount.keys[chainTicker][channel]
        .encryptedViewingKey)
      
      if (key !== false) {
        return key
      } else {
        throw new Error("Unable to decrypt viewing key");
      }
    }
  }
}

export const requestPersonalData = async (dataType, _password) => {
  const state = store.getState()

  if (
    state.authentication.activeAccount == null
  ) {
    throw new Error("You must be signed in to retrieve personal data");
  } else if (state.personal[dataType] == null) {
    return {}
  } else {
    const vaultKey = await recordVaultKeyForState(state, state.personal[dataType], _password);
    const data = vaultDecrypt(vaultKey, state.personal[dataType]);
    
    if (data !== false) {
      try {
        return JSON.parse(data)
      } catch(e) {
        throw new Error("Unable to parse personal data")
      }
    } else {
      throw new Error("Unable to decrypt personal data");
    }
  }
}

export const requestServiceStoredData = async (service, _password) => {
  const state = store.getState();

  if (state.authentication.activeAccount == null) {
    throw new Error(
      "You must be signed in to retrieve service stored data for " + service
    );
  } else if (state.services.stored[service] == null) {
    return {};
  } else {
    const vaultKey = await recordVaultKeyForState(state, state.services.stored[service], _password);
    const data = vaultDecrypt(vaultKey, state.services.stored[service]);

    if (data !== false) {
      try {
        return JSON.parse(data);
      } catch (e) {
        throw new Error("Unable to parse service stored data for " + service);
      }
    } else {
      throw new Error("Unable to decrypt service stored data for " + service);
    }
  }
};

export const requestAttestationData = async (dataType) => {
  const state = store.getState()

  if (
    state.authentication.activeAccount == null
  ) {
    throw new Error("You must be signed in to retrieve attestation data");
  } else if (state.attestation[dataType] == null) {
    return {}
  } else {
    const vaultKey = await requestVaultKeyForState(state)
    const data = vaultDecrypt(vaultKey, state.attestation[dataType])
    
    if (data !== false) {
      try {
        return JSON.parse(data)
      } catch(e) {
        console.error('Failed to parse decrypted attestation data:', e.message);
        console.error('Decrypted data preview:', data.substring(0, 500) + '...');
        throw new Error(`Unable to parse attestation data: ${e.message}`)
      }
    } else {
      throw new Error("Unable to decrypt attestation data - incorrect password or corrupted data");
    }
  }
}