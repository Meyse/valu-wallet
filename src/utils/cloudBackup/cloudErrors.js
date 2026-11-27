// Error codes of the cloud stores and the backup service. Messages are fixed text: they never
// hold a path, a password, file contents or a seed, so an error can be shown or reported as is.
import {isVaultError, VAULT_ERROR} from '../crypto/vaultErrors';

export const CLOUD_ERROR = Object.freeze({
  OFF: 'CLOUD_OFF', // iCloud Drive off or signed out; no Google account access.
  UNSUPPORTED: 'CLOUD_UNSUPPORTED', // Not set up in this build (config.js) or no store module.
  CANCELLED: 'CLOUD_CANCELLED', // The user closed the account or consent screen.
  UNREACHABLE: 'CLOUD_UNREACHABLE', // Network, quota or write failure.
  NOT_FOUND: 'CLOUD_NOT_FOUND', // The file is not in the store.
  VERIFY: 'CLOUD_VERIFY', // The file read back does not open to the same seed.
  NO_BACKUP: 'CLOUD_NO_BACKUP', // The store has no Valu backup file.
  DAMAGED: 'CLOUD_DAMAGED', // A file is there, but it is not a valid backup.
});

export class CloudError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'CloudError';
    this.code = code;
  }
}

export const isCloudError = (error, code) =>
  error instanceof CloudError && (code == null || error.code === code);

// What the restore and save screens show. One value per state in Paper:
// 'wrong-password'  Import iCloud 03 state - Wrong password (the GCM tag check failed)
// 'damaged'         the file is there but malformed or out of bounds ("This backup is damaged")
// 'update-app'      unknown version or KDF: a newer app made it
// 'no-backup'       Import 02 state - No backup found
// 'off'             iCloud Drive is off (Backup 04 state), or no Google account access
// 'cancelled'       the user closed the Google consent screen: back to the sheet, no message
// 'unreachable'     Backup 06 state - Not saved (or the read failed on restore)
export const cloudErrorKind = error => {
  if (isVaultError(error, VAULT_ERROR.WRONG_PASSWORD)) return 'wrong-password';
  if (isVaultError(error, VAULT_ERROR.UNSUPPORTED)) return 'update-app';
  if (isVaultError(error)) return 'damaged';
  if (isCloudError(error, CLOUD_ERROR.DAMAGED)) return 'damaged';
  if (isCloudError(error, CLOUD_ERROR.NO_BACKUP) || isCloudError(error, CLOUD_ERROR.NOT_FOUND)) return 'no-backup';
  if (isCloudError(error, CLOUD_ERROR.OFF) || isCloudError(error, CLOUD_ERROR.UNSUPPORTED)) return 'off';
  if (isCloudError(error, CLOUD_ERROR.CANCELLED)) return 'cancelled';
  return 'unreachable';
};
