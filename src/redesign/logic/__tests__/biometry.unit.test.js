import {biometryIcon, biometryName} from '../biometry';

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

describe('biometryIcon', () => {
  it('shows a fingerprint for Touch ID and Android fingerprint', () => {
    expect(biometryIcon({display_name: 'Touch ID', biometry: true})).toBe('fingerprint');
    expect(biometryIcon({display_name: 'Fingerprint', biometry: true})).toBe('fingerprint');
  });

  it('shows a face for Face ID and face unlock', () => {
    expect(biometryIcon({display_name: 'Face ID', biometry: true})).toBe('faceId');
    expect(biometryIcon({display_name: 'Facial Recognition', biometry: true})).toBe('faceId');
  });
});
