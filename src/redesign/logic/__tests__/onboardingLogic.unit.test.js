import {placeWords} from '../importValidation';
import {getPasswordGate, getPasswordStrength} from '../password';
import {createVerifyQuestions, findVerifyMismatches} from '../verify';
import {
  checkPhrase,
  checkPrivateKey,
  classifyScannedText,
  parsePastedPhrase,
} from '../importValidation';
import {nextRoute, progressFor, ROUTES} from '../steps';

// Public BIP39 test vectors (trezor/python-mnemonic vectors.json). Not wallets of anyone.
const VECTOR_12 =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';
const VECTOR_24 =
  'legal winner thank year wave sausage worth useful legal winner thank year ' +
  'wave sausage worth useful legal winner thank year wave sausage worth title';
// Public example WIF from the Bitcoin wiki "Wallet import format" page.
const EXAMPLE_WIF = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';

describe('password gate (score 65 and match)', () => {
  // Expected scores are worked by hand from scorePassword: 5 points per first use of a
  // character, plus 10 per character class after the first.
  it('rates a 9-character password with 3 classes at exactly 65 as Fair', () => {
    const s = getPasswordStrength('abcdefg1!'); // 9 x 5 + 2 x 10 = 65
    expect(s.score).toBe(65);
    expect(s.label).toBe('Fair');
    expect(s.strongEnough).toBe(true);
  });

  it('blocks a password under score 65', () => {
    const s = getPasswordStrength('abcdefgh'); // 8 x 5 + 0 = 40
    expect(s.label).toBe('Weak');
    expect(getPasswordGate('abcdefgh', 'abcdefgh')).toMatchObject({
      error: 'weak',
      canContinue: false,
    });
  });

  it('gives 0 under the minimum length of 7', () => {
    expect(getPasswordStrength('Ab1!').score).toBe(0);
  });

  it('rates 75 as Good and 95 as Strong', () => {
    expect(getPasswordStrength('Abcdefg1!').label).toBe('Good'); // 45 + 30
    expect(getPasswordStrength('Abcdefgh1!xyz').label).toBe('Strong'); // 65 + 30
  });

  it('needs the confirmation to match before Continue turns on', () => {
    expect(getPasswordGate('Abcdefg1!', '')).toMatchObject({error: null, canContinue: false});
    expect(getPasswordGate('Abcdefg1!', 'Abcdefg1')).toMatchObject({
      error: 'mismatch',
      canContinue: false,
    });
    expect(getPasswordGate('Abcdefg1!', 'Abcdefg1!')).toMatchObject({
      error: null,
      canContinue: true,
    });
  });
});

describe('verify questions', () => {
  const words = VECTOR_24.split(' ');
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  it('asks one position from each third with 4 different choices that include the answer', () => {
    const questions = createVerifyQuestions(words, random);
    expect(questions).toHaveLength(3);
    questions.forEach((q, part) => {
      expect(q.index).toBeGreaterThanOrEqual(part * 8);
      expect(q.index).toBeLessThan((part + 1) * 8);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(words[q.index]);
    });
  });

  it('marks only the wrong picks', () => {
    const questions = createVerifyQuestions(words, random);
    const picks = questions.map(q => words[q.index]);
    expect(findVerifyMismatches(words, questions, picks)).toEqual([false, false, false]);
    const wrong = questions[1].options.find(o => o !== words[questions[1].index]);
    picks[1] = wrong;
    expect(findVerifyMismatches(words, questions, picks)).toEqual([false, true, false]);
  });
});

describe('phrase and key checks', () => {
  it('accepts the 12- and 24-word test vectors', () => {
    expect(checkPhrase(VECTOR_12.split(' '))).toEqual({
      status: 'valid',
      unknownIndexes: [],
      phrase: VECTOR_12,
    });
    expect(checkPhrase(VECTOR_24.split(' ')).status).toBe('valid');
  });

  it('names the slot of a word that is not in the BIP39 list', () => {
    const words = VECTOR_12.split(' ');
    words[4] = 'wavy';
    expect(checkPhrase(words)).toMatchObject({status: 'unknown-word', unknownIndexes: [4]});
  });

  it('rejects a phrase with a bad checksum and an unfinished phrase', () => {
    const words = VECTOR_12.split(' ');
    words[11] = 'year';
    expect(checkPhrase(words).status).toBe('checksum');
    expect(checkPhrase([...VECTOR_12.split(' ').slice(0, 11), '']).status).toBe('incomplete');
  });

  it('reads a pasted phrase of a valid length, with any spacing and case', () => {
    expect(parsePastedPhrase(`  ${VECTOR_12.toUpperCase().replace(/ /g, '\n ')} `)).toEqual(
      VECTOR_12.split(' '),
    );
    expect(parsePastedPhrase('legal winner thank')).toBeNull();
  });

  it('accepts a WIF private key and rejects a changed one', () => {
    expect(checkPrivateKey(` ${EXAMPLE_WIF}\n`)).toEqual({status: 'valid', key: EXAMPLE_WIF});
    expect(checkPrivateKey(EXAMPLE_WIF.slice(0, -1) + 'K').status).toBe('invalid');
    expect(checkPrivateKey('   ').status).toBe('empty');
  });

  it('sorts a scanned QR text into phrase, key or invalid', () => {
    expect(classifyScannedText(VECTOR_12).kind).toBe('phrase');
    expect(classifyScannedText(EXAMPLE_WIF).kind).toBe('key');
    expect(classifyScannedText('https://example.com').kind).toBe('invalid');
  });
});

describe('step order', () => {
  it('create: password, Face ID, creating, with no recovery phrase step (round 5)', () => {
    const order = [ROUTES.welcome];
    let r = ROUTES.welcome;
    while ((r = nextRoute('create', r))) order.push(r);
    expect(order).toEqual(['Welcome', 'CreatePassword', 'UseFaceId', 'Creating']);
  });

  it('import: phrase first, then password and Face ID; key and QR join at the password', () => {
    expect(nextRoute('import', ROUTES.welcome)).toBe('ImportPhrase');
    expect(nextRoute('import', ROUTES.importPhrase)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.importKey)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.scanQr)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.password)).toBe('UseFaceId');
    expect(nextRoute('import', ROUTES.faceId)).toBe('Creating');
  });

  it('skips Face ID when the device has no biometry', () => {
    expect(nextRoute('create', ROUTES.password, {biometry: false})).toBe('Creating');
    expect(nextRoute('import', ROUTES.password, {biometry: false})).toBe('Creating');
  });

  it('shows the password step as 2 of 3 on import and 1 of 2 on create (Paper bar 50 %)', () => {
    expect(progressFor('import', ROUTES.password)).toEqual([2, 3]);
    expect(progressFor('create', ROUTES.password)).toEqual([1, 2]);
  });
});

describe('placeWords', () => {
  const empty = n => Array(n).fill('');

  it('ends a typed word with a space and moves to the next slot', () => {
    expect(placeWords(empty(12), 0, 'legal ')).toEqual({words: ['legal', ...empty(11)], focus: 1});
  });

  it('spreads a partial paste over the next slots', () => {
    const r = placeWords(empty(12), 10, 'winner thank');
    expect(r.words.slice(10)).toEqual(['winner', 'thank']);
  });

  it('refuses a paste with more words than the slots left, so no word is dropped', () => {
    // 23 words of a 24-word backup pasted into the 12-word grid.
    const text = Array(23).fill('abandon').join(' ');
    expect(placeWords(empty(12), 0, text)).toEqual({overflow: 23});
  });
});
