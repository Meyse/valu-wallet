// Backup inside the wallet (Paper p-5-0, Backup 04-08). A stack over the same shared gradient as
// onboarding, with the same screen motion. Opened from Home ("Back up now"); it closes back to Home.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {ThemeProvider, useTheme} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {colors} from '../theme/tokens';
import OnboardingBackground, {useBackgroundControls} from '../components/OnboardingBackground';
import {SCENES} from '../components/gradientMorph';
import {glassStackOptions} from '../components/stackMotion';
import {BackdropSourceContext} from '../components/Sheet';
import {ContentFadeContext, SharedBackGlass, SharedBackGlassContext} from '../components/Layout';
import {BACKUP_ROUTES, BackupProvider} from './BackupContext';
import ChooseWay from './screens/ChooseWay';
import WritePhrase from './screens/WritePhrase';
import VerifyPhrase from './screens/VerifyPhrase';
import ChipPassword from './screens/ChipPassword';
import CloudPassword from './screens/CloudPassword';
import CloudSaving from './screens/CloudSaving';
import {cloudCopy, useCloudStore} from '../cloud/useCloudStore';

const Stack = createStackNavigator();

// Paper: 04 uses the hero glow; the words and chip screens the dense header.
const SCENE_FOR = {
  [BACKUP_ROUTES.choose]: SCENES.hero,
  [BACKUP_ROUTES.words]: SCENES.dense,
  [BACKUP_ROUTES.verify]: SCENES.dense,
  [BACKUP_ROUTES.chip]: SCENES.dense,
  [BACKUP_ROUTES.cloudPassword]: SCENES.dense,
  [BACKUP_ROUTES.cloudSaving]: SCENES.hero,
};

export default function BackupNavigator({navigation}) {
  const root = useRef(null);
  const theme = useTheme();
  const clearTheme = useMemo(
    () => ({...theme, dark: true, colors: {...theme.colors, background: 'transparent'}}),
    [theme],
  );
  const accountHash = useSelector(state => state.authentication.activeAccount?.accountHash);
  const background = useBackgroundControls();
  const pending = useRef(null);
  const fallback = useRef(null);
  const [route, setRoute] = useState(BACKUP_ROUTES.choose);
  const store = useCloudStore();
  const cloud = useMemo(() => ({...store, copy: cloudCopy(store.store?.kind)}), [store]);
  // With cloud, "Choose a way" is a sheet (Paper Backup 04): no back button behind it. Saving has
  // no way back.
  const showBack =
    !(route === BACKUP_ROUTES.choose && cloud.mode !== 'none') && route !== BACKUP_ROUTES.cloudSaving;

  useEffect(() => {
    background.fadeTo(1, 600);
    return () => clearTimeout(fallback.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // As onboarding: the glow starts with the card (transitionStart); the fallback covers a screen
  // that opens without a transition.
  const applyScene = () => {
    clearTimeout(fallback.current);
    const name = pending.current;
    if (!name) return;
    pending.current = null;
    background.setScene(SCENE_FOR[name] ?? SCENES.dense);
  };
  const onFocus = name => {
    setRoute(name);
    pending.current = name;
    clearTimeout(fallback.current);
    fallback.current = setTimeout(applyScene, 150);
  };

  const finish = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <BackdropSourceContext.Provider value={root}>
      <BackupProvider accountHash={accountHash} finish={finish} cloud={cloud}>
        <StatusBar barStyle="light-content" />
        <View ref={root} collapsable={false} style={styles.root}>
          <OnboardingBackground scene={background.scene} opacity={background.opacity} />
          <ThemeProvider value={clearTheme}>
            <SharedBackGlass visible={showBack} />
            <ContentFadeContext.Provider value={true}>
              <SharedBackGlassContext.Provider value={true}>
                <Stack.Navigator
                  initialRouteName={BACKUP_ROUTES.choose}
                  screenOptions={glassStackOptions}
                  screenListeners={({route}) => ({
                    focus: () => onFocus(route.name),
                    transitionStart: applyScene,
                  })}>
                  <Stack.Screen name={BACKUP_ROUTES.choose} component={ChooseWay} />
                  <Stack.Screen name={BACKUP_ROUTES.words} component={WritePhrase} />
                  <Stack.Screen name={BACKUP_ROUTES.verify} component={VerifyPhrase} />
                  <Stack.Screen name={BACKUP_ROUTES.chip} component={ChipPassword} />
                  <Stack.Screen name={BACKUP_ROUTES.cloudPassword} component={CloudPassword} />
                  <Stack.Screen
                    name={BACKUP_ROUTES.cloudSaving}
                    component={CloudSaving}
                    options={{gestureEnabled: false}}
                  />
                </Stack.Navigator>
              </SharedBackGlassContext.Provider>
            </ContentFadeContext.Provider>
          </ThemeProvider>
        </View>
      </BackupProvider>
    </BackdropSourceContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
});
