// R02 Welcome, entered from the R01 splash: the logo moves up into its tile, the copy and
// the buttons fade in, and the shared background fades in (mockup intro).
// Copy: the team artboard "Onboarding 02 - Take control" (Paper p-1-0), with the apostrophe in
// "Let's" added (Max, 2026-11-26).
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {colors, type} from '../../theme/tokens';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {FadeView, LogoTile, useBottomGap, useColumnWidth} from '../../components/Layout';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {useOnboarding} from '../OnboardingContext';
import {ROUTES} from '../../logic/steps';
import ImportWaySheet from '../import/ImportWaySheet';
import {useCameraGate} from '../import/cameraGate';
import {chipSeedHasZ, useNfcRead} from '../import/nfcImport';

// A sheet must be gone before the next one (or the system NFC sheet) opens.
const AFTER_SHEET_MS = 320;

let introPlayed = false;

export default function Welcome({navigation}) {
  const ob = useOnboarding();
  const reduce = useReducedMotion();
  const bottomGap = useBottomGap();
  const column = useColumnWidth();
  // Fixed for the life of the screen: a re-render after the intro started must not detach the
  // animated styles (the copy then kept the opacity it had at that moment, often 0).
  const [play] = useState(() => !introPlayed && !reduce);
  const p = useSharedValue(play ? 0 : 1);
  const [testSheet, setTestSheet] = useState(false);
  const [waySheet, setWaySheet] = useState(false);
  const [nfcError, setNfcError] = useState(null);
  const taps = useRef(0);
  const later = useRef(null);
  const camera = useCameraGate(navigation);
  const nfc = useNfcRead({
    onPhrase: phrase => {
      ob.setSecret(phrase);
      ob.setSeedHasZ(chipSeedHasZ(phrase));
      navigation.navigate(ROUTES.password);
    },
    onLocked: ordinal => {
      ob.setNfcBackup(ordinal);
      navigation.navigate(ROUTES.importNfcPassword);
    },
    onError: setNfcError,
  });

  // Back from the first screen of an import lane: Welcome shows the import sheet again, once the
  // screen has come back.
  useEffect(() => {
    const off = navigation.addListener('focus', () => {
      if (!ob.sheetReturn.current) return;
      ob.sheetReturn.current = false;
      clearTimeout(later.current);
      later.current = setTimeout(() => setWaySheet(true), AFTER_SHEET_MS);
    });
    return () => {
      off();
      clearTimeout(later.current);
    };
  }, [navigation, ob.sheetReturn]);

  useEffect(() => {
    introPlayed = true;
    ob.background.fadeTo(1, play ? 2200 : 400);
    if (play) p.value = withTiming(1, {duration: 1800, easing: Easing.linear});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mockup timings: logo 1.2 s; tile fill from 0.35 s; copy from 0.7 s; buttons from 1.0 s.
  const logoStyle = useAnimatedStyle(() => {
    const t = Math.min(1, p.value / (1200 / 1800));
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return {transform: [{translateY: 83 * (1 - e)}]};
  });
  const tileStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(61,61,61,${Math.max(0, Math.min(1, (p.value * 1800 - 350) / 900))})`,
  }));
  const copyStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (p.value * 1800 - 700) / 800));
    return {opacity: t, transform: [{translateY: 12 * (1 - t)}]};
  });
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (p.value * 1800 - 1000) / 800)),
  }));

  const start = path => {
    ob.reset();
    ob.sheetReturn.current = false;
    ob.setPath(path);
    if (path === 'import') setWaySheet(true);
    else navigation.navigate(ROUTES.password);
  };

  const choose = way => {
    setWaySheet(false);
    ob.reset();
    ob.setPath('import');
    ob.sheetReturn.current = true;
    clearTimeout(later.current);
    if (way === 'phrase') navigation.navigate(ROUTES.importPhrase);
    else later.current = setTimeout(way === 'qr' ? camera.open : nfc.read, AFTER_SHEET_MS);
  };

  // Hidden testnet switch, as on the old wallet intro screen (7 taps on the logo).
  const onLogoTap = () => {
    taps.current += 1;
    if (taps.current >= 7) {
      taps.current = 0;
      setTestSheet(true);
    }
  };

  return (
    <FadeView style={styles.root}>
      <View style={styles.center}>
        <View style={[styles.group, {width: Math.min(298, column)}]}>
          <Animated.View style={logoStyle}>
            <LogoTile onPress={onLogoTap} tileStyle={tileStyle} />
          </Animated.View>
          <Animated.View style={[styles.copy, copyStyle]}>
            <Text style={[type.title, styles.title]} accessibilityRole="header">
              {'Take control of\nyour identity'}
            </Text>
            <Text style={[type.bodyLarge, styles.body]}>
              {"Let's start with the creation of a personal, locally stored profile"}
            </Text>
            {ob.testProfile ? <Text style={[type.body, styles.test]}>Testnet wallet</Text> : null}
          </Animated.View>
        </View>
      </View>
      <Animated.View style={[styles.actions, {paddingBottom: bottomGap - 8}, buttonStyle]}>
        <View style={{width: Math.min(362, column + 32), gap: 6}}>
          <ValuButton label="First time use" onPress={() => start('create')} testID="welcome-create" />
          <TextLink label="Recover vault" onPress={() => start('import')} testID="welcome-import" />
        </View>
      </Animated.View>
      <ImportWaySheet visible={waySheet} onClose={() => setWaySheet(false)} onChoose={choose} />
      {camera.element}
      <Sheet
        visible={nfcError != null}
        onClose={() => setNfcError(null)}
        icon={<Icon name="nfcCard48" />}
        title={nfcError?.title}
        body={nfcError?.body}
        testID="nfc-error-sheet"
        buttons={
          nfcError?.unsupported
            ? [
                {
                  label: 'Choose another way',
                  variant: 'accent',
                  testID: 'nfc-error-other',
                  onPress: () => {
                    setNfcError(null);
                    later.current = setTimeout(() => setWaySheet(true), AFTER_SHEET_MS);
                  },
                },
                {label: 'Close', onPress: () => setNfcError(null), testID: 'nfc-error-close'},
              ]
            : [
                {
                  label: 'Try again',
                  variant: 'accent',
                  testID: 'nfc-error-retry',
                  onPress: () => {
                    setNfcError(null);
                    later.current = setTimeout(nfc.read, AFTER_SHEET_MS);
                  },
                },
                {label: 'Cancel', onPress: () => setNfcError(null), testID: 'nfc-error-cancel'},
              ]
        }
      />
      <Sheet
        visible={testSheet}
        onClose={() => setTestSheet(false)}
        title={ob.testProfile ? 'Use mainnet?' : 'Use testnet?'}
        body={
          ob.testProfile
            ? 'The wallet will use mainnet currencies.'
            : 'The wallet will use testnet currencies. Testnet coins have no value.'
        }
        buttons={[
          {
            label: ob.testProfile ? 'Use mainnet' : 'Use testnet',
            variant: 'accent',
            testID: 'welcome-testnet-confirm',
            onPress: () => {
              ob.setTestProfile(!ob.testProfile);
              setTestSheet(false);
            },
          },
          {label: 'Cancel', onPress: () => setTestSheet(false)},
        ]}
      />
    </FadeView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
  group: {alignItems: 'center', gap: 40},
  copy: {alignItems: 'center', gap: 16},
  title: {color: colors.text, textAlign: 'center'},
  body: {color: colors.text, textAlign: 'center'},
  test: {color: colors.highlight, textAlign: 'center'},
  actions: {position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center'},
});
