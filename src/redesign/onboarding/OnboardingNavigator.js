// Redesigned onboarding (Paper p-2-0: create 01-08, import 01-04). The shared background is mounted once here, behind the
// stack, so its clock never resets on navigation. Screens have transparent cards.
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Platform, StatusBar, StyleSheet, TextInput, View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {ThemeProvider, useTheme} from '@react-navigation/native';
import {colors} from '../theme/tokens';
import OnboardingBackground, {useBackgroundControls} from '../components/OnboardingBackground';
import {SCENES, W_BOX} from '../components/gradientMorph';
import {BackdropSourceContext} from '../components/Sheet';
import {ContentFadeContext, SharedBackGlass, SharedBackGlassContext} from '../components/Layout';
import {ROUTES} from '../logic/steps';
import {getSupportedBiometryType} from '../../utils/keychain/keychain';
import {OnboardingProvider, useOnboarding} from './OnboardingContext';
import {useDeeplinkForward} from '../state/useDeeplinkForward';
import {useHoldOnboarding} from '../state/redesignState';
import Welcome from './screens/Welcome';
import ImportPhrase from './screens/ImportPhrase';
import ImportKey from './screens/ImportKey';
import ImportNfcPassword from './screens/ImportNfcPassword';
import ScanQr from './screens/ScanQr';
import CreatePassword from './screens/CreatePassword';
import UseFaceId from './screens/UseFaceId';
import Creating from './screens/Creating';

const Stack = createStackNavigator();

// The background scene of each screen, from its Paper artboard (see gradientMorph.js).
export const SCENE_FOR = {
  [ROUTES.welcome]: SCENES.hero,
  [ROUTES.importPhrase]: SCENES.dense,
  [ROUTES.importKey]: SCENES.dense,
  [ROUTES.importNfcPassword]: SCENES.dense,
  [ROUTES.password]: SCENES.dense,
  [ROUTES.faceId]: SCENES.icon,
  [ROUTES.creating]: SCENES.hero,
};

// Cards are transparent over the shared background, so screens cross-fade with a short
// slide instead of sliding over each other. The fade is on the screen content (FadeView in
// Layout.js), not on the card: a faded card stops Liquid Glass on it.
// The card moves on the glow box spring (critically damped, W_BOX rad/s), so the content and the
// glow travel over the same time with the same curve. The stack animates in screen points.
const CARD_SPRING = {
  animation: 'spring',
  config: {
    stiffness: W_BOX * W_BOX,
    damping: 2 * W_BOX,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 8,
    restSpeedThreshold: 40,
  },
};

const fadeSlide = ({current, next, layouts}) => ({
  cardStyle: {
    transform: [
      {
        translateX: next
          ? next.progress.interpolate({inputRange: [0, 1], outputRange: [0, -layouts.screen.width * 0.08]})
          : current.progress.interpolate({inputRange: [0, 1], outputRange: [layouts.screen.width * 0.08, 0]}),
      },
    ],
  },
});

function BiometryProbe() {
  const ob = useOnboarding();
  useEffect(() => {
    let alive = true;
    getSupportedBiometryType()
      .then(r => alive && ob.setBiometry(r))
      .catch(() => alive && ob.setBiometry({biometry: false}));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// The first text field of the app costs the UI thread about 140 ms to create (measured on the iOS
// simulator, Release). Without this, that cost lands in the first frames of the move to Create
// password. One hidden, inert secure field on the start screen pays it before the user taps.
function TextFieldWarmup() {
  if (Platform.OS !== 'ios') return null;
  return (
    <View style={styles.warmup} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <TextInput editable={false} secureTextEntry textContentType="oneTimeCode" style={styles.warmup} />
    </View>
  );
}

// Steps without the back button: the shared glass circle hides there.
const NO_BACK = [ROUTES.welcome, ROUTES.creating, ROUTES.scanQr];

function Screens({background, onRoute}) {
  // The glow starts with the card. "focus" comes before the card starts to move (the new screen
  // mounts first), so it only names the scene; "transitionStart" applies it. Screens that open
  // without a transition (the first screen, the end of a swipe back) apply it from the fallback.
  const pending = useRef(null);
  const fallback = useRef(null);
  const applyScene = () => {
    clearTimeout(fallback.current);
    const name = pending.current;
    if (!name) return;
    pending.current = null;
    // No glow on the camera screen (DESIGN.md): it fades where it is.
    if (name === ROUTES.scanQr) background.setScene({strength: 0});
    else background.setScene(SCENE_FOR[name] ?? SCENES.hero);
  };
  useEffect(() => () => clearTimeout(fallback.current), []);
  const onFocus = name => {
    onRoute(name);
    pending.current = name;
    clearTimeout(fallback.current);
    fallback.current = setTimeout(applyScene, 150);
    if (name !== ROUTES.welcome) background.fadeTo(1, 600);
  };
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.welcome}
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        cardStyleInterpolator: fadeSlide,
        transitionSpec: {open: CARD_SPRING, close: CARD_SPRING},
        gestureEnabled: true,
      }}
      screenListeners={({route}) => ({
        focus: () => onFocus(route.name),
        transitionStart: applyScene,
      })}>
      <Stack.Screen name={ROUTES.welcome} component={Welcome} />
      <Stack.Screen name={ROUTES.importPhrase} component={ImportPhrase} />
      <Stack.Screen name={ROUTES.importKey} component={ImportKey} />
      <Stack.Screen name={ROUTES.importNfcPassword} component={ImportNfcPassword} />
      <Stack.Screen name={ROUTES.scanQr} component={ScanQr} />
      <Stack.Screen name={ROUTES.password} component={CreatePassword} />
      <Stack.Screen name={ROUTES.faceId} component={UseFaceId} />
      <Stack.Screen name={ROUTES.creating} component={Creating} options={{gestureEnabled: false}} />
    </Stack.Navigator>
  );
}

export default function OnboardingNavigator({navigation}) {
  const root = useRef(null);
  const theme = useTheme();
  // The stack paints the theme background (light grey in this app); it must not cover the gradient.
  const clearTheme = useMemo(
    () => ({...theme, dark: true, colors: {...theme.colors, background: 'transparent'}}),
    [theme],
  );
  const background = useBackgroundControls();
  const [route, setRoute] = useState(ROUTES.welcome);
  // While "Wallet ready" holds onboarding open, the account is signed in but the root stack has no
  // signed-in route yet: a deep link would not get back. It stays in the store, and Home opens it.
  const hold = useHoldOnboarding();
  useDeeplinkForward(hold ? null : navigation);

  return (
    <BackdropSourceContext.Provider value={root}>
      <OnboardingProvider background={background}>
        <BiometryProbe />
        <TextFieldWarmup />
        <StatusBar barStyle="light-content" />
        <View ref={root} collapsable={false} style={styles.root}>
          <OnboardingBackground scene={background.scene} opacity={background.opacity} />
          <ThemeProvider value={clearTheme}>
            <SharedBackGlass visible={!NO_BACK.includes(route)} />
            <ContentFadeContext.Provider value={true}>
              <SharedBackGlassContext.Provider value={true}>
                <Screens background={background} onRoute={setRoute} />
              </SharedBackGlassContext.Provider>
            </ContentFadeContext.Provider>
          </ThemeProvider>
        </View>
      </OnboardingProvider>
    </BackdropSourceContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
  warmup: {position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10},
});
