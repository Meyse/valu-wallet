// R01 Splash: the Valu logo on #292929, centred. Shown while the app loads its storage.
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useRedesignEnabled} from '../state/redesignState';
import {colors} from '../theme/tokens';
import Icon from '../components/Icon';

export const useSplashIsRedesigned = () => useRedesignEnabled();

export default function RedesignSplash() {
  return (
    <View style={styles.root} testID="redesign-splash">
      <View style={styles.box}>
        <Icon name="valuLogo" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center'},
  box: {width: 112, height: 112, alignItems: 'center', justifyContent: 'center'},
});
