// Import iCloud 03 - Backup password (Paper p-2-0; Android says Google Drive): the backup found in
// the cloud opens with its backup password (openCloudBackup: Argon2id, AES-256-GCM). Then the import
// path goes on to Create password, as the other lanes. A failed tag check is "not correct"; a file
// that does not open for another reason is damaged, or from a newer app.
import React, {useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar, useFocusOnArrival} from '../../components/Layout';
import Icon from '../../components/Icon';
import StepIcon from '../../components/StepIcons';
import {biometryName} from '../../logic/biometry';
import {ROUTES, nextRoute, stepListFor} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {backupDateText, openCloudBackup} from '../../../utils/cloudBackup/cloudBackup';
import {cloudErrorKind} from '../../../utils/cloudBackup/cloudErrors';
import {cloudCopy} from '../../cloud/useCloudStore';
import {useOnboarding} from '../OnboardingContext';
import {chipSeedHasZ} from '../import/nfcImport';

const PASSWORD_PROPS = Platform.select({
  ios: {textContentType: 'oneTimeCode', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', textContentType: 'none', autoCorrect: false},
});

export default function ImportCloud({navigation}) {
  const ob = useOnboarding();
  const found = ob.cloudBackup;
  const copy = cloudCopy(found?.kind);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  // null | 'wrong' | 'damaged' | 'update'
  const [error, setError] = useState(null);
  const [opening, setOpening] = useState(false);
  const input = useRef(null);
  const steps = stepListFor('import', ROUTES.importCloud, {
    biometry: ob.biometry?.biometry === true,
    bioName: biometryName(ob.biometry),
  });
  useFocusOnArrival(() => input.current?.focus());

  const open = async () => {
    if (opening || password.length === 0 || !found) return;
    setOpening(true);
    setError(null);
    try {
      const {seed, backupId} = await openCloudBackup(found, password);
      ob.setSecret(seed);
      ob.setSeedHasZ(chipSeedHasZ(seed));
      ob.setCloudBackupId(backupId);
      ob.setCloudBackup(null);
      setPassword('');
      // Replace: the backup is open and the file is dropped, so Back from Create password goes to
      // Welcome with the import sheet, not to this screen with nothing to unlock.
      ob.sheetReturn.current = true;
      navigation.replace(nextRoute('import', ROUTES.importCloud));
    } catch (e) {
      const kind = cloudErrorKind(e);
      setError(kind === 'wrong-password' ? 'wrong' : kind === 'update-app' ? 'update' : 'damaged');
    } finally {
      setOpening(false);
    }
  };

  const message =
    error === 'wrong'
      ? copy.wrongPassword
      : error === 'update'
        ? copy.updateBody
        : error === 'damaged'
          ? copy.damagedBody
          : null;

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={
        <ValuButton
          label="Continue"
          onPress={open}
          loading={opening}
          disabled={password.length === 0}
          testID="cloud-unlock-continue"
        />
      }>
      <StepList done={steps.done} next={steps.next}>
        <View style={styles.content}>
          <Heading
            icon={<StepIcon name="import" />}
            title={copy.unlockTitle}
            body={copy.unlockBody(backupDateText(found?.createdAt))}
          />
          <View style={styles.group}>
            <View
              style={[
                styles.field,
                {borderColor: error === 'wrong' ? colors.error : focused ? colors.accent : colors.border},
              ]}>
              <TextInput
                ref={input}
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setError(null);
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
                accessibilityLabel="Backup password"
                style={[type.bodyLarge, styles.input, !visible && password.length > 0 && styles.bullets]}
                testID="cloud-unlock-input"
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
            <ErrorText>{message}</ErrorText>
            {opening ? <Text style={[type.body, styles.note]}>Unlocking the backup.</Text> : null}
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
});
