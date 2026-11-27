// Settings of the new Home (not in Paper; same language as Home). Two rows for this build:
// lock the wallet (as the old Settings "Sign out") and go back to the old wallet UI.
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';
import {signOut, setSuppressUnlockAutoBiometrics} from '../../actions/actionCreators';
import {clearActiveAccountLifecycles} from '../../actions/actionDispatchers';
import {BACK_SIZE, TopBar, useTopBarTop} from '../components/Layout';
import {setRedesignEnabled} from '../state/redesignState';
import {colors, type} from '../theme/tokens';
import {
  DEBUG_STORE_MODES,
  debugStoreLabel,
  readDebugCloudStore,
  setDebugCloudStore,
} from '../../utils/cloudBackup/debugCloudStore';
import {readDebugWeakPrompt, setDebugWeakPrompt} from '../state/weakPasswordPrompt';

const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

// Debug builds only (QA): the cloud store, the weak password prompt, and the backup flow without
// funds (Home shows the backup card only with funds).
function DebugRows({navigation}) {
  const [store, setStore] = useState(null);
  const [weak, setWeak] = useState(false);
  useEffect(() => {
    readDebugCloudStore().then(setStore);
    readDebugWeakPrompt().then(setWeak);
  }, []);
  const nextStore = async () => {
    const next = DEBUG_STORE_MODES[(DEBUG_STORE_MODES.indexOf(store) + 1) % DEBUG_STORE_MODES.length];
    await setDebugCloudStore(next);
    setStore(next);
  };
  const toggleWeak = async () => {
    await setDebugWeakPrompt(!weak);
    setWeak(!weak);
  };
  return (
    <View style={{gap: 8}}>
      <Text style={[type.label, {color: colors.textSecondary, paddingHorizontal: 4}]}>Debug build only</Text>
      <Row
        title="Back up wallet"
        body="Opens the backup flow. Home shows the backup card only with funds."
        onPress={() => navigation.navigate('RedesignBackup')}
        testID="settings-debug-backup"
      />
      <Row title="Cloud store" body={debugStoreLabel(store)} onPress={nextStore} testID="settings-debug-cloud-store" />
      <Row
        title="Weak password prompt"
        body={weak ? 'On: Home shows it on each visit. Not shown to users yet.' : 'Off'}
        onPress={toggleWeak}
        testID="settings-debug-weak-prompt"
      />
    </View>
  );
}

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
        {DEV ? <DebugRows navigation={navigation} /> : null}
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
