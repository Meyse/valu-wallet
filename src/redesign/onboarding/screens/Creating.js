// Create 06 Creating wallet and Create 07 Wallet ready (sheet). Creation reuses createProfileFromSeed
// unchanged: it derives the keys, encrypts the seed with the password, stores the biometric
// password when asked, and signs the account in. On the create path the 24 words are made here, with
// the app's existing generator (getKey(256)), and the user does not see them: the backup comes
// later, inside the wallet (round 5). The wallet is recorded as "not backed up".
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useDispatch, useStore} from 'react-redux';
import {CommonActions} from '@react-navigation/native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {FadeView, LogoTile, useBottomGap, useColumnWidth} from '../../components/Layout';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {colors, type} from '../../theme/tokens';
import {createProfileFromSeed} from '../../../utils/profile/createProfileFromSeed';
import {hashAccountId} from '../../../utils/crypto/hash';
import {getKey} from '../../../utils/keyGenerator/keyGenerator';
import {clearBackupRecord, recordNeedsBackup} from '../../state/backupState';
import {setHoldOnboarding} from '../../state/redesignState';
import {recordWalletMade} from '../../state/welcomeState';
import {WALLET_PROFILE_NAME, useOnboarding} from '../OnboardingContext';

function Spinner() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, {duration: 900, easing: Easing.linear}), -1);
    return () => cancelAnimation(r);
  }, [r]);
  const style = useAnimatedStyle(() => ({transform: [{rotate: `${r.value}deg`}]}));
  return (
    <Animated.View style={style} accessibilityRole="progressbar" accessibilityLabel="Creating your wallet">
      <Icon name="spinner" />
    </Animated.View>
  );
}

export default function Creating({navigation}) {
  const ob = useOnboarding();
  const dispatch = useDispatch();
  const store = useStore();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  const {height} = useWindowDimensions();
  // 'creating' | 'ready' | 'error' (no wallet saved) | 'saved' (wallet saved, but it did not open)
  const [phase, setPhase] = useState('creating');
  const leaving = useRef(false);

  // No way back while the wallet is being made.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!leaving.current) e.preventDefault();
      }),
    [navigation],
  );

  // The earlier steps hold their own copies of the phrase, the key and the password in their
  // component state. Once the wallet is saved, remove those routes and keep this one (same key,
  // so it stays mounted and the creation does not start again).
  const dropSecrets = () => {
    ob.reset();
    navigation.dispatch(state => {
      const here = state.routes[state.index];
      return CommonActions.reset({...state, routes: [here], index: 0});
    });
  };

  const create = async () => {
    if (ob.creationStarted.current) return;
    ob.creationStarted.current = true;
    setPhase('creating');
    // Keep the onboarding on screen while the new account signs in behind it.
    setHoldOnboarding(true);
    try {
      const accountHash = hashAccountId(WALLET_PROFILE_NAME);
      // Create path: the "not backed up" record first (a failed write stops here, before any
      // wallet exists), then a new phrase for this attempt only. It is never put in shared state.
      if (ob.path === 'create') await recordNeedsBackup(accountHash);
      const seed = ob.path === 'create' ? await getKey(256) : ob.secret;
      const state = store.getState();
      await createProfileFromSeed({
        profileName: WALLET_PROFILE_NAME,
        password: ob.password,
        seed,
        accounts: state.authentication.accounts,
        activeCoinList: state.coins.activeCoinList,
        dispatch,
        testProfile: ob.testProfile,
        // As the old flows: a new mainnet wallet also gets the shielded (Z) seed (SeedWords
        // useSeedAsZ = !testProfile). An import does when the phrase is 24 BIP39 words, typed or
        // from a chip (ImportNfc useSeedAsZ). Unlike the old ImportText: a typed Valu backup must
        // give back the shielded funds too.
        includeDlightSeed: ob.path === 'create' ? !ob.testProfile : ob.seedHasZ,
        useBiometrics: ob.useBiometrics,
      });
      await recordWalletMade(accountHash, ob.path === 'import' ? 'imported' : 'created');
      // An imported wallet already has a backup (the words, key, QR code or chip): no reminder.
      if (ob.path === 'import') await clearBackupRecord(accountHash);
      // The phrase and the password are encrypted and stored now: drop the plain copies.
      dropSecrets();
      setPhase('ready');
    } catch (e) {
      ob.creationStarted.current = false;
      const made = store
        .getState()
        .authentication.accounts.some(a => a.accountHash === hashAccountId(WALLET_PROFILE_NAME));
      // The wallet is saved (keys and encrypted seed are stored), but a later step failed: the
      // starting coins or the sign-in. Making it again would be a duplicate. Drop the plain phrase
      // and password at once: the user opens the wallet on the unlock screen, with a fresh unlock.
      if (made) dropSecrets();
      setPhase(made ? 'saved' : 'error');
    }
  };

  // The returning-user screen opens the saved wallet.
  const toUnlock = () => {
    leaving.current = true;
    ob.reset();
    setHoldOnboarding(false);
  };

  useEffect(() => {
    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToWallet = () => {
    leaving.current = true;
    ob.reset();
    setHoldOnboarding(false);
  };

  const backToStart = () => {
    leaving.current = true;
    ob.sheetReturn.current = false;
    setHoldOnboarding(false);
    navigation.popToTop();
  };

  return (
    <FadeView style={styles.root}>
      <View style={[styles.center, phase === 'ready' && {justifyContent: 'flex-start', paddingTop: Math.round(height * (200 / 874))}]}>
        <View style={[styles.group, {width: Math.min(298, column)}]}>
          <LogoTile />
          {phase === 'creating' ? (
            <>
              <View style={styles.copy}>
                <Text style={[type.title, styles.text]} accessibilityRole="header">
                  Creating your wallet
                </Text>
                <Text style={[type.bodyLarge, styles.text]}>This takes a few seconds.</Text>
              </View>
              <Spinner />
            </>
          ) : null}
          {phase === 'error' ? (
            <View style={styles.copy}>
              <Text style={[type.title, styles.text]} accessibilityRole="header">
                Wallet not created
              </Text>
              <Text style={[type.bodyLarge, styles.text]}>Something went wrong. Try again.</Text>
            </View>
          ) : null}
          {phase === 'saved' ? (
            <View style={styles.copy}>
              <Text style={[type.title, styles.text]} accessibilityRole="header">
                Wallet saved
              </Text>
              <Text style={[type.bodyLarge, styles.text]}>
                Your wallet is saved on this phone, but it did not open. Unlock it to continue.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {phase === 'saved' ? (
        <View style={[styles.actions, {paddingBottom: bottomGap}]}>
          <View style={{width: column, gap: 6}}>
            <ValuButton label="Unlock wallet" onPress={toUnlock} testID="creating-unlock" />
          </View>
        </View>
      ) : null}
      {phase === 'error' ? (
        <View style={[styles.actions, {paddingBottom: bottomGap}]}>
          <View style={{width: column, gap: 6}}>
            <ValuButton label="Try again" onPress={create} testID="creating-retry" />
            <TextLink label="Start again" onPress={backToStart} testID="creating-restart" />
          </View>
        </View>
      ) : null}
      <Sheet
        visible={phase === 'ready'}
        onClose={goToWallet}
        icon={<Icon name="key" />}
        title="Your wallet is ready"
        body="You can now receive and send funds."
        testID="ready-sheet"
        buttons={[{label: 'Go to wallet', variant: 'accent', onPress: goToWallet, testID: 'ready-go'}]}
      />
    </FadeView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
  group: {alignItems: 'center', gap: 40},
  copy: {alignItems: 'center', gap: 16},
  text: {color: colors.text, textAlign: 'center'},
  actions: {position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center'},
});
