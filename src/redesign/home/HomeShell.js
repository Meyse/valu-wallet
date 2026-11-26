// New Home shell: four tabs plus Settings.
// iOS: the system tab bar (react-native-screens), which is Liquid Glass on iOS 26.
// Android: the Brand floating pill (A02), drawn in JS over the content.
import React, {useMemo} from 'react';
import {Platform, StatusBar} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {ThemeProvider, useTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeBottomTabNavigator} from '@react-navigation/bottom-tabs/unstable';
import {useDeeplinkForward} from '../state/useDeeplinkForward';
import {colors} from '../theme/tokens';
import BackupNavigator from '../backup/BackupNavigator';
import BrandTabBar from './BrandTabBar';
import HomeScreen from './HomeScreen';
import PlaceholderScreen from './PlaceholderScreen';
import SettingsScreen from './SettingsScreen';
import {TAB_ICONS} from './tabs';

const IS_IOS = Platform.OS === 'ios';
const Tab = IS_IOS ? createNativeBottomTabNavigator() : createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_NAMES = ['Home', 'Credentials', 'Money', 'Agents'];

const iosOptions = name => ({
  title: name,
  tabBarIcon: () => ({type: 'image', source: TAB_ICONS[name].image}),
});

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={
        IS_IOS
          ? {headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textSecondary}
          : {headerShown: false, sceneStyle: {backgroundColor: colors.surface}}
      }
      tabBar={IS_IOS ? undefined : props => <BrandTabBar {...props} />}>
      {TAB_NAMES.map(name => (
        <Tab.Screen
          key={name}
          name={name}
          component={name === 'Home' ? HomeScreen : PlaceholderScreen}
          options={IS_IOS ? iosOptions(name) : {title: name}}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function HomeShell({navigation}) {
  useDeeplinkForward(navigation);
  const theme = useTheme();
  // Dark navigator theme for the new Home (the app theme is light).
  const darkTheme = useMemo(
    () => ({
      ...theme,
      dark: true,
      colors: {...theme.colors, background: colors.surface, card: colors.surface, text: colors.text, border: colors.borderSubtle, primary: colors.accent},
    }),
    [theme],
  );
  return (
    <ThemeProvider value={darkTheme}>
      <StatusBar barStyle="light-content" />
      <Stack.Navigator screenOptions={{headerShown: false, cardStyle: {backgroundColor: colors.surface}}}>
        <Stack.Screen name="RedesignTabs" component={Tabs} />
        <Stack.Screen name="RedesignSettings" component={SettingsScreen} />
        <Stack.Screen name="RedesignBackup" component={BackupNavigator} />
      </Stack.Navigator>
    </ThemeProvider>
  );
}
