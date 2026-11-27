// R04 Create password, R05 too weak, R06 no match. Gate: logic/password.js (8 characters, zxcvbn score 2) and a match.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {
  DenseScreen,
  ErrorText,
  Heading,
  StepList,
  TopBar,
  useFocusOnArrival,
} from '../../components/Layout';
import {METER_ROOM, Meter, PasswordField} from '../../components/PasswordFields';
import StepIcon from '../../components/StepIcons';
import {getPasswordGate, warmPasswordScorer} from '../../logic/password';
import {biometryName} from '../../logic/biometry';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';

export default function CreatePassword({navigation}) {
  const ob = useOnboarding();
  const [password, setPassword] = useState(ob.password ?? '');
  const [confirm, setConfirm] = useState(ob.password ?? '');
  const first = useRef(null);
  const second = useRef(null);
  const gate = getPasswordGate(password, confirm);
  const steps = stepListFor(ob.path, ROUTES.password, {
    biometry: ob.biometry?.biometry === true,
    bioName: biometryName(ob.biometry),
  });

  useFocusOnArrival(() => first.current?.focus());
  // Build the word index while the screen slides in, not on the first key.
  useEffect(() => {
    const t = setTimeout(warmPasswordScorer, 0);
    return () => clearTimeout(t);
  }, []);

  const next = () => {
    if (!gate.canContinue) return;
    ob.setPassword(password);
    navigation.navigate(nextRoute(ob.path, ROUTES.password, {biometry: ob.biometry?.biometry === true}));
  };

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={<ValuButton label="Continue" onPress={next} disabled={!gate.canContinue} testID="password-continue" />}>
      <StepList done={steps.done} next={steps.next}>
        <View style={styles.content}>
          <Heading
            icon={<StepIcon name="password" />}
            title="Create a password"
            body="It unlocks Valu Wallet on this phone."
          />
          <View style={styles.fields}>
            <View>
              <PasswordField
                label="Password"
                value={password}
                onChangeText={setPassword}
                inputRef={first}
                returnKeyType="next"
                onSubmit={() => second.current?.focus()}
                revealExtra={METER_ROOM}
                testID="password-new"
              />
              <Meter strength={gate.strength} />
              <ErrorText>{gate.error === 'weak' ? 'Make it longer. Try 3 or 4 unrelated words.' : null}</ErrorText>
            </View>
            <View>
              <PasswordField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                inputRef={second}
                placeholder="Repeat password"
                returnKeyType="done"
                onSubmit={next}
                error={gate.error === 'mismatch'}
                testID="password-confirm"
              />
              <ErrorText>{gate.error === 'mismatch' ? 'Passwords do not match.' : null}</ErrorText>
            </View>
          </View>
          <Text style={[type.body, styles.footnote]}>
            If you forget it, you need a backup of your wallet to get back in.
          </Text>
        </View>
      </StepList>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 32},
  fields: {gap: 24},
  footnote: {color: colors.textSecondary, opacity: 0.6},
});
