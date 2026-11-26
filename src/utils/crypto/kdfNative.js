// Native KDF backend: react-native-quick-crypto (Nitro/JSI, OpenSSL 3.6).
// Imported by name only. The global `crypto` stays mapped to
// react-native-crypto; quick-crypto's install() is never called.
//
// Both calls use the async API, which runs on a native worker thread, so a
// 64 MiB Argon2id run does not block the JS thread (measured in WP0).
// Inputs are copied into plain Uint8Arrays, and results are copied into the
// app's Buffer class, because quick-crypto uses its own Buffer implementation.
import { argon2, pbkdf2 } from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

const bytes = value => Uint8Array.from(value);

const argon2id = ({ password, salt, memoryKiB, passes, parallelism, outputBytes, secret, associatedData }) =>
  new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: bytes(password),
        nonce: bytes(salt),
        parallelism,
        tagLength: outputBytes,
        memory: memoryKiB,
        passes,
        version: 0x13,
        ...(secret ? { secret: bytes(secret) } : {}),
        ...(associatedData ? { associatedData: bytes(associatedData) } : {}),
      },
      (err, out) => (err ? reject(err) : resolve(Buffer.from(out))),
    );
  });

const pbkdf2Sha256 = ({ password, salt, iterations, outputBytes }) =>
  new Promise((resolve, reject) => {
    pbkdf2(bytes(password), bytes(salt), iterations, outputBytes, 'sha256', (err, out) =>
      err ? reject(err) : resolve(Buffer.from(out)),
    );
  });

export default { argon2id, pbkdf2Sha256 };
