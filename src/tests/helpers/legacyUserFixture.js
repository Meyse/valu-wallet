// Writes a user record in the pre-vault (legacy) format, as the app on main
// stores it: each seed is encryptkey(password, seed), and there is no
// `vault` block. Use it to test wallets that exist on phones today.
const { USER_DATA_STORAGE_INTERNAL_KEY } = require('../../../env/index');
const {
  CHANNELS_NULL_TEMPLATE,
  WYRE_SERVICE,
} = require('../../utils/constants/intervalConstants');
const { WYRE_SERVICE_ID } = require('../../utils/constants/services');
const { hashAccountId } = require('../../utils/crypto/hash');
const { SecureStorage } = require('../../utils/keychain/secureStore');
const { encryptkey } = require('../../utils/seedCrypt');

const storeLegacyUser = async ({ userName, password, seeds, biometry = false }) => {
  const encryptedKeys = { ...CHANNELS_NULL_TEMPLATE };
  for (const seedType of Object.keys(seeds)) {
    if (seeds[seedType]) {
      encryptedKeys[seedType] = await encryptkey(password, seeds[seedType]);
    }
  }
  const user = {
    id: userName,
    accountHash: hashAccountId(userName),
    encryptedKeys,
    biometry: !!biometry,
    hideSeedWarnings: false,
    keyDerivationVersion: 0,
    disabledServices: encryptedKeys[WYRE_SERVICE] ? {} : { [WYRE_SERVICE_ID]: true },
    testnetOverrides: undefined,
  };
  const raw = await SecureStorage.getItem(USER_DATA_STORAGE_INTERNAL_KEY);
  const record = raw ? JSON.parse(raw) : {};
  const users = Array.isArray(record.users) ? record.users.slice() : [];
  users.push(user);
  await SecureStorage.setItem(
    USER_DATA_STORAGE_INTERNAL_KEY,
    JSON.stringify({ ...record, users }),
  );
  return users;
};

module.exports = { storeLegacyUser };
