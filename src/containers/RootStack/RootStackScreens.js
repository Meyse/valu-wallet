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

const RootStack = createStackNavigator();

// Redesign switch on: new onboarding, returning-user screen and Home shell.
// Switch off: the routes below are the app as it is on `main`.
const redesignRoute = ({loading, hasAccount, signedIn, holdOnboarding}) => {
  if (loading) return <RootStack.Screen name="LoadingStack" component={LoadingStackScreens} />;
  if (!hasAccount || holdOnboarding) {
    return <RootStack.Screen name="RedesignOnboarding" component={RedesignOnboarding} />;
  }
  if (signedIn) return <RootStack.Screen name="RedesignHome" component={RedesignHome} />;
  return <RootStack.Screen name="RedesignUnlock" component={RedesignUnlock} />;
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
