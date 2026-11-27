// Password key derivation for the vault and the cloud backup file.
//
// The algorithm id and every parameter live in the stored data (the `kdf`
// block of an envelope), never only in code. `deriveKey` checks the block
// against fixed bounds before any work starts, so a crafted envelope cannot
// make the app allocate gigabytes or spin for minutes.
//
// Each adapter owns: its bounds check, its default parameters for new data,
// the fixed-order field list that goes into associated data, and the call to
// the native backend. Changing the choice for new data is one value
// (DEFAULT_KDF_ID); old data keeps working because it names its own adapter.
import { Buffer } from 'buffer';
import { VaultError, VAULT_ERROR } from './vaultErrors';

export const KDF_OUTPUT_BYTES = 32;
export const KDF_SALT_BYTES = 16;
const SALT_MIN_BYTES = 16;
const SALT_MAX_BYTES = 64;
const ARGON2_VERSION_13 = 19;

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// Strict base64 decode: Buffer.from silently skips bad characters.
export const decodeBase64Strict = (value, what) => {
  if (typeof value !== 'string' || !BASE64_RE.test(value)) {
    throw new VaultError(VAULT_ERROR.FORMAT, `Invalid ${what}`);
  }
  return Buffer.from(value, 'base64');
};

const isIntInRange = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

const requireInt = (value, min, max, what) => {
  if (!isIntInRange(value, min, max)) {
    throw new VaultError(VAULT_ERROR.PARAMS, `${what} is out of range`);
  }
};

const requireExactKeys = (kdf, keys) => {
  const actual = Object.keys(kdf).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Unexpected KDF fields');
  }
};

const decodeSalt = kdf => {
  const salt = decodeBase64Strict(kdf.salt, 'KDF salt');
  if (salt.length < SALT_MIN_BYTES || salt.length > SALT_MAX_BYTES) {
    throw new VaultError(VAULT_ERROR.PARAMS, 'KDF salt length is out of range');
  }
  return salt;
};

const argon2id = {
  id: 'argon2id',
  // Plan A3 bounds: m 8 MiB to 256 MiB, t 1 to 10, p 1 to 4, salt 16 to 64 bytes.
  validate(kdf) {
    requireExactKeys(kdf, ['id', 'ver', 'm', 't', 'p', 'salt']);
    if (kdf.ver !== ARGON2_VERSION_13) {
      throw new VaultError(VAULT_ERROR.UNSUPPORTED, 'Unsupported Argon2 version');
    }
    requireInt(kdf.m, 8 * 1024, 256 * 1024, 'Argon2 memory');
    requireInt(kdf.t, 1, 10, 'Argon2 passes');
    requireInt(kdf.p, 1, 4, 'Argon2 parallelism');
    decodeSalt(kdf);
  },
  // Working choice (decision record 2): m = 64 MiB, t = 3, p = 1.
  defaults: () => ({ ver: ARGON2_VERSION_13, m: 65536, t: 3, p: 1 }),
  aadFields: kdf => [kdf.id, kdf.ver, kdf.m, kdf.t, kdf.p, kdf.salt],
  derive: (backend, password, kdf) =>
    backend.argon2id({
      password,
      salt: decodeSalt(kdf),
      memoryKiB: kdf.m,
      passes: kdf.t,
      parallelism: kdf.p,
      outputBytes: KDF_OUTPUT_BYTES,
    }),
};

const pbkdf2Sha256 = {
  id: 'pbkdf2-sha256',
  // Plan A3 bounds: 100,000 to 2,000,000 iterations.
  validate(kdf) {
    requireExactKeys(kdf, ['id', 'iter', 'salt']);
    requireInt(kdf.iter, 100000, 2000000, 'PBKDF2 iterations');
    decodeSalt(kdf);
  },
  defaults: () => ({ iter: 600000 }),
  aadFields: kdf => [kdf.id, kdf.iter, kdf.salt],
  derive: (backend, password, kdf) =>
    backend.pbkdf2Sha256({
      password,
      salt: decodeSalt(kdf),
      iterations: kdf.iter,
      outputBytes: KDF_OUTPUT_BYTES,
    }),
};

const ADAPTERS = Object.freeze({
  [argon2id.id]: argon2id,
  [pbkdf2Sha256.id]: pbkdf2Sha256,
});

export const KDF_IDS = Object.freeze(Object.keys(ADAPTERS));

// The one place that picks the KDF for new vaults and backup files.
export const DEFAULT_KDF_ID = argon2id.id;

let backendOverride = null;

// The native backend loads lazily so this module stays importable in code
// paths and tests that never derive a key.
const getBackend = () => {
  if (backendOverride) return backendOverride;
  return require('./kdfNative').default;
};

// Tests and the on-device known-answer check use this to pick a backend.
export const setKdfBackend = backend => {
  backendOverride = backend;
};

const getAdapter = kdf => {
  if (kdf == null || typeof kdf !== 'object' || Array.isArray(kdf)) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'Missing KDF block');
  }
  if (typeof kdf.id !== 'string' || !Object.prototype.hasOwnProperty.call(ADAPTERS, kdf.id)) {
    throw new VaultError(
      VAULT_ERROR.UNSUPPORTED,
      'This data uses a key derivation that this app version does not know. Update the app.',
    );
  }
  return ADAPTERS[kdf.id];
};

// Throws a VaultError when the block is unknown, malformed or out of bounds.
export const validateKdfParams = kdf => {
  getAdapter(kdf).validate(kdf);
};

export const kdfAadFields = kdf => {
  const adapter = getAdapter(kdf);
  adapter.validate(kdf);
  return adapter.aadFields(kdf).map(String);
};

// Builds a new KDF block with a fresh salt for the given adapter.
export const createKdfParams = (salt, id = DEFAULT_KDF_ID) => {
  const adapter = getAdapter({ id });
  if (!Buffer.isBuffer(salt) || salt.length !== KDF_SALT_BYTES) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'A new KDF salt must be 16 bytes');
  }
  const kdf = { id, ...adapter.defaults(), salt: salt.toString('base64') };
  adapter.validate(kdf);
  return kdf;
};

const toPasswordBuffer = password => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new VaultError(VAULT_ERROR.FORMAT, 'A password is required');
  }
  // The legacy key hashed the same UTF-8 bytes; no normalization is applied.
  return Buffer.from(password, 'utf8');
};

// Derives the 32-byte key. Bounds are checked before the backend runs.
export const deriveKey = async (password, kdf) => {
  const adapter = getAdapter(kdf);
  adapter.validate(kdf);
  const passwordBytes = toPasswordBuffer(password);
  try {
    const out = Buffer.from(await adapter.derive(getBackend(), passwordBytes, kdf));
    if (out.length !== KDF_OUTPUT_BYTES) {
      throw new Error('KDF backend returned a key of the wrong length');
    }
    return out;
  } finally {
    passwordBytes.fill(0);
  }
};
