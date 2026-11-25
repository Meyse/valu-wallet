// R03e Import private key and R03f invalid key.
import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, TextInput, View} from 'react-native';
import Clipboard from 'react-native/Libraries/Components/Clipboard/Clipboard';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, PillButton, TopBar} from '../../components/Layout';
import {checkPrivateKey} from '../../logic/importValidation';
import {ROUTES, nextRoute, progressFor} from '../../logic/steps';
import {colors, radius, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';
import {useCameraGate} from './ImportPhrase';

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
  const camera = useCameraGate(navigation);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

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
    navigation.navigate(nextRoute('import', ROUTES.importKey));
  };

  return (
    <>
      <DenseScreen
        topBar={
          <TopBar
            onBack={() => navigation.goBack()}
            progress={progressFor('import', ROUTES.importKey)}
            right={<PillButton icon="scanQr" label="Scan QR" onPress={camera.open} testID="key-scan-qr" />}
          />
        }
        footer={
          <ValuButton label="Continue" onPress={next} disabled={result.status !== 'valid'} testID="key-continue" />
        }>
        <View style={styles.content}>
          <Heading title="Enter your private key" body="Type or paste the key of your wallet." />
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
      </DenseScreen>
      {camera.element}
    </>
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
