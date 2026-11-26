// Import NFC 03b - Chip password (Paper p-2-0): the chip holds an encrypted backup. The password
// opens it with the existing decryption (nfcImport.js); then the import path goes on to Create
// password. "Scan a different chip" goes back to Welcome with the import sheet open.
import React, {useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar, useFocusOnArrival} from '../../components/Layout';
import Icon from '../../components/Icon';
import StepIcon from '../../components/StepIcons';
import {biometryName} from '../../logic/biometry';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';
import {chipSeedHasZ, openChipBackup} from '../import/nfcImport';

const PASSWORD_PROPS = Platform.select({
  ios: {textContentType: 'oneTimeCode', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', textContentType: 'none', autoCorrect: false},
});

export default function ImportNfcPassword({navigation}) {
  const ob = useOnboarding();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [opening, setOpening] = useState(false);
  const input = useRef(null);
  const steps = stepListFor('import', ROUTES.importNfcPassword, {
    biometry: ob.biometry?.biometry === true,
    bioName: biometryName(ob.biometry),
  });
  useFocusOnArrival(() => input.current?.focus());

  const open = async () => {
    if (opening || password.length === 0 || !ob.nfcBackup) return;
    setOpening(true);
    setWrong(false);
    try {
      const phrase = await openChipBackup(ob.nfcBackup, password);
      ob.setSecret(phrase);
      ob.setSeedHasZ(chipSeedHasZ(phrase));
      ob.setNfcBackup(null);
      setPassword('');
      // Replace: the chip is open and its record is dropped, so Back from Create password goes
      // to Welcome with the import sheet, not to this screen with nothing to unlock.
      ob.sheetReturn.current = true;
      navigation.replace(nextRoute('import', ROUTES.importNfcPassword));
    } catch (e) {
      setWrong(true);
    } finally {
      setOpening(false);
    }
  };

  const otherChip = () => {
    ob.setNfcBackup(null);
    ob.sheetReturn.current = true;
    navigation.goBack();
  };

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={
        <ValuButton
          label="Continue"
          onPress={open}
          loading={opening}
          disabled={password.length === 0}
          testID="nfc-password-continue"
        />
      }>
      <StepList done={steps.done} next={steps.next}>
        <View style={styles.content}>
          <Heading
            icon={<StepIcon name="import" />}
            title="Unlock your chip backup"
            body="Enter the password you used when you wrote the chip."
          />
          <View style={styles.group}>
            <View style={[styles.field, {borderColor: wrong ? colors.error : focused ? colors.accent : colors.border}]}>
              <TextInput
                ref={input}
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setWrong(false);
                }}
                editable={!opening}
                secureTextEntry={!visible}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={open}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                autoCapitalize="none"
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                accessibilityLabel="Chip password"
                style={[type.bodyLarge, styles.input, !visible && password.length > 0 && styles.bullets]}
                testID="nfc-password-input"
                {...PASSWORD_PROPS}
              />
              <Pressable
                onPress={() => setVisible(v => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
                <Icon name="eye" />
              </Pressable>
            </View>
            <ErrorText>{wrong ? 'This password does not unlock the chip. Check it and try again.' : null}</ErrorText>
            {opening ? <Text style={[type.body, styles.note]}>Unlocking the chip. This can take a minute.</Text> : null}
          </View>
          <View style={styles.links}>
            <TextLink label="Scan a different chip" onPress={otherChip} testID="nfc-other-chip" />
          </View>
        </View>
      </StepList>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 24},
  group: {gap: 8},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: colors.surfaceCard,
  },
  input: {flex: 1, color: colors.text, padding: 0, lineHeight: 19, height: 19},
  bullets: {letterSpacing: 1.9},
  note: {color: colors.textSecondary},
  links: {flexDirection: 'row', justifyContent: 'center', height: 44},
});
