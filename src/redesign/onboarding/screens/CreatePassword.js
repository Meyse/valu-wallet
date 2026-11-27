// R04 Create password, R05 too weak, R06 no match. Gate: logic/password.js (8 characters, zxcvbn score 2) and a match.
import React, {useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {
  DenseScreen,
  ErrorText,
  Heading,
  StepList,
  TopBar,
  useFocusOnArrival,
  useRevealOnFocus,
} from '../../components/Layout';
import Icon from '../../components/Icon';
import StepIcon from '../../components/StepIcons';
import {getPasswordGate} from '../../logic/password';
import {biometryName} from '../../logic/biometry';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';

const PASSWORD_PROPS = Platform.select({
  ios: {textContentType: 'oneTimeCode', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', textContentType: 'none', autoCorrect: false},
});

// Weak 1 of 4 red, Fair 2 of 4 yellow, Good 3 of 4 green, Strong 4 of 4 green.
// Paper draws only Weak and Good; Fair and Strong follow the flow note colours.
const METER = {
  2: {filled: 1, color: colors.error},
  3: {filled: 2, color: colors.highlight},
  4: {filled: 3, color: colors.success},
  5: {filled: 4, color: colors.success},
};

function Meter({strength}) {
  const m = METER[strength.level];
  if (!m) return null;
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Password strength: ${strength.label}`}>
      <View style={styles.segments}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.segment, i < m.filled && {backgroundColor: m.color}]} />
        ))}
      </View>
      <Text style={[type.bodyStrong, styles.meterLabel, {color: m.color}]}>{strength.label}</Text>
    </View>
  );
}

function PasswordField({label, value, onChangeText, error, inputRef, onSubmit, onFocus, placeholder, returnKeyType, testID}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reveal = useRevealOnFocus();
  const border = error ? colors.error : focused ? colors.accent : colors.text;
  return (
    <View style={styles.group}>
      <Text style={[type.bodyStrong, styles.label]}>{label}</Text>
      <View style={[styles.field, {borderColor: border}]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          onFocus={() => {
            setFocused(true);
            reveal();
            onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          returnKeyType={returnKeyType}
          autoCapitalize="none"
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          accessibilityLabel={label}
          style={[type.bodyLarge, styles.input, !visible && value.length > 0 && styles.bullets]}
          testID={testID}
          {...PASSWORD_PROPS}
        />
        <Pressable
          onPress={() => setVisible(v => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          <Icon name="eye" />
        </Pressable>
      </View>
    </View>
  );
}

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
  group: {gap: 8},
  label: {color: colors.textSecondary},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: '#0000000F',
  },
  input: {flex: 1, color: colors.text, padding: 0, lineHeight: 18, height: 18},
  bullets: {letterSpacing: 1.9},
  meter: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 8},
  segments: {flex: 1, flexDirection: 'row', gap: 4},
  segment: {flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.progressTrack},
  meterLabel: {width: 56, textAlign: 'right'},
  footnote: {color: colors.textSecondary, opacity: 0.6},
});
