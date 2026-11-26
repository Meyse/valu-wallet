// In-memory cache of the unlocked vault key (DEK) for the active session.
//
// The DEK is never written to storage, Redux or logs. It is bound to the
// account hash and to the session key of the login that unlocked it, so a
// later login, account switch or session-key change can never read it. Sign
// out wipes it (sagas/authentication.js).
import { Buffer } from 'buffer';

let entry = null; // { accountHash, sessionKey, dek }

const wipe = () => {
  if (entry && Buffer.isBuffer(entry.dek)) entry.dek.fill(0);
  entry = null;
};

export const setSessionVaultKey = (accountHash, sessionKey, dek) => {
  wipe();
  if (accountHash == null || sessionKey == null || !Buffer.isBuffer(dek)) return;
  // Keep a private copy so wiping it never zeroes a caller's buffer.
  entry = { accountHash, sessionKey, dek: Buffer.from(dek) };
};

// Returns a copy of the DEK when it belongs to the given session, else null.
export const getSessionVaultKey = (accountHash, sessionKey) => {
  if (
    entry == null ||
    accountHash == null ||
    sessionKey == null ||
    entry.accountHash !== accountHash ||
    entry.sessionKey !== sessionKey
  ) {
    return null;
  }
  return Buffer.from(entry.dek);
};

export const clearSessionVaultKey = () => {
  wipe();
};
