// Builds src/tests/helpers/vaultGolden.json from the format in
// docs (plan A3) with Node's crypto only. It shares no code with
// src/utils/crypto/envelope.js, so the fixture checks the format, not just
// the encoder. Inputs are fixed test values, not secrets. Needs Node >= 24.7.
// Run: node scripts/make-vault-golden.js > src/tests/helpers/vaultGolden.json
const crypto = require('crypto');

const password = 'golden test password';
const accountHash = 'goldenaccounthash0001';
const salt = Buffer.alloc(16, 0x11);
const wrapNonce = Buffer.alloc(12, 0x22);
const dek = Buffer.alloc(32, 0x33);
const recordNonce = Buffer.alloc(12, 0x44);
const recordPlaintext = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
const kdf = { id: 'argon2id', ver: 19, m: 65536, t: 3, p: 1, salt: salt.toString('base64') };

const gcm = (key, nonce, pt, aad) => {
  const c = crypto.createCipheriv('aes-256-gcm', key, nonce);
  if (aad) c.setAAD(aad);
  return Buffer.concat([c.update(pt), c.final(), c.getAuthTag()]);
};

const kek = crypto.argon2Sync('argon2id', {
  message: Buffer.from(password, 'utf8'), nonce: salt, parallelism: 1, tagLength: 32, memory: 65536, passes: 3,
});
const aad = Buffer.from(['valu-vault-v2', accountHash, 'argon2id', '19', '65536', '3', '1', kdf.salt].join('|'), 'utf8');
const vault = { v: 2, kdf, wrap: { id: 'aes-256-gcm', nonce: wrapNonce.toString('base64'), ct: gcm(kek, wrapNonce, dek, aad).toString('base64') } };
const record = 'v2.' + Buffer.concat([recordNonce, gcm(dek, recordNonce, Buffer.from(recordPlaintext, 'utf8'))]).toString('base64');

// Cloud backup file, PBKDF2 variant to cover the second adapter.
const bSalt = Buffer.alloc(16, 0x55);
const bNonce = Buffer.alloc(12, 0x66);
const bKdf = { id: 'pbkdf2-sha256', iter: 600000, salt: bSalt.toString('base64') };
const header = Buffer.from(JSON.stringify({ v: 1, createdAt: '2026-11-26T12:00:00Z', backupId: '00112233445566778899aabbccddeeff', kdf: bKdf, cipher: { id: 'aes-256-gcm', nonce: bNonce.toString('base64') } }), 'utf8');
const bKey = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), bSalt, 600000, 32, 'sha256');
const bPlain = JSON.stringify({ seed: recordPlaintext, channel: 'electrum' });
const backup = {
  format: 'valu-wallet-backup',
  header: header.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  ct: gcm(bKey, bNonce, Buffer.from(bPlain, 'utf8'), header).toString('base64'),
};

process.stdout.write(JSON.stringify({
  note: 'Fixed test inputs; see scripts/make-vault-golden.js. Not a real wallet.',
  password, accountHash, dekHex: dek.toString('hex'), recordPlaintext, vault, record, backup, backupPlaintext: bPlain,
}, null, 2) + '\n');
