// Versioned envelopes for the password vault (format v2) and the cloud backup
// file. See ~/dev/valu-wallet-qa/cloud-backup-plan/plan.md A3.
//
// Vault: a random 32-byte vault key (DEK) encrypts every record. The password
// key (KEK, from kdf.js) only wraps the DEK with AES-256-GCM:
//   user.vault = { v: 2, kdf: {...}, wrap: { id, nonce, ct } }
//   AAD = "valu-vault-v2|" + accountHash + "|" + KDF fields in fixed order
// Records: "v2." + base64(nonce12 || ciphertext || tag16) under the DEK. The
// "." is not in the base64 alphabet, so a legacy record can never carry the
// prefix.
import crypto from 'react-native-crypto';
import { Buffer } from 'buffer';
import { randomBytes } from './randomBytes';
import {
  createKdfParams,
  decodeBase64Strict,
  deriveKey,
  kdfAadFields,
  KDF_SALT_BYTES,
  validateKdfParams,
} from './kdf';
import { VaultError, VAULT_ERROR } from './vaultErrors';

export const VAULT_VERSION = 2;
export const RECORD_PREFIX = 'v2.';
export const DEK_BYTES = 32;
const CIPHER_ID = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const WRAP_AAD_PREFIX = 'valu-vault-v2';

// ---------------------------------------------------------------------------
// AES-256-GCM primitive

const assertKey = key => {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'An AES-256 key must be 32 bytes');
  }
};

export const gcmEncrypt = (key, nonce, plaintext, aad) => {
  assertKey(key);
  const cipher = crypto.createCipheriv(CIPHER_ID, key, nonce);
  if (aad != null) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([ct, cipher.getAuthTag()]);
};

// Returns the plaintext Buffer, or null when the tag check fails.
export const gcmDecrypt = (key, nonce, ctAndTag, aad) => {
  assertKey(key);
  if (ctAndTag.length < TAG_BYTES) return null;
  const ct = ctAndTag.subarray(0, ctAndTag.length - TAG_BYTES);
  const tag = ctAndTag.subarray(ctAndTag.length - TAG_BYTES);
  try {
    const decipher = crypto.createDecipheriv(CIPHER_ID, key, nonce);
    if (aad != null) decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (_) {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Records under the DEK

export const isV2Record = value =>
  typeof value === 'string' && value.startsWith(RECORD_PREFIX);

export const encryptRecord = async (dek, plaintext) => {
  if (typeof plaintext !== 'string') {
    throw new VaultError(VAULT_ERROR.FORMAT, 'A vault record must be a string');
  }
  const nonce = await randomBytes(NONCE_BYTES);
  const body = gcmEncrypt(dek, nonce, Buffer.from(plaintext, 'utf8'));
  return RECORD_PREFIX + Buffer.concat([nonce, body]).toString('base64');
};

// Returns the plaintext string. Throws VaultError on a malformed record or a
// failed tag check; never returns partial data.
export const decryptRecord = (dek, value) => {
  if (!isV2Record(value)) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Not a v2 vault record');
  }
  const blob = decodeBase64Strict(value.slice(RECORD_PREFIX.length), 'vault record');
  if (blob.length < NONCE_BYTES + TAG_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Vault record is too short');
  }
  const pt = gcmDecrypt(dek, blob.subarray(0, NONCE_BYTES), blob.subarray(NONCE_BYTES));
  if (pt == null) {
    throw new VaultError(VAULT_ERROR.RECORD_AUTH, 'Vault record failed authentication');
  }
  return pt.toString('utf8');
};

// ---------------------------------------------------------------------------
// The vault block (user.vault)

export const vaultWrapAad = (accountHash, kdf) => {
  if (typeof accountHash !== 'string' || accountHash.length === 0 || accountHash.includes('|')) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid account hash for the vault');
  }
  return Buffer.from([WRAP_AAD_PREFIX, accountHash, ...kdfAadFields(kdf)].join('|'), 'utf8');
};

// Structure and bounds check. Runs before any KDF work.
export const validateVault = vault => {
  if (vault == null || typeof vault !== 'object' || Array.isArray(vault)) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Missing vault block');
  }
  if (vault.v !== VAULT_VERSION) {
    throw new VaultError(
      VAULT_ERROR.UNSUPPORTED,
      'This wallet uses a vault version that this app version does not know. Update the app.',
    );
  }
  validateKdfParams(vault.kdf);
  const wrap = vault.wrap;
  if (wrap == null || typeof wrap !== 'object' || wrap.id !== CIPHER_ID) {
    throw new VaultError(VAULT_ERROR.UNSUPPORTED, 'Unsupported vault key wrap');
  }
  const nonce = decodeBase64Strict(wrap.nonce, 'vault wrap nonce');
  const ct = decodeBase64Strict(wrap.ct, 'vault wrap');
  if (nonce.length !== NONCE_BYTES || ct.length !== DEK_BYTES + TAG_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid vault wrap length');
  }
  return { nonce, ct };
};

const wrapDek = async (dek, kek, accountHash, kdf) => {
  const nonce = await randomBytes(NONCE_BYTES);
  const ct = gcmEncrypt(kek, nonce, dek, vaultWrapAad(accountHash, kdf));
  return {
    v: VAULT_VERSION,
    kdf,
    wrap: { id: CIPHER_ID, nonce: nonce.toString('base64'), ct: ct.toString('base64') },
  };
};

// Wraps an existing DEK under a new password key with a new salt. Used for a
// new vault and for a password change (no record is re-encrypted).
export const wrapVaultKey = async (dek, password, accountHash, kdfId) => {
  if (!Buffer.isBuffer(dek) || dek.length !== DEK_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'A vault key must be 32 bytes');
  }
  const kdf = createKdfParams(await randomBytes(KDF_SALT_BYTES), kdfId);
  const kek = await deriveKey(password, kdf);
  try {
    return await wrapDek(dek, kek, accountHash, kdf);
  } finally {
    kek.fill(0);
  }
};

export const createVault = async (password, accountHash, kdfId) => {
  const dek = await randomBytes(DEK_BYTES);
  const vault = await wrapVaultKey(dek, password, accountHash, kdfId);
  return { vault, dek };
};

// Returns the DEK. Throws VaultError WRONG_PASSWORD when the tag check fails,
// or FORMAT / UNSUPPORTED / PARAMS before any KDF work for a bad block.
export const unwrapVaultKey = async (password, accountHash, vault) => {
  const { nonce, ct } = validateVault(vault);
  const aad = vaultWrapAad(accountHash, vault.kdf);
  const kek = await deriveKey(password, vault.kdf);
  try {
    const dek = gcmDecrypt(kek, nonce, ct, aad);
    if (dek == null || dek.length !== DEK_BYTES) {
      throw new VaultError(VAULT_ERROR.WRONG_PASSWORD, 'Incorrect password');
    }
    return dek;
  } finally {
    kek.fill(0);
  }
};

// ---------------------------------------------------------------------------
// Cloud backup file (plan A3). The exact header bytes are the GCM associated
// data, so any header edit fails the tag check.

export const BACKUP_FORMAT = 'valu-wallet-backup';
export const BACKUP_VERSION = 1;
const HEADER_MAX_BYTES = 4096;
const BACKUP_CT_MAX_BYTES = 64 * 1024;

const toBase64Url = buf =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value, what) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new VaultError(VAULT_ERROR.FORMAT, `Invalid ${what}`);
  }
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return decodeBase64Strict(b64 + '='.repeat((4 - (b64.length % 4)) % 4), what);
};

export const sealBackupFile = async ({ password, plaintext, backupId, createdAt, kdfId }) => {
  if (typeof backupId !== 'string' || !/^[0-9a-f]{32}$/.test(backupId)) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'backupId must be 16 bytes as hex');
  }
  const kdf = createKdfParams(await randomBytes(KDF_SALT_BYTES), kdfId);
  const nonce = await randomBytes(NONCE_BYTES);
  const headerBytes = Buffer.from(
    JSON.stringify({
      v: BACKUP_VERSION,
      createdAt,
      backupId,
      kdf,
      cipher: { id: CIPHER_ID, nonce: nonce.toString('base64') },
    }),
    'utf8',
  );
  const key = await deriveKey(password, kdf);
  try {
    const ct = gcmEncrypt(key, nonce, Buffer.from(plaintext, 'utf8'), headerBytes);
    return { format: BACKUP_FORMAT, header: toBase64Url(headerBytes), ct: ct.toString('base64') };
  } finally {
    key.fill(0);
  }
};

// Parses and checks the file without running the KDF. Returns the header and
// the raw parts that openBackupFile needs.
export const parseBackupFile = file => {
  if (file == null || typeof file !== 'object' || file.format !== BACKUP_FORMAT) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Not a Valu Wallet backup file');
  }
  const headerBytes = fromBase64Url(file.header, 'backup header');
  if (headerBytes.length === 0 || headerBytes.length > HEADER_MAX_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid backup header length');
  }
  let header;
  try {
    header = JSON.parse(headerBytes.toString('utf8'));
  } catch (_) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid backup header');
  }
  if (header == null || typeof header !== 'object' || header.v !== BACKUP_VERSION) {
    throw new VaultError(VAULT_ERROR.UNSUPPORTED, 'Unknown backup version. Update the app.');
  }
  validateKdfParams(header.kdf);
  if (header.cipher == null || header.cipher.id !== CIPHER_ID) {
    throw new VaultError(VAULT_ERROR.UNSUPPORTED, 'Unsupported backup cipher');
  }
  const nonce = decodeBase64Strict(header.cipher.nonce, 'backup nonce');
  if (nonce.length !== NONCE_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid backup nonce length');
  }
  const ct = decodeBase64Strict(file.ct, 'backup ciphertext');
  if (ct.length < TAG_BYTES || ct.length > BACKUP_CT_MAX_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Invalid backup ciphertext length');
  }
  return { header, headerBytes, nonce, ct };
};

// Returns { header, plaintext }. A failed tag check is WRONG_PASSWORD; every
// other failure is FORMAT or UNSUPPORTED ("This backup is damaged").
export const openBackupFile = async (file, password) => {
  const { header, headerBytes, nonce, ct } = parseBackupFile(file);
  const key = await deriveKey(password, header.kdf);
  try {
    const pt = gcmDecrypt(key, nonce, ct, headerBytes);
    if (pt == null) {
      throw new VaultError(VAULT_ERROR.WRONG_PASSWORD, 'Incorrect backup password');
    }
    return { header, plaintext: pt.toString('utf8') };
  } finally {
    key.fill(0);
  }
};
