// Backup NFC 05 - Chip password, 06 - Hold the chip, 07 - Writing, 07 state - Not written,
// 08 - Done, and 05 state - No NFC (Paper p-5-0). The chip backup is encrypted with a password,
// always (Paper: the chip password is required). Default: the wallet password, which also unlocks
// the phrase (as the old NFC backup screen). "Use a different password": a new chip password,
// and the wallet check (Face ID or the wallet password) unlocks the phrase.
// 06 and 07 are the iOS system NFC sheet. Android has none: the screen shows its own "Hold the
// chip" sheet with Cancel (not in Paper).
import React, {useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {useSelector} from 'react-redux';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar, useFocusOnArrival} from '../../components/Layout';
import StepIcon from '../../components/StepIcons';
import PasswordPill from '../../components/PasswordPill';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {getPasswordGate} from '../../logic/password';
import {checkPinForUser} from '../../../utils/asyncStore/authDataStorage';
import {isValid24WordBip39Mnemonic} from '../../../utils/walletBackup/walletBackup';
import {ELECTRUM} from '../../../utils/constants/intervalConstants';
import {markBackedUp} from '../../state/backupState';
import {BACKUP_ROUTES, BACKUP_STEPS, useBackup} from '../BackupContext';
import {useWalletAuth} from '../useWalletAuth';
import {cancelChipWrite, chipWriteError, writeChipBackup} from '../chipBackup';
import BackupDone from './BackupDone';

const IS_ANDROID = Platform.OS === 'android';

export default function ChipPassword({navigation}) {
  const {accountHash, finish} = useBackup();
  const account = useSelector(state => state.authentication.activeAccount);
  const [own, setOwn] = useState(false); // a chip password of its own
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [noNfc, setNoNfc] = useState(false);
  const [noPhrase, setNoPhrase] = useState(false);
  const [done, setDone] = useState(false);
  const [stage, setStage] = useState(null); // Android: 'hold' | 'writing'
  const first = useRef(null);
  const second = useRef(null);
  const auth = useWalletAuth({body: 'Enter the password of this wallet to write its recovery phrase to the chip.'});
  useFocusOnArrival(() => first.current?.focus());

  const gate = getPasswordGate(password, confirm);
  const ready = own ? gate.canContinue : password.length > 0;

  const unlockPhrase = async () => {
    if (!own) {
      try {
        const seeds = await checkPinForUser(password, account.id, false);
        return seeds?.[ELECTRUM];
      } catch (e) {
        setWrong(true);
        return null;
      }
    }
    const result = await auth.ask();
    return result ? result.seeds?.[ELECTRUM] : null;
  };

  const write = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setWrong(false);
    try {
      const mnemonic = await unlockPhrase();
      if (mnemonic == null) return;
      if (!isValid24WordBip39Mnemonic(mnemonic)) {
        setNoPhrase(true);
        return;
      }
      try {
        await writeChipBackup({mnemonic, password, onStage: IS_ANDROID ? setStage : undefined});
      } catch (e) {
        const shown = chipWriteError(e);
        setStage(null);
        if (shown?.noNfc) setNoNfc(true);
        else if (shown) setFailure(shown);
        return;
      }
      setStage(null);
      setPassword('');
      setConfirm('');
      try {
        await markBackedUp(accountHash, 'nfc');
      } catch (e) {
        // The chip holds the backup; only the reminder stays on Home.
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setOwn(o => !o);
    setPassword('');
    setConfirm('');
    setWrong(false);
  };

  const error = own ? gate.error : wrong ? 'wrong' : null;
  const errorText = {
    wrong: 'This password is not right. Try again.',
    weak: 'Use a stronger password: 8 or more characters, with numbers or symbols.',
    mismatch: 'The passwords do not match.',
  }[error];

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={<ValuButton label="Write to chip" onPress={write} loading={busy} disabled={!ready} testID="chip-write" />}>
      <StepList next={BACKUP_STEPS.chip.slice(1)}>
        <View style={styles.content}>
          <Heading
            icon={<StepIcon name="password" />}
            title="Lock the chip backup"
            body={
              own
                ? 'Choose a password for the chip. You need it to restore from the chip.'
                : 'Enter your wallet password. You need it to restore from the chip.'
            }
          />
          <View style={styles.fields}>
            <PasswordPill
              ref={first}
              value={password}
              onChangeText={t => {
                setPassword(t);
                setWrong(false);
              }}
              label={own ? 'Chip password' : 'Wallet password'}
              placeholder={own ? 'Chip password' : undefined}
              error={error === 'wrong' || error === 'weak'}
              editable={!busy}
              returnKeyType={own ? 'next' : 'done'}
              onSubmitEditing={own ? () => second.current?.focus() : write}
              testID="chip-password"
            />
            {own ? (
              <PasswordPill
                ref={second}
                value={confirm}
                onChangeText={setConfirm}
                label="Repeat password"
                placeholder="Repeat password"
                error={error === 'mismatch'}
                editable={!busy}
                onSubmitEditing={write}
                testID="chip-password-repeat"
              />
            ) : null}
            <ErrorText>{errorText}</ErrorText>
          </View>
          <View style={styles.links}>
            <TextLink
              label={own ? 'Use the wallet password' : 'Use a different password'}
              onPress={switchMode}
              testID="chip-password-mode"
            />
          </View>
        </View>
      </StepList>
      <Sheet
        visible={failure != null}
        onClose={() => setFailure(null)}
        icon={<Icon name="nfcCard48" />}
        title={failure?.title}
        body={failure?.body}
        testID="chip-failure-sheet"
        buttons={[
          {
            label: 'Try again',
            variant: 'accent',
            testID: 'chip-try-again',
            onPress: () => {
              setFailure(null);
              setTimeout(write, 320);
            },
          },
          {label: 'Cancel', onPress: () => setFailure(null), testID: 'chip-cancel'},
        ]}
      />
      <Sheet
        visible={noNfc}
        onClose={() => setNoNfc(false)}
        icon={<Icon name="nfcCard48" />}
        title="This phone cannot use NFC"
        body="Write down your recovery phrase instead."
        testID="chip-no-nfc-sheet"
        buttons={[
          {
            label: 'Write down the words',
            variant: 'accent',
            testID: 'chip-no-nfc-words',
            onPress: () => {
              setNoNfc(false);
              navigation.popTo(BACKUP_ROUTES.choose, {words: Date.now()});
            },
          },
        ]}
      />
      <Sheet
        visible={noPhrase}
        onClose={() => setNoPhrase(false)}
        icon={<Icon name="shieldAlert" />}
        title="No recovery phrase to write"
        body="This wallet was not made from 24 words. A chip backup needs the 24 words."
        testID="chip-no-phrase-sheet"
        buttons={[{label: 'Close', onPress: () => setNoPhrase(false), testID: 'chip-no-phrase-close'}]}
      />
      <Sheet
        visible={stage != null}
        onClose={cancelChipWrite}
        icon={<Icon name="nfcCard48" />}
        title={stage === 'writing' ? 'Writing to chip' : 'Hold the chip'}
        body={stage === 'writing' ? 'Hold still.' : 'Hold the chip against the back of your phone.'}
        testID="chip-hold-sheet"
        buttons={[{label: 'Cancel', onPress: cancelChipWrite, testID: 'chip-hold-cancel'}]}
      />
      <BackupDone
        visible={done}
        title="Backup written to chip"
        body="Keep the chip in a safe place. To restore, you need the chip and the password."
        onDone={finish}
      />
      {auth.element}
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 24},
  fields: {gap: 8},
  links: {flexDirection: 'row', justifyContent: 'center', height: 44},
});
