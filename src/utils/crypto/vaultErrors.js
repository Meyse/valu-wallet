// Error codes for the password vault and its envelope. Messages never contain
// key material, passwords or record contents.
export const VAULT_ERROR = Object.freeze({
  FORMAT: 'VAULT_FORMAT', // Malformed envelope or record.
  UNSUPPORTED: 'VAULT_UNSUPPORTED', // Unknown version or KDF id: update the app.
  PARAMS: 'VAULT_KDF_PARAMS', // KDF parameters out of the accepted bounds.
  WRONG_PASSWORD: 'VAULT_WRONG_PASSWORD', // Key wrap tag check failed.
  RECORD_AUTH: 'VAULT_RECORD_AUTH', // Record tag check failed.
  NO_KEY: 'VAULT_NO_KEY', // A v2 record needs the vault key and none is available.
});

export class VaultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

export const isVaultError = (error, code) =>
  error instanceof VaultError && (code == null || error.code === code);
