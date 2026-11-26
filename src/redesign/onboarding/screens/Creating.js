// R14 Creating wallet and R15 Wallet ready (sheet). Creation reuses createProfileFromSeed
// unchanged: it derives the keys, encrypts the seed with the password, stores the biometric
// password when asked, and signs the account in.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useDispatch, useStore} from 'react-redux';
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
  const [phase, setPhase] = useState('creating'); // 'creating' | 'ready' | 'error'
  const leaving = useRef(false);

  // No way back while the wallet is being made.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!leaving.current) e.preventDefault();
      }),
    [navigation],
  );

  const create = async () => {
    if (ob.creationStarted.current) return;
    ob.creationStarted.current = true;
    setPhase('creating');
    // Keep the onboarding on screen while the new account signs in behind it.
    setHoldOnboarding(true);
    try {
      const state = store.getState();
      await createProfileFromSeed({
        profileName: WALLET_PROFILE_NAME,
        password: ob.password,
        seed: ob.secret,
        accounts: state.authentication.accounts,
        activeCoinList: state.coins.activeCoinList,
        dispatch,
        testProfile: ob.testProfile,
        // As the old flows: a new mainnet wallet also gets the shielded (Z) seed (SeedWords
        // useSeedAsZ = !testProfile); a typed import does not (CreateWallet ImportText).
        includeDlightSeed: ob.path === 'create' && !ob.testProfile,
        useBiometrics: ob.useBiometrics,
      });
      await recordWalletMade(hashAccountId(WALLET_PROFILE_NAME), ob.path === 'import' ? 'imported' : 'created');
      setPhase('ready');
    } catch (e) {
      ob.creationStarted.current = false;
      const made = store
        .getState()
        .authentication.accounts.some(a => a.accountHash === hashAccountId(WALLET_PROFILE_NAME));
      if (made) {
        // The wallet exists but did not open: let the returning-user screen unlock it.
        leaving.current = true;
        setHoldOnboarding(false);
        return;
      }
      setPhase('error');
    }
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
        </View>
      </View>
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
        body="You can now receive and send funds. Keep your recovery phrase safe."
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
