// Node stand-in for the native KDF backend (src/utils/crypto/kdfNative.js).
// Node 24.7+ has crypto.argon2 (OpenSSL). Node 22 (.nvmrc) does not, so the
// pure-JS @noble/hashes Argon2id serves there; both give the RFC 9106 output.
const nodeCrypto = require('crypto');
const { Buffer } = require('buffer');

const argon2id = ({ password, salt, memoryKiB, passes, parallelism, outputBytes, secret, associatedData }) => {
  if (typeof nodeCrypto.argon2 === 'function') {
    return new Promise((resolve, reject) =>
      nodeCrypto.argon2(
        'argon2id',
        {
          message: password,
          nonce: salt,
          parallelism,
          tagLength: outputBytes,
          memory: memoryKiB,
          passes,
          ...(secret ? { secret } : {}),
          ...(associatedData ? { associatedData } : {}),
        },
        (err, out) => (err ? reject(err) : resolve(Buffer.from(out))),
      ),
    );
  }
  const { argon2idAsync } = require('@noble/hashes/argon2');
  return argon2idAsync(password, salt, {
    t: passes,
    m: memoryKiB,
    p: parallelism,
    dkLen: outputBytes,
    ...(secret ? { key: secret } : {}),
    ...(associatedData ? { personalization: associatedData } : {}),
  }).then(out => Buffer.from(out));
};

const pbkdf2Sha256 = ({ password, salt, iterations, outputBytes }) =>
  new Promise((resolve, reject) =>
    nodeCrypto.pbkdf2(password, salt, iterations, outputBytes, 'sha256', (err, out) =>
      err ? reject(err) : resolve(Buffer.from(out)),
    ),
  );

module.exports = { argon2id, pbkdf2Sha256 };
