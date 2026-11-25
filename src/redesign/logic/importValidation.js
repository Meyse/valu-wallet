// Checks for the import screens (R03, R03b, R03e, R03f).
// Nothing here derives keys. The result string is what the app later passes to
// createProfileFromSeed, exactly as the old import screens do.
import {validateMnemonic, wordlists} from 'bip39';
import {ECPair, networks} from '@bitgo/utxo-lib';

export const PHRASE_LENGTHS = [12, 15, 18, 21, 24];
export const WORD_SWITCH_LENGTHS = [12, 24];

const WORDLIST = wordlists.EN;
const WORDSET = new Set(WORDLIST);

export const normalizeWord = word => String(word ?? '').trim().toLowerCase();

export const isPhraseWord = word => WORDSET.has(normalizeWord(word));

// Suggestions for the focused slot: words that start with what the user typed.
export const suggestWords = (prefix, limit = 4) => {
  const clean = normalizeWord(prefix);
  if (clean.length < 2) return [];
  const out = [];
  for (const word of WORDLIST) {
    if (word.startsWith(clean)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
};

// Splits pasted text into words. Returns null when the count is not a phrase length.
export const parsePastedPhrase = text => {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeWord);
  return PHRASE_LENGTHS.includes(words.length) ? words : null;
};

// status: 'incomplete' | 'unknown-word' | 'checksum' | 'valid'
export const checkPhrase = words => {
  const clean = words.map(normalizeWord);
  const unknown = clean
    .map((word, index) => (word.length > 0 && !WORDSET.has(word) ? index : -1))
    .filter(index => index >= 0);

  if (unknown.length > 0) {
    return {status: 'unknown-word', unknownIndexes: unknown, phrase: null};
  }
  if (!PHRASE_LENGTHS.includes(clean.length) || clean.some(word => word.length === 0)) {
    return {status: 'incomplete', unknownIndexes: [], phrase: null};
  }
  const phrase = clean.join(' ');
  if (!validateMnemonic(phrase, WORDLIST)) {
    return {status: 'checksum', unknownIndexes: [], phrase: null};
  }
  return {status: 'valid', unknownIndexes: [], phrase};
};

// A private key is a WIF key for any network the wallet knows. Whitespace around a
// pasted key is not part of a WIF key, so it is removed.
export const checkPrivateKey = text => {
  const key = String(text ?? '').trim();
  if (key.length === 0) return {status: 'empty', key: null};
  try {
    ECPair.fromWIF(key, Object.values(networks));
    return {status: 'valid', key};
  } catch (e) {
    return {status: 'invalid', key: null};
  }
};

// A QR code can hold a recovery phrase or a private key.
export const classifyScannedText = text => {
  const words = parsePastedPhrase(text);
  if (words) {
    const result = checkPhrase(words);
    if (result.status === 'valid') return {kind: 'phrase', secret: result.phrase};
  }
  const key = checkPrivateKey(text);
  if (key.status === 'valid') return {kind: 'key', secret: key.key};
  return {kind: 'invalid', secret: null};
};
