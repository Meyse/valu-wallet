import aes256 from './crypto/aes256';
import { decryptRecord, encryptRecord, isV2Record } from './crypto/envelope';

// TODO: check pin strength

export const encryptkey = async (cipherKey, string) => {
  // test pin security
  // - at least 1 char in upper case
  // - at least 1 digit
  // - at least one special character
  // - min length 8

  // const _pinTest = _pin.match('^(?=.*[A-Z])(?=.*[^<>{}\"/|;:.,~!?@#$%^=&*\\]\\\\()\\[_+]*$)(?=.*[0-9])(?=.*[a-z]).{8}$');
  const encryptedString = await aes256.encrypt(cipherKey, string);

  return encryptedString;
}

export const decryptkey = (cipherKey, string) => {
  try {
    const decryptedKey = aes256.decrypt(cipherKey, string);

    return decryptedKey;
  } catch (error) {
    if (error.message == 'Unsupported state or unable to authenticate data') return legacy_decryptkey(cipherKey, string)
    else return false
  }
}

export const legacy_decryptkey = (cipherKey, string) => {
  const decryptedKey = aes256.legacy_decrypt(cipherKey, string);

  // test if stored encrypted passphrase is decrypted correctly
  // if not then the key is wrong
  const _regexTest = decryptedKey.match(/^[0-9a-zA-Z ]+$/g);

  return !_regexTest ? false : decryptedKey;
}

export const decryptGeneral = (cipherKey, string) => (
  aes256.decrypt(cipherKey, string)
)

// Vault v2 records. A vault key is { password, dek }: `dek` is the unlocked
// vault key of a v2 account (see utils/vault/vaultSession.js), `password` the
// account password. A v2 record ("v2." prefix) needs the DEK. A legacy record
// keeps the old password reader. Writes use the DEK when the account has one,
// so a v2 account never gets a new legacy record.
export const vaultEncrypt = async (vaultKey, string) => {
  if (vaultKey != null && vaultKey.dek != null) {
    return encryptRecord(vaultKey.dek, string);
  }
  if (vaultKey == null || typeof vaultKey.password !== 'string') {
    throw new Error('A vault key is required to encrypt');
  }
  return encryptkey(vaultKey.password, string);
};

// Returns the plaintext, or false like decryptkey.
export const vaultDecrypt = (vaultKey, string) => {
  if (isV2Record(string)) {
    if (vaultKey == null || vaultKey.dek == null) return false;
    try {
      return decryptRecord(vaultKey.dek, string);
    } catch (_) {
      return false;
    }
  }
  if (vaultKey == null || typeof vaultKey.password !== 'string') return false;
  return decryptkey(vaultKey.password, string);
};
