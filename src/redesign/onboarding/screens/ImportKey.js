// R03e Import private key and R03f invalid key.
import React, {useRef, useState} from 'react';
import {Platform, StyleSheet, TextInput, View} from 'react-native';
// Same clipboard API as the rest of the app (SendWizardRecipient, AddressBook).
import {Clipboard} from 'react-native';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar, useFocusOnArrival} from '../../components/Layout';
import StepIcon from '../../components/StepIcons';
import {checkPrivateKey} from '../../logic/importValidation';
import {biometryName} from '../../logic/biometry';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {colors, radius, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';

const NO_AUTOFILL = Platform.select({
  ios: {textContentType: 'none', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', autoCorrect: false, keyboardType: 'visible-password'},
});

export default function ImportKey({navigation}) {
  const ob = useOnboarding();
  const [key, setKey] = useState('');
  const [focused, setFocused] = useState(false);
  const [checked, setChecked] = useState(false);
  const input = useRef(null);
  const steps = stepListFor('import', ROUTES.importKey, {
    biometry: ob.biometry?.biometry === true,
    bioName: biometryName(ob.biometry),
  });

  useFocusOnArrival(() => input.current?.focus());

  const result = checkPrivateKey(key);
  // The error shows when the user leaves the field or pastes a key, not on every keystroke.
  const invalid = checked && result.status === 'invalid';

  const paste = async () => {
    let text = '';
    try {
      text = await Clipboard.getString();
    } catch (e) {
      text = '';
    }
    setKey(text.trim());
    setChecked(true);
  };

  const next = () => {
    if (result.status !== 'valid') {
      setChecked(true);
      return;
    }
    ob.setSecret(result.key);
    ob.setSeedHasZ(false);
    navigation.navigate(nextRoute('import', ROUTES.importKey));
  };

  return (
    <DenseScreen
        topBar={<TopBar onBack={() => navigation.goBack()} />}
        footer={
          <ValuButton label="Continue" onPress={next} disabled={result.status !== 'valid'} testID="key-continue" />
        }>
        <StepList done={steps.done} next={steps.next}>
          <View style={styles.content}>
            <Heading
              icon={<StepIcon name="import" />}
              title="Enter your private key"
              body="Type or paste the key of your wallet."
            />
            <View>
              <View style={[styles.field, focused && styles.focused, invalid && styles.error]}>
                <TextInput
                  ref={input}
                  value={key}
                  onChangeText={text => {
                    setKey(text);
                    if (checked && checkPrivateKey(text).status === 'valid') setChecked(false);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => {
                    setFocused(false);
                    if (key.length > 0) setChecked(true);
                  }}
                  multiline
                  // A key has no line breaks: Done closes the keyboard and checks the key.
                  submitBehavior="blurAndSubmit"
                  returnKeyType="done"
                  onSubmitEditing={() => key.length > 0 && setChecked(true)}
                  autoCapitalize="none"
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  accessibilityLabel="Private key"
                  style={[type.label, styles.input]}
                  testID="key-input"
                  {...NO_AUTOFILL}
                />
              </View>
              <ErrorText style={{marginTop: 8}}>
                {invalid ? 'This key is not valid. Check it and try again.' : null}
              </ErrorText>
            </View>
            <View style={styles.links}>
              <TextLink label="Paste key" onPress={paste} testID="key-paste" />
            </View>
          </View>
        </StepList>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 24},
  field: {
    height: 112,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.fillSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focused: {borderColor: colors.accent},
  error: {borderColor: colors.error},
  input: {flex: 1, color: colors.text, lineHeight: 22, padding: 0, textAlignVertical: 'top'},
  links: {flexDirection: 'row', justifyContent: 'center', height: 44},
});
