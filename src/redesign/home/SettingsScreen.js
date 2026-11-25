// Settings of the new Home (not in Paper; same language as Home). Two rows for this build:
// lock the wallet (as the old Settings "Sign out") and go back to the old wallet UI.
import React, {useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';
import {signOut, setSuppressUnlockAutoBiometrics} from '../../actions/actionCreators';
import {clearActiveAccountLifecycles} from '../../actions/actionDispatchers';
import {BACK_SIZE, TopBar, useTopBarTop} from '../components/Layout';
import {setRedesignEnabled} from '../state/redesignState';
import {colors, type} from '../theme/tokens';

function Row({title, body, onPress, busy, testID}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{busy: !!busy}}
      testID={testID}
      style={({pressed}) => [styles.row, pressed && {opacity: 0.8}]}>
      <View style={{flex: 1, gap: 4}}>
        <Text style={[type.label, {color: colors.text}]}>{title}</Text>
        {body ? <Text style={[type.body, {color: colors.textSecondary}]}>{body}</Text> : null}
      </View>
      {busy ? <ActivityIndicator color={colors.text} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen({navigation}) {
  const dispatch = useDispatch();
  const top = useTopBarTop();
  const [locking, setLocking] = useState(false);

  // Same steps as the old Settings sign-out (SettingsMenus.handleLogout).
  const lock = async () => {
    setLocking(true);
    try {
      await clearActiveAccountLifecycles();
    } finally {
      dispatch(setSuppressUnlockAutoBiometrics(true));
      dispatch(signOut());
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{paddingTop: top + BACK_SIZE + 40, paddingHorizontal: 16, gap: 32}}>
        <Text style={[type.title, {color: colors.text}]} accessibilityRole="header">
          Settings
        </Text>
        <View style={{gap: 8}}>
          <Row title="Lock wallet" body="You unlock it again on the next screen." onPress={lock} busy={locking} testID="settings-lock" />
          <Row
            title="Old wallet UI"
            body="Use the previous design. Settings there has a way back."
            onPress={() => setRedesignEnabled(false)}
            testID="settings-old-ui"
          />
        </View>
      </ScrollView>
      <TopBar onBack={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface},
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.fillSubtle,
  },
});
