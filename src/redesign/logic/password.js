// Password gate for the redesigned onboarding (R04 to R06).
// Scoring is the app's existing scorePassword; the gate and levels follow Verus-Mobile `redesign`.
import scorePassword from '../../utils/auth/scorePassword';
import {
  MIN_PASS_LENGTH,
  MIN_PASS_SCORE,
  PASS_SCORE_LIMIT,
} from '../../utils/constants/constants';

export const STRENGTH_LABELS = {
  2: 'Weak',
  3: 'Fair',
  4: 'Good',
  5: 'Strong',
};

// Level 0 = empty. 2 = under the minimum score. 3 to 5 = passable.
export const getPasswordStrength = password => {
  if (!password) return {score: 0, level: 0, label: null, strongEnough: false};

  const score = scorePassword(password, MIN_PASS_LENGTH, PASS_SCORE_LIMIT);
  if (score < MIN_PASS_SCORE) {
    return {score, level: 2, label: STRENGTH_LABELS[2], strongEnough: false};
  }

  const range = PASS_SCORE_LIMIT - MIN_PASS_SCORE;
  const adjusted = Math.max(0, Math.min(1, (score - MIN_PASS_SCORE) / range));
  const level = Math.min(5, 3 + Math.ceil(adjusted * 2));

  return {score, level, label: STRENGTH_LABELS[level], strongEnough: true};
};

// What the password screen shows and whether Continue is on.
export const getPasswordGate = (password, confirm) => {
  const strength = getPasswordStrength(password);
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
