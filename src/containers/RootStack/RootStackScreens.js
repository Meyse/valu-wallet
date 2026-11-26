import React, {useEffect} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import LoadingStackScreens from './LoadingStackScreens/LoadingStackScreens';
import SignedInStackScreens from './SignedInStackScreens/SignedInStackScreens';
import SignedOutStackScreens from './SignedOutStackScreens/SignedOutStackScreens';
import SignedOutNoKeyStackScreens from './SignedOutNoKeyStackScreens/SignedOutNoKeyStackScreens';
import DeepLinkStackScreens from './DeepLinkStackScreens/DeepLinkStackScreens';
import LoginRequestInfo from '../DeepLink/LoginRequestInfo/LoginRequestInfo';
import InvoiceInfo from '../DeepLink/InvoiceInfo/InvoiceInfo';
import Colors from '../../globals/colors';
import { SafeAreaView } from 'react-native';
import {useHoldOnboarding, useRedesignEnabled} from '../../redesign/state/redesignState';
import RedesignOnboarding from '../../redesign/onboarding/OnboardingNavigator';
import RedesignUnlock from '../../redesign/unlock/ReturningUser';
import RedesignHome from '../../redesign/home/HomeShell';
import RedesignSplash from '../../redesign/onboarding/RedesignSplash';

const RootStack = createStackNavigator();

// Redesign switch on: new onboarding, returning-user screen and Home shell.
// Switch off: the routes below are the app as it is on `main`.
// The new screens use the old route names: deep-link and service screens reset the root stack to
// 'SignedInStack', 'SignedOutStack' or 'SignedOutNoKeyStack' when they finish.
const redesignRoute = ({loading, hasAccount, signedIn, holdOnboarding}) => {
  // The dark splash, not the old blue loading screen: it shows for a frame under the splash cover.
  if (loading) return <RootStack.Screen name="LoadingStack" component={RedesignSplash} />;
  if (!hasAccount || holdOnboarding) {
    return <RootStack.Screen name="SignedOutNoKeyStack" component={RedesignOnboarding} />;
  }
  if (signedIn) return <RootStack.Screen name="SignedInStack" component={RedesignHome} />;
  return <RootStack.Screen name="SignedOutStack" component={RedesignUnlock} />;
};

const RootStackScreens = props => {
  const redesign = useRedesignEnabled();
  const holdOnboarding = useHoldOnboarding();

  return (
    <RootStack.Navigator
      screenOptions={{
        mode: 'modal',
        headerShown: false,
      }}>
      {/* The old and the new UI share route names, but not nested state. A new navigationKey
          removes the screens of the other UI and their nested state when the switch changes. */}
      <RootStack.Group navigationKey={redesign ? 'redesign' : 'classic'}>
        {redesign ? redesignRoute({...props, holdOnboarding}) : props.loading ? (
          <RootStack.Screen name="LoadingStack" component={LoadingStackScreens} />
        ) : props.hasAccount ? (
          props.signedIn ? (
            <RootStack.Screen name="SignedInStack" component={SignedInStackScreens} />
          ) : (
            <RootStack.Screen
              name="SignedOutStack"
              component={SignedOutStackScreens}
              options={{
                headerRight: () => null,
              }}
            />
          )
        ) : (
          <RootStack.Screen
            name="SignedOutNoKeyStack"
            component={SignedOutNoKeyStackScreens}
          />
        )}
      </RootStack.Group>
      <RootStack.Screen
        name="DeepLink"
        component={DeepLinkStackScreens}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="LoginRequestInfo"
        component={LoginRequestInfo}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="InvoiceInfo"
        component={InvoiceInfo}
        options={{ headerShown: false }}
      />
    </RootStack.Navigator>
  );
};

export default RootStackScreens;
