// Backup iCloud 05 - Create backup password, and its states Too weak and No match (Paper p-5-0).
// Android says Google Drive. The gate is the shared rule (logic/password.js) at the cloud level,
// CLOUD_BACKUP_MIN_SCORE (Good): Fair keeps the button off and shows the weak hint.
// "Save to iCloud": the wallet check (Face ID or the wallet password, as before the words) gives
// the seed; the seed and the backup password go to the Saving screen in memory only.
// One form step only, so the step list shows just the current block (flow note, round 10).
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar, useFocusOnArrival} from '../../components/Layout';
import {METER_ROOM, Meter, PasswordField} from '../../components/PasswordFields';
import StepIcon from '../../components/StepIcons';
import useSecureScreen from '../../components/useSecureScreen';
import {CLOUD_BACKUP_MIN_SCORE, getPasswordGate, warmPasswordScorer} from '../../logic/password';
import {ELECTRUM} from '../../../utils/constants/intervalConstants';
import {colors, type} from '../../theme/tokens';
import {BACKUP_ROUTES, useBackup} from '../BackupContext';
import {useWalletAuth} from '../useWalletAuth';

export default function CloudPassword({navigation}) {
  const {cloud, cloudJob} = useBackup();
  const copy = cloud.copy;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef(null);
  const second = useRef(null);
  const gate = getPasswordGate(password, confirm, CLOUD_BACKUP_MIN_SCORE);
  // Android: no Recents picture or screenshot of a shown password.
  useSecureScreen(password.length > 0 || confirm.length > 0);
  const auth = useWalletAuth({
    body: 'Enter the password of this wallet to save its backup.',
    prompt: 'Save your wallet backup',
  });

  useFocusOnArrival(() => first.current?.focus());
  useEffect(() => {
    const t = setTimeout(warmPasswordScorer, 0);
    return () => clearTimeout(t);
  }, []);

  const save = async () => {
    if (!gate.canContinue || busy) return;
    setBusy(true);
    try {
      const result = await auth.ask();
      const seed = result?.seeds?.[ELECTRUM];
      if (!seed) return;
      cloudJob.current = {seed, password};
      // The fields do not keep the password behind the Saving screen. A cancelled Google consent
      // comes back here with empty fields.
      setPassword('');
      setConfirm('');
      navigation.navigate(BACKUP_ROUTES.cloudSaving);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={
        <ValuButton
          label={copy.saveButton}
          onPress={save}
          loading={busy}
          disabled={!gate.canContinue}
          testID="cloud-password-save"
        />
      }>
      <StepList>
        <View style={styles.content}>
          <Heading icon={<StepIcon name="password" />} title={copy.passwordTitle} body={copy.passwordBody} />
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
                testID="cloud-password-new"
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
                onSubmit={save}
                error={gate.error === 'mismatch'}
                testID="cloud-password-confirm"
              />
              <ErrorText>{gate.error === 'mismatch' ? 'Passwords do not match.' : null}</ErrorText>
            </View>
          </View>
          <Text style={[type.body, styles.footnote]}>{copy.passwordHelper}</Text>
        </View>
      </StepList>
      {auth.element}
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 32},
  fields: {gap: 24},
  footnote: {color: colors.textSecondary, opacity: 0.6},
});
