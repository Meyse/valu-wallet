// R07 Use Face ID. "Turn on Face ID" lets the OS ask for access (R08 is the system prompt).
import React, {useState} from 'react';
import {Platform} from 'react-native';
import * as Keychain from 'react-native-keychain';
import StepScreen from '../../components/StepScreen';
import ValuButton, {TextLink} from '../../components/ValuButton';
import Icon from '../../components/Icon';
import {ErrorText} from '../../components/Layout';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {useOnboarding} from '../OnboardingContext';

// The name the OS uses for this device's biometry.
export const biometryName = biometry => {
  const t = biometry?.type;
  if (t === Keychain.BIOMETRY_TYPE.FACE_ID) return 'Face ID';
  if (t === Keychain.BIOMETRY_TYPE.TOUCH_ID) return 'Touch ID';
  if (t === Keychain.BIOMETRY_TYPE.FINGERPRINT) return 'fingerprint unlock';
  if (t === Keychain.BIOMETRY_TYPE.FACE) return 'face unlock';
  return Platform.OS === 'ios' ? 'Face ID' : 'biometric unlock';
};

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export default function UseFaceId({navigation}) {
  const ob = useOnboarding();
  const [error, setError] = useState(null);
  const name = biometryName(ob.biometry);
  const isFace = /face/i.test(name);
  const steps = stepListFor(ob.path, ROUTES.faceId);

  const go = use => {
    ob.setUseBiometrics(use);
    navigation.navigate(nextRoute(ob.path, ROUTES.faceId));
  };

  // The biometric credential is written by createProfileFromSeed at the end (storeBiometricPassword),
  // which is when iOS shows its Face ID prompt. Here the user only makes the choice.
  const turnOn = () => {
    setError(null);
    if (ob.biometry?.biometry !== true) {
      setError(`${cap(name)} is not set up on this phone.`);
      return;
    }
    go(true);
  };

  return (
    <StepScreen
      onBack={() => navigation.goBack()}
      done={steps.done}
      next={steps.next}
      icon={<Icon name="faceId" />}
      title={`Use ${name}`}
      body={
        isFace
          ? 'Unlock Valu Wallet with your face instead of your password.'
          : `Unlock Valu Wallet with ${name} instead of your password.`
      }
      actions={
        <>
          <ErrorText>{error}</ErrorText>
          <ValuButton label={`Turn on ${name}`} onPress={turnOn} testID="faceid-on" />
          <TextLink label="Skip for now" onPress={() => go(false)} testID="faceid-skip" />
        </>
      }
    />
  );
}
