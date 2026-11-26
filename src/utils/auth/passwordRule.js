// The app password rule (plan A5): 8 characters or more and a zxcvbn score of
// 2 or more. WP2 adds the zxcvbn part (a new dependency, not on this branch);
// until then only the length part is checked. Screens read the result from
// state.authentication.activeAccount.passwordFailsRule after an unlock or a
// password change. The password itself is never stored.
export const PASSWORD_RULE_MIN_LENGTH = 8;

export const passwordFailsRule = password =>
  typeof password !== 'string' || Array.from(password).length < PASSWORD_RULE_MIN_LENGTH;
