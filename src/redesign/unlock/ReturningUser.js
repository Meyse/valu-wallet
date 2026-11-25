// Returning user (PROPOSAL: Paper has no design for it). App start with an existing wallet:
// unlock with the password or Face ID. Same language as R04 (field) over the shared background.
// Unlock calls are the ones the old Unlock screen uses (initializeAccountData, getBiometricPassword).
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {useObjectSelector} from '../../hooks/useObjectSelector';
import {initializeAccountData} from '../../actions/actions/account/dispatchers/account';
import {saveGeneralSettings, setSuppressUnlockAutoBiometrics} from '../../actions/actionCreators';
import {getSupportedBiometryType} from '../../utils/keychain/keychain';
import {getBiometricPassword} from '../../utils/keychain/biometrics';
import OnboardingBackground, {useBackgroundControls} from '../components/OnboardingBackground';
import {BackdropSourceContext} from '../components/Sheet';
import Sheet from '../components/Sheet';
import ValuButton, {TextLink} from '../components/ValuButton';
import {ErrorText, LogoTile, useBottomGap, useColumnWidth, useTopBarTop} from '../components/Layout';
import Icon from '../components/Icon';
import {biometryName} from '../onboarding/screens/UseFaceId';
import {setRedesignEnabled} from '../state/redesignState';
import {useDeeplinkForward} from '../state/useDeeplinkForward';
import {colors, radius, type} from '../theme/tokens';

const PROMPT = 'Authenticate to unlock profile';

const isWrongPassword = e => {
  const m = String(e?.message ?? e ?? '');
  return /incorrect password/i.test(m) || /failed to validate and initialize account/i.test(m);
};
// Same patterns as the old Unlock screen (classifyBiometricError).
const BIO_STORAGE = [
  'no biometric credential found',
  'no password found stored for account',
  'no biometric vault found',
  'failed to decrypt biometric vault',
  'critical biometric vault error',
];
const isBioStorageError = e => {
  const m = String(e?.message ?? e ?? '').toLowerCase();
  return BIO_STORAGE.some(p => m.includes(p));
};

export default function ReturningUser({navigation}) {
  const dispatch = useDispatch();
  const root = useRef(null);
  const input = useRef(null);
  const background = useBackgroundControls();
  const top = useTopBarTop();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  useDeeplinkForward(navigation);

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const defaultHash = useSelector(state => state.settings.generalWalletSettings.defaultAccount);
  const suppressAuto = useSelector(state => state.authentication.suppressUnlockAutoBiometrics);

  const sorted = useMemo(
    () => [...(accounts ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    [accounts],
  );
  const [selectedHash, setSelectedHash] = useState(null);
  const account =
    sorted.find(a => a.accountHash === selectedHash) ??
    sorted.find(a => a.accountHash === defaultHash) ??
    sorted[0];

  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [biometry, setBiometry] = useState(null);
  const [chooser, setChooser] = useState(false);
  const inFlight = useRef(false);
  const bioInFlight = useRef(false);

  useEffect(() => {
    background.fadeTo(1, 900);
    getSupportedBiometryType()
      .then(setBiometry)
      .catch(() => setBiometry({biometry: false}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback(
    async key => {
      if (!account || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      Keyboard.dismiss();
      try {
        await initializeAccountData(account, key, false, undefined, {alertOnFail: false});
        dispatch(setSuppressUnlockAutoBiometrics(false));
      } catch (e) {
        setError(isWrongPassword(e) ? 'Incorrect password. Try again.' : 'Could not unlock. Try again.');
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [account, dispatch],
  );

  const canBio = !!account?.biometry && !!biometry?.biometry;
  const bioName = biometryName(biometry);

  const unlockWithBiometrics = useCallback(async () => {
    if (!canBio || inFlight.current || bioInFlight.current) return;
    bioInFlight.current = true;
    try {
      const key = await getBiometricPassword(account.accountHash, PROMPT);
      if (key != null) await unlock(key);
    } catch (e) {
      // A cancel stays silent. A missing or broken biometric store needs the password.
      if (isBioStorageError(e)) setError(`${bioName} is not available. Use your password.`);
    } finally {
      bioInFlight.current = false;
      if (suppressAuto) dispatch(setSuppressUnlockAutoBiometrics(false));
    }
  }, [account, canBio, bioName, unlock, suppressAuto, dispatch]);

  // Ask for Face ID on open, as the old Unlock screen does (not after an explicit lock).
  useEffect(() => {
    if (canBio && !suppressAuto && !chooser) unlockWithBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.accountHash, canBio]);

  const several = sorted.length > 1;

  return (
    <BackdropSourceContext.Provider value={root}>
      <StatusBar barStyle="light-content" />
      <View ref={root} collapsable={false} style={styles.root}>
        <OnboardingBackground lift={background.lift} opacity={background.opacity} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, {paddingTop: top + 57, paddingBottom: bottomGap}]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.tile}>
              <LogoTile />
            </View>
            <View style={styles.spacer} />
            <View style={{width: column, alignSelf: 'center', gap: 32}}>
              <View style={{gap: 8}}>
                <Text style={[type.title, {color: colors.text}]} accessibilityRole="header">
                  Welcome back
                </Text>
                <Text style={[type.bodyLarge, {color: colors.textSecondary}]}>
                  Enter your password to unlock Valu Wallet.
                </Text>
              </View>
              {several ? (
                <Pressable
                  style={styles.walletRow}
                  onPress={() => setChooser(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Profile ${account?.id}. Change profile`}
                  testID="unlock-change-profile">
                  <Text style={[type.label, {color: colors.text, flex: 1}]} numberOfLines={1}>
                    {account?.id}
                  </Text>
                  <Text style={[type.body, styles.change]}>Change</Text>
                </Pressable>
              ) : null}
              <View style={{gap: 8}}>
                <Text style={[type.bodyStrong, {color: colors.textSecondary}]}>Password</Text>
                <View style={[styles.field, {borderColor: error ? colors.error : focused ? colors.accent : colors.text}]}>
                  <TextInput
                    ref={input}
                    value={password}
                    onChangeText={t => {
                      setPassword(t);
                      setError(null);
                    }}
                    secureTextEntry={!visible}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onSubmitEditing={() => password && unlock(password)}
                    returnKeyType="go"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={colors.accent}
                    cursorColor={colors.accent}
                    accessibilityLabel="Password"
                    style={[type.bodyLarge, styles.input]}
                    testID="unlock-password"
                    {...Platform.select({ios: {textContentType: 'password'}, default: {autoComplete: 'off'}})}
                  />
                  <Pressable
                    onPress={() => setVisible(v => !v)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
                    <Icon name="eye" />
                  </Pressable>
                </View>
                <ErrorText>{error}</ErrorText>
              </View>
              <View style={{gap: 6}}>
                <ValuButton
                  label="Unlock"
                  onPress={() => unlock(password)}
                  disabled={password.length === 0}
                  loading={busy}
                  testID="unlock-submit"
                />
                {canBio ? (
                  <TextLink label={`Unlock with ${bioName}`} onPress={unlockWithBiometrics} testID="unlock-biometric" />
                ) : null}
                <TextLink label="Open the old wallet UI" onPress={() => setRedesignEnabled(false)} testID="unlock-old-ui" />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <Sheet
          visible={chooser}
          onClose={() => setChooser(false)}
          title="Choose a profile"
          body="This phone has more than one profile from the old wallet."
          testID="unlock-profile-sheet"
          buttons={[{label: 'Cancel', onPress: () => setChooser(false)}]}>
          <View style={{gap: 8}}>
            {sorted.map(a => {
              const on = a.accountHash === account?.accountHash;
              return (
                <Pressable
                  key={a.accountHash}
                  onPress={() => {
                    setSelectedHash(a.accountHash);
                    // The old Unlock screen saves the choice as the default profile.
                    saveGeneralSettings({defaultAccount: a.accountHash})
                      .then(action => dispatch(action))
                      .catch(() => {});
                    setPassword('');
                    setError(null);
                    setChooser(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{selected: on}}
                  style={[styles.profileRow, on && styles.profileOn]}>
                  <Text style={[type.label, {color: colors.text}]} numberOfLines={1}>
                    {a.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Sheet>
      </View>
    </BackdropSourceContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
  flex: {flex: 1},
  scroll: {flexGrow: 1},
  tile: {alignItems: 'center'},
  spacer: {flex: 1, minHeight: 32},
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
  walletRow: {
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  change: {color: colors.primary, textDecorationLine: 'underline'},
  profileRow: {
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  profileOn: {backgroundColor: '#FFFFFF1A', borderColor: colors.text},
});
