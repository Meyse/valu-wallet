// Opens a stored v2 user record the same way an unlock does: unwrap the vault
// key with the password, then decrypt the record. Returns false when the
// password does not open it, like decryptkey.
const { decryptRecord, unwrapVaultKey } = require('../../utils/crypto/envelope');

const openStoredSeed = async (password, user, channel) => {
  try {
    const dek = await unwrapVaultKey(password, user.accountHash, user.vault);
    return decryptRecord(dek, user.encryptedKeys[channel]);
  } catch (error) {
    return false;
  }
};

module.exports = { openStoredSeed };
