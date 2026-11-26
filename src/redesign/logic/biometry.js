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
