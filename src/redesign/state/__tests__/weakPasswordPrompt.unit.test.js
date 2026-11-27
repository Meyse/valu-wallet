// Weak password prompt (Paper p-6-0): only when it is on and the password fails the app rule, and
// "Not now" hides it for 7 days.
import {WEAK_PASSWORD_PROMPT_ENABLED, shouldShowWeakPrompt} from '../weakPasswordPrompt';
import {passwordFailsRule} from '../../../utils/auth/passwordRule';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 27);

describe('shouldShowWeakPrompt', () => {
  it('is off for users until the redesign has a change-password flow', () => {
    expect(WEAK_PASSWORD_PROMPT_ENABLED).toBe(false);
    expect(shouldShowWeakPrompt({enabled: WEAK_PASSWORD_PROMPT_ENABLED, fails: true, dismissedAt: null, now: NOW})).toBe(false);
  });

  it('shows for a password that fails the rule, and not for one that passes or is not checked yet', () => {
    expect(shouldShowWeakPrompt({enabled: true, fails: true, dismissedAt: null, now: NOW})).toBe(true);
    expect(shouldShowWeakPrompt({enabled: true, fails: false, dismissedAt: null, now: NOW})).toBe(false);
    expect(shouldShowWeakPrompt({enabled: true, fails: undefined, dismissedAt: null, now: NOW})).toBe(false);
  });

  it('stays hidden for 7 days after "Not now"', () => {
    expect(shouldShowWeakPrompt({enabled: true, fails: true, dismissedAt: NOW - 6 * DAY, now: NOW})).toBe(false);
    expect(shouldShowWeakPrompt({enabled: true, fails: true, dismissedAt: NOW - 7 * DAY, now: NOW})).toBe(true);
  });
});

// Plan A5: 8 characters or more and a zxcvbn score of 2 or more (the C2 lists).
describe('passwordFailsRule', () => {
  it.each(['1234567', '12345678', 'password1', 'qwertyui', 'iloveyou2024'])('fails %s', password => {
    expect(passwordFailsRule(password)).toBe(true);
  });

  it.each(['orbit lantern cactus velvet', 'kX9#vQ2$mL7!pR4w'])('passes %s', password => {
    expect(passwordFailsRule(password)).toBe(false);
  });

  it('fails a value that is not a string', () => {
    expect(passwordFailsRule(undefined)).toBe(true);
  });
});
