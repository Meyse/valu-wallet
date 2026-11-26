import {biometryName} from '../biometry';

// The app's getSupportedBiometryType() returns {display_name, biometry} (src/utils/keychain).
describe('biometryName', () => {
  it('names Touch ID on a Touch ID iPhone', () => {
    expect(biometryName({display_name: 'Touch ID', biometry: true})).toBe('Touch ID');
  });

  it('names Face ID on a Face ID iPhone', () => {
    expect(biometryName({display_name: 'Face ID', biometry: true})).toBe('Face ID');
  });

  it('names fingerprint unlock on Android', () => {
    expect(biometryName({display_name: 'Fingerprint', biometry: true})).toBe('fingerprint unlock');
  });
});
