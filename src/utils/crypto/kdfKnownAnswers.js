// Known-answer vectors, copied from the named primary sources (checked
// 2026-11-26). Jest and the on-device self-test (kdfSelfTest.js) use them.
// Do not regenerate these values with app code.
export const KDF_KNOWN_ANSWERS = Object.freeze({
  argon2id: [
    {
      // RFC 9106 section 5.3 (https://www.rfc-editor.org/rfc/rfc9106.txt).
      name: 'RFC 9106 5.3 (m=32 KiB, t=3, p=4, secret, associated data)',
      m: 32, t: 3, p: 4,
      password: '0101010101010101010101010101010101010101010101010101010101010101',
      salt: '02020202020202020202020202020202',
      secret: '0303030303030303',
      ad: '040404040404040404040404',
      expected: '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659',
    },
    {
      // phc-winner-argon2 src/test.c, argon2id v0x13: hashtest(2, 16, 1, "password", "somesalt").
      name: 'phc test.c (t=2, m=2^16 KiB, p=1)',
      m: 65536, t: 2, p: 1,
      password: '70617373776f7264', // "password"
      salt: '736f6d6573616c74', // "somesalt"
      expected: '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7',
    },
    {
      // phc-winner-argon2 src/test.c, argon2id v0x13: hashtest(1, 16, 1, "password", "somesalt").
      name: 'phc test.c (t=1, m=2^16 KiB, p=1)',
      m: 65536, t: 1, p: 1,
      password: '70617373776f7264',
      salt: '736f6d6573616c74',
      expected: 'f6a5adc1ba723dddef9b5ac1d464e180fcd9dffc9d1cbf76cca2fed795d9ca98',
    },
    {
      // phc-winner-argon2 src/test.c, argon2id v0x13: hashtest(2, 16, 1, "differentpassword", "somesalt").
      name: 'phc test.c (t=2, m=2^16 KiB, p=1, differentpassword)',
      m: 65536, t: 2, p: 1,
      password: '646966666572656e7470617373776f7264', // "differentpassword"
      salt: '736f6d6573616c74',
      expected: '0b84d652cf6b0c4beaef0dfe278ba6a80df6696281d7e0d2891b817d8c458fde',
    },
  ],
  pbkdf2Sha256: [
    {
      // RFC 7914 section 11 (https://www.rfc-editor.org/rfc/rfc7914.txt).
      name: 'RFC 7914 11 (P="passwd", S="salt", c=1, dkLen=64)',
      password: 'passwd', salt: 'salt', c: 1,
      expected: '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
    },
    {
      // RFC 7914 section 11.
      name: 'RFC 7914 11 (P="Password", S="NaCl", c=80000, dkLen=64)',
      password: 'Password', salt: 'NaCl', c: 80000,
      expected: '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d',
    },
  ],
  aes256gcm: [
    {
      // NIST CAVP gcmEncryptExtIV256.rsp, [Keylen=256][IVlen=96][PTlen=128][AADlen=128][Taglen=128] Count = 0
      // (https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/mac/gcmtestvectors.zip).
      name: 'NIST CAVP gcmEncryptExtIV256 Keylen 256, IVlen 96, PTlen 128, AADlen 128, Count 0',
      key: '92e11dcdaa866f5ce790fd24501f92509aacf4cb8b1339d50c9c1240935dd08b',
      iv: 'ac93a1a6145299bde902f21a',
      pt: '2d71bcfa914e4ac045b2aa60955fad24',
      aad: '1e0889016f67601c8ebea4943bc23ad6',
      ct: '8995ae2e6df3dbf96fac7b7137bae67f',
      tag: 'eca5aa77d51d4a0a14d9c51e1da474ab',
    },
  ],
});
