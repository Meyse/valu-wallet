// The app password rule (plan A5): 8 characters or more and a zxcvbn score of 2 or more, the same
// check as the redesigned Create password screen (src/redesign/logic/password.js). Screens read the
// result from state.authentication.activeAccount.passwordFailsRule after an unlock or a password
// change. The password itself is never stored.
import {APP_PASSWORD_MIN_SCORE, MIN_PASSWORD_LENGTH, getPasswordStrength} from '../../redesign/logic/password';

export const PASSWORD_RULE_MIN_LENGTH = MIN_PASSWORD_LENGTH;

export const passwordFailsRule = password =>
  typeof password !== 'string' || !getPasswordStrength(password, APP_PASSWORD_MIN_SCORE).strongEnough;
