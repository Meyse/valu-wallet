// The name the OS uses for this device's biometry, from getSupportedBiometryType()
// (src/utils/keychain/keychain.js). That call returns {display_name, biometry}; it has no `type`.
import {Platform} from 'react-native';

const BY_DISPLAY_NAME = {
  'Face ID': 'Face ID',
  'Touch ID': 'Touch ID',
  Fingerprint: 'fingerprint unlock',
  'Facial Recognition': 'face unlock',
  'Iris Recognition': 'iris unlock',
};

export const biometryName = biometry =>
  BY_DISPLAY_NAME[biometry?.display_name] ?? (Platform.OS === 'ios' ? 'Face ID' : 'biometric unlock');

// Icon name (src/redesign/components/Icon.js) for this device's biometry. Touch ID and fingerprint
// sensors get the fingerprint; face and iris unlock get the face. Unknown: the platform's usual one.
const FINGERPRINT = new Set(['Touch ID', 'Fingerprint']);
const FACE = new Set(['Face ID', 'Facial Recognition', 'Iris Recognition']);

export const biometryIcon = biometry => {
  if (FINGERPRINT.has(biometry?.display_name)) return 'fingerprint';
  if (FACE.has(biometry?.display_name)) return 'faceId';
  return Platform.OS === 'ios' ? 'faceId' : 'fingerprint';
};
