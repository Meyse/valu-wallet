// Password rule and meter for the redesign (plan A5; Paper "Strength meter", p-6-0).
// zxcvbn-ts estimates the guesses: score 0 < 10^3, 1 < 10^6, 2 < 10^8, 3 < 10^10, 4 >= 10^10.
// Weak: under 8 characters, or score 0 to 1. Fair: score 2. Good: 3. Strong: 4.
import {ZxcvbnFactory} from '@zxcvbn-ts/core';
import {adjacencyGraphs, dictionary} from '@zxcvbn-ts/language-common';

export const MIN_PASSWORD_LENGTH = 8;
// The app password (onboarding, chip backup): Fair or better.
export const APP_PASSWORD_MIN_SCORE = 2;
// The cloud backup password: Good or better. Not confirmed by Max yet (plan Q2).
export const CLOUD_BACKUP_MIN_SCORE = 3;

// Words a guesser tries first for this app.
const APP_WORDS = ['valu', 'valuwallet', 'verus', 'vrsc', 'wallet'];

export const STRENGTH_LABELS = {
  2: 'Weak',
  3: 'Fair',
  4: 'Good',
  5: 'Strong',
};

// zxcvbn reads only the first maxLength characters (default 256). 1024 covers any typed or pasted
// password; a 1000-character check takes about 10 ms in Node.
const MAX_SCORED_LENGTH = 1024;

let zxcvbn = null;
const estimator = () => {
  if (!zxcvbn) {
    zxcvbn = new ZxcvbnFactory({dictionary, graphs: adjacencyGraphs, maxLength: MAX_SCORED_LENGTH});
  }
  return zxcvbn;
};

// The first check builds the word index (about 170 ms on Hermes). A screen with a password field
// calls this after it arrives, so the first key does not wait for it. No user data is used.
export const warmPasswordScorer = () => {
  estimator().check('warm up', APP_WORDS);
};

// Unicode code points: an emoji such as a key counts as one (NIST SP 800-63B-4 counts the same way).
const lengthOf = password => Array.from(password).length;

// No cache: a cache would keep the last typed password in memory after the screen clears it.
export const scorePassword = password => estimator().check(password, APP_WORDS).score;

// Level 0 = empty. 2 Weak, 3 Fair, 4 Good, 5 Strong (the meter and its colours).
export const getPasswordStrength = (password, minScore = APP_PASSWORD_MIN_SCORE) => {
  if (!password) return {score: 0, level: 0, label: null, strongEnough: false};
  const score = scorePassword(password);
  const longEnough = lengthOf(password) >= MIN_PASSWORD_LENGTH;
  const level = !longEnough || score <= 1 ? 2 : score + 1;
  return {
    score,
    level,
    label: STRENGTH_LABELS[level],
    strongEnough: longEnough && score >= minScore,
  };
};

// What the password screen shows and whether Continue is on.
export const getPasswordGate = (password, confirm, minScore = APP_PASSWORD_MIN_SCORE) => {
  const strength = getPasswordStrength(password, minScore);
  const matches = password === confirm;
  const confirmStarted = confirm.length > 0;

  let error = null;
  if (password.length > 0 && !strength.strongEnough) {
    error = 'weak';
  } else if (strength.strongEnough && confirmStarted && !matches) {
    error = 'mismatch';
  }

  return {
    strength,
    error,
    canContinue: strength.strongEnough && confirmStarted && matches,
  };
};
