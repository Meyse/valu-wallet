// R02 Welcome, entered from the R01 splash: the logo moves up into its tile, the copy and
// the buttons fade in, and the shared background fades in (mockup intro).
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
import {LogoTile, useBottomGap, useColumnWidth} from '../../components/Layout';
import Sheet from '../../components/Sheet';
import {useOnboarding} from '../OnboardingContext';
import {ROUTES} from '../../logic/steps';

let introPlayed = false;

export default function Welcome({navigation}) {
  const ob = useOnboarding();
  const reduce = useReducedMotion();
  const bottomGap = useBottomGap();
  const column = useColumnWidth();
  const play = !introPlayed && !reduce;
  const p = useSharedValue(play ? 0 : 1);
  const [testSheet, setTestSheet] = useState(false);
  const taps = useRef(0);

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
    ob.setPath(path);
    navigation.navigate(path === 'import' ? ROUTES.importPhrase : ROUTES.password);
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
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={[styles.group, {width: Math.min(298, column)}]}>
          <Animated.View style={logoStyle}>
            <LogoTile onPress={onLogoTap} tileStyle={play ? tileStyle : null} />
          </Animated.View>
          <Animated.View style={[styles.copy, play ? copyStyle : null]}>
            <Text style={[type.title, styles.title]} accessibilityRole="header">
              {'Your keys,\nyour wallet'}
            </Text>
            <Text style={[type.bodyLarge, styles.body]}>
              Valu Wallet keeps your keys on this phone. Only you can move your funds.
            </Text>
            {ob.testProfile ? <Text style={[type.body, styles.test]}>Testnet wallet</Text> : null}
          </Animated.View>
        </View>
      </View>
      <Animated.View style={[styles.actions, {paddingBottom: bottomGap - 8}, play ? buttonStyle : null]}>
        <View style={{width: Math.min(362, column + 32), gap: 6}}>
          <ValuButton label="Create a new wallet" onPress={() => start('create')} testID="welcome-create" />
          <TextLink label="I already have a wallet" onPress={() => start('import')} testID="welcome-import" />
        </View>
      </Animated.View>
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
    </View>
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
