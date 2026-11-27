import {placeWords} from '../importValidation';
import {CLOUD_BACKUP_MIN_SCORE, getPasswordGate, getPasswordStrength} from '../password';
import {createVerifyQuestions, findVerifyMismatches} from '../verify';
import {
  checkPhrase,
  checkPrivateKey,
  classifyScannedText,
  parsePastedPhrase,
} from '../importValidation';
import {nextRoute, ROUTES, stepListFor} from '../steps';

// Public BIP39 test vectors (trezor/python-mnemonic vectors.json). Not wallets of anyone.
const VECTOR_12 =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';
const VECTOR_24 =
  'legal winner thank year wave sausage worth useful legal winner thank year ' +
  'wave sausage worth useful legal winner thank year wave sausage worth title';
// Public example WIF from the Bitcoin wiki "Wallet import format" page.
const EXAMPLE_WIF = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';

describe('password rule (plan A5 and C2): 8 characters and zxcvbn score 2', () => {
  // The lists and the expected levels are from the plan (C2 "Rule"), not from the library.
  it.each(['12345678', 'password1', 'Password1!', 'qwertyui', 'valuwallet1', 'iloveyou2024'])(
    'rates %s as Weak and keeps Continue off',
    password => {
      expect(getPasswordStrength(password).label).toBe('Weak');
      expect(getPasswordGate(password, password)).toMatchObject({error: 'weak', canContinue: false});
    },
  );

  it.each(['orbit lantern cactus velvet', 'kX9#vQ2$mL7!pR4w'])('lets %s pass', password => {
    expect(getPasswordStrength(password).strongEnough).toBe(true);
    expect(getPasswordGate(password, password)).toMatchObject({error: null, canContinue: true});
  });

  // Meter levels (plan A5): score 2 Fair, 3 Good, 4 Strong. The app gate takes Fair; the cloud
  // backup gate (score 3) takes Good, not Fair.
  it.each([
    ['velvetfox', 'Fair', true, false],
    ['harbor quill', 'Good', true, true],
    ['mosaic pickle ember', 'Strong', true, true],
  ])('rates %s as %s (app gate %s, cloud gate %s)', (password, label, app, cloud) => {
    expect(getPasswordStrength(password).label).toBe(label);
    expect(getPasswordStrength(password).strongEnough).toBe(app);
    expect(getPasswordStrength(password, CLOUD_BACKUP_MIN_SCORE).strongEnough).toBe(cloud);
  });

  it('reads past the first 256 characters', () => {
    const password = 'a'.repeat(256) + 'orbit lantern cactus velvet';
    expect(getPasswordGate(password, password).canContinue).toBe(true);
  });

  it('needs 8 characters: the same random characters are Weak at 7', () => {
    expect(getPasswordStrength('kX9#vQ2').label).toBe('Weak');
    expect(getPasswordStrength('kX9#vQ2$').strongEnough).toBe(true);
  });

  it('counts an emoji as one character', () => {
    // 7 characters, 9 UTF-16 units.
    expect(getPasswordStrength('kX9#v\u{1F511}\u{1F512}').label).toBe('Weak');
  });

  it('checks every character of a 70-character password (no truncation)', () => {
    const long = 'orbit lantern cactus velvet tundra mosaic pickle ember harbor quill 🔑!';
    expect(Array.from(long).length).toBeGreaterThanOrEqual(64);
    expect(getPasswordGate(long, long).canContinue).toBe(true);
    expect(getPasswordGate(long, long.slice(0, -1) + '?')).toMatchObject({
      error: 'mismatch',
      canContinue: false,
    });
  });

  it('shows no meter for an empty password', () => {
    expect(getPasswordStrength('')).toMatchObject({level: 0, label: null, strongEnough: false});
  });

  it('needs the confirmation to match before Continue turns on', () => {
    const p = 'orbit lantern cactus velvet';
    expect(getPasswordGate(p, '')).toMatchObject({error: null, canContinue: false});
    expect(getPasswordGate(p, 'orbit lantern cactus')).toMatchObject({error: 'mismatch', canContinue: false});
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

  it('import: each lane (phrase, key, QR, NFC chip password) joins at the password', () => {
    expect(nextRoute('import', ROUTES.welcome)).toBe('ImportPhrase');
    expect(nextRoute('import', ROUTES.importPhrase)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.importKey)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.scanQr)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.importNfcPassword)).toBe('CreatePassword');
    expect(nextRoute('import', ROUTES.password)).toBe('UseFaceId');
    expect(nextRoute('import', ROUTES.faceId)).toBe('Creating');
  });

  it('skips Face ID when the device has no biometry', () => {
    expect(nextRoute('create', ROUTES.password, {biometry: false})).toBe('Creating');
    expect(nextRoute('import', ROUTES.password, {biometry: false})).toBe('Creating');
  });

});

describe('step list (round 8)', () => {
  it('create: Create password, then Use Face ID', () => {
    expect(stepListFor('create', ROUTES.password)).toEqual({
      done: [],
      current: 'Create password',
      next: ['Use Face ID'],
    });
    expect(stepListFor('create', ROUTES.faceId)).toEqual({
      done: ['Create password'],
      current: 'Use Face ID',
      next: [],
    });
  });

  it('import: Import wallet, Create password, Use Face ID; every lane is the Import wallet step', () => {
    [ROUTES.importPhrase, ROUTES.importKey, ROUTES.importNfcPassword].forEach(lane => {
      expect(stepListFor('import', lane)).toEqual({
        done: [],
        current: 'Import wallet',
        next: ['Create password', 'Use Face ID'],
      });
    });
    expect(stepListFor('import', ROUTES.password)).toEqual({
      done: ['Import wallet'],
      current: 'Create password',
      next: ['Use Face ID'],
    });
    expect(stepListFor('import', ROUTES.faceId).done).toEqual(['Import wallet', 'Create password']);
  });

  it('leaves out the Face ID step when the phone has no biometry', () => {
    expect(stepListFor('create', ROUTES.password, {biometry: false}).next).toEqual([]);
    expect(stepListFor('import', ROUTES.importKey, {biometry: false}).next).toEqual(['Create password']);
  });

  it('names the step after the phone biometry', () => {
    expect(stepListFor('create', ROUTES.password, {bioName: 'Touch ID'}).next).toEqual(['Use Touch ID']);
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
