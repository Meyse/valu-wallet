// Backup iCloud 06 - Saving, 06 state - Not saved, and 07 - Done (Paper p-5-0; Android says Google
// Drive). The save seals the seed with the backup password, writes the file, reads it back and
// opens it again (saveCloudBackup). Only then the wallet is marked backed up, and "Done" shows.
// A kill at any point leaves the reminder on Home: the record changes after the read-back only.
// The seed and the password are dropped from memory when the save ends, either way.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {FadeView, LogoTile, useColumnWidth} from '../../components/Layout';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {colors, type} from '../../theme/tokens';
import {newBackupId, saveCloudBackup} from '../../../utils/cloudBackup/cloudBackup';
import {cloudErrorKind} from '../../../utils/cloudBackup/cloudErrors';
import {markBackedUp, readBackup, rememberCloudBackupId} from '../../state/backupState';
import {useBackup} from '../BackupContext';
import BackupDone from './BackupDone';

function Spinner({label}) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, {duration: 900, easing: Easing.linear}), -1);
    return () => cancelAnimation(r);
  }, [r]);
  const style = useAnimatedStyle(() => ({transform: [{rotate: `${r.value}deg`}]}));
  return (
    <Animated.View style={style} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Icon name="spinner" />
    </Animated.View>
  );
}

export default function CloudSaving({navigation}) {
  const {accountHash, cloud, cloudJob, finish} = useBackup();
  const copy = cloud.copy;
  const column = useColumnWidth();
  // 'saving' | 'failed' | 'done'
  const [phase, setPhase] = useState('saving');
  const running = useRef(false);
  const leaving = useRef(false);

  // No Back while the file is written; after that only the sheet buttons leave.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!leaving.current) e.preventDefault();
      }),
    [navigation],
  );
  // However this screen goes, the seed and the password do not stay in memory.
  useEffect(
    () => () => {
      cloudJob.current = null;
    },
    [cloudJob],
  );

  const save = async () => {
    const job = cloudJob.current;
    if (running.current || !job || !cloud.store) {
      if (!job) setPhase('failed');
      return;
    }
    running.current = true;
    setPhase('saving');
    try {
      const record = await readBackup(accountHash);
      const backupId = record?.cloudBackupId ?? (await newBackupId());
      if (!record?.cloudBackupId) await rememberCloudBackupId(accountHash, backupId);
      await saveCloudBackup({store: cloud.store, seed: job.seed, password: job.password, backupId});
      await markBackedUp(accountHash, 'cloud');
      cloudJob.current = null;
      setPhase('done');
    } catch (e) {
      // A closed Google consent screen: back to the password screen, nothing to report.
      if (cloudErrorKind(e) === 'cancelled') {
        cloudJob.current = null;
        leave(() => navigation.goBack());
        return;
      }
      setPhase('failed');
    } finally {
      running.current = false;
    }
  };

  useEffect(() => {
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = go => {
    leaving.current = true;
    go();
  };

  return (
    <FadeView style={styles.root}>
      {phase === 'saving' ? (
        <View style={styles.center}>
          <View style={[styles.group, {width: Math.min(298, column)}]}>
            <LogoTile icon="cloud48" />
            <View style={styles.copy}>
              <Text style={[type.title, styles.text]} accessibilityRole="header">
                {copy.savingTitle}
              </Text>
              <Text style={[type.bodyLarge, styles.text]}>{copy.savingBody}</Text>
            </View>
            <Spinner label={copy.savingTitle} />
          </View>
        </View>
      ) : null}
      <Sheet
        visible={phase === 'failed'}
        onClose={() => leave(finish)}
        icon={<Icon name="cloud48" />}
        title={copy.notSavedTitle}
        body={copy.notSavedBody}
        testID="cloud-not-saved-sheet"
        buttons={[
          {
            label: 'Try again',
            variant: 'accent',
            testID: 'cloud-not-saved-retry',
            onPress: () => {
              if (!cloudJob.current) {
                // The seed was dropped (a restart of this screen): ask again from the start.
                leave(() => navigation.goBack());
                return;
              }
              save();
            },
          },
          {label: 'Cancel', testID: 'cloud-not-saved-cancel', onPress: () => leave(finish)},
        ]}
      />
      <BackupDone
        visible={phase === 'done'}
        title={copy.doneTitle}
        body={copy.doneBody}
        onDone={() => leave(finish)}
      />
    </FadeView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
  group: {alignItems: 'center', gap: 40},
  copy: {alignItems: 'center', gap: 16},
  text: {color: colors.text, textAlign: 'center'},
});
