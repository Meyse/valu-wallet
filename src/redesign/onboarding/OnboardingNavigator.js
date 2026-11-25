// Redesigned onboarding (R01 to R15). The shared background is mounted once here, behind the
// stack, so its clock never resets on navigation. Screens have transparent cards.
import React, {useEffect, useRef} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {colors} from '../theme/tokens';
import OnboardingBackground, {useBackgroundControls} from '../components/OnboardingBackground';
import {BackdropSourceContext} from '../components/Sheet';
import {DENSE_ROUTES, ROUTES} from '../logic/steps';
import {getSupportedBiometryType} from '../../utils/keychain/keychain';
import {OnboardingProvider, useOnboarding} from './OnboardingContext';
import {useDeeplinkForward} from '../state/useDeeplinkForward';
import Welcome from './screens/Welcome';
import ImportPhrase from './screens/ImportPhrase';
import ImportKey from './screens/ImportKey';
import ScanQr from './screens/ScanQr';
import CreatePassword from './screens/CreatePassword';
import UseFaceId from './screens/UseFaceId';
import BackUp from './screens/BackUp';
import RecoveryPhrase from './screens/RecoveryPhrase';
import VerifyPhrase from './screens/VerifyPhrase';
import Creating from './screens/Creating';

const Stack = createStackNavigator();

// Paper moves the gradient header up by 230 on dense screens (T -230).
export const DENSE_LIFT = -230;

// Cards are transparent over the shared background, so screens cross-fade with a short
// slide instead of sliding over each other.
const fadeSlide = ({current, next, layouts}) => ({
  cardStyle: {
    opacity: next
      ? next.progress.interpolate({inputRange: [0, 1], outputRange: [1, 0]})
      : current.progress.interpolate({inputRange: [0, 1], outputRange: [0, 1]}),
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

function Screens({background}) {
  const onFocus = name => {
    background.setLift(DENSE_ROUTES.includes(name) ? DENSE_LIFT : 0);
    // No glow on the camera screen (DESIGN.md).
    if (name === ROUTES.scanQr) background.fadeTo(0, 300);
    else if (name !== ROUTES.welcome) background.fadeTo(1, 600);
  };
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.welcome}
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'transparent'},
        cardStyleInterpolator: fadeSlide,
        gestureEnabled: true,
      }}
      screenListeners={({route}) => ({focus: () => onFocus(route.name)})}>
      <Stack.Screen name={ROUTES.welcome} component={Welcome} />
      <Stack.Screen name={ROUTES.importPhrase} component={ImportPhrase} />
      <Stack.Screen name={ROUTES.importKey} component={ImportKey} />
      <Stack.Screen name={ROUTES.scanQr} component={ScanQr} />
      <Stack.Screen name={ROUTES.password} component={CreatePassword} />
      <Stack.Screen name={ROUTES.faceId} component={UseFaceId} />
      <Stack.Screen name={ROUTES.backUp} component={BackUp} />
      <Stack.Screen name={ROUTES.phrase} component={RecoveryPhrase} />
      <Stack.Screen name={ROUTES.verify} component={VerifyPhrase} />
      <Stack.Screen name={ROUTES.creating} component={Creating} options={{gestureEnabled: false}} />
    </Stack.Navigator>
  );
}

export default function OnboardingNavigator({navigation}) {
  const root = useRef(null);
  const background = useBackgroundControls();
  useDeeplinkForward(navigation);

  return (
    <BackdropSourceContext.Provider value={root}>
      <OnboardingProvider background={background}>
        <BiometryProbe />
        <StatusBar barStyle="light-content" />
        <View ref={root} collapsable={false} style={styles.root}>
          <OnboardingBackground lift={background.lift} opacity={background.opacity} />
          <Screens background={background} />
        </View>
      </OnboardingProvider>
    </BackdropSourceContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
});
