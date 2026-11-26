// Jest stand-in for the native module: the same argon2 / pbkdf2 callback API,
// backed by Node (or @noble/hashes on Node versions without crypto.argon2).
const backend = require('../src/tests/helpers/nodeKdfBackend');
const { Buffer } = require('buffer');

module.exports = {
  argon2: (algorithm, p, callback) => {
    if (algorithm !== 'argon2id') {
      callback(new Error('Only argon2id is mocked'));
      return;
    }
    backend
      .argon2id({
        password: Buffer.from(p.message),
        salt: Buffer.from(p.nonce),
        memoryKiB: p.memory,
        passes: p.passes,
        parallelism: p.parallelism,
        outputBytes: p.tagLength,
        secret: p.secret ? Buffer.from(p.secret) : undefined,
        associatedData: p.associatedData ? Buffer.from(p.associatedData) : undefined,
      })
      .then(out => callback(null, out), err => callback(err));
  },
  pbkdf2: (password, salt, iterations, keylen, digest, callback) => {
    require('crypto').pbkdf2(Buffer.from(password), Buffer.from(salt), iterations, keylen, digest, callback);
  },
};
