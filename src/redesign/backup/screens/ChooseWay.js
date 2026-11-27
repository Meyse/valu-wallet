// Backup 04 - Choose a way, and Backup words 05 - Keep it secret (Paper p-5-0).
// With cloud backup: the sheet "Choose a way" over the glow (BackupWaySheet), and the state
// "iCloud is off". Without cloud (flag off, or the store is not set up): the screen
// "Alternative - Backup 04 - Choose a way, without cloud", as before.
// Words: the warning sheet, then the same wallet check the app makes today before it shows the
// recovery phrase, then the words. NFC chip: the chip password screen. The NFC way is hidden on a
// phone without NFC. Cloud: the backup password screen (CloudPassword).
import React, {useEffect, useRef, useState} from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {FadeView, TopBar, useBottomGap, useColumnWidth} from '../../components/Layout';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {colors, radius, type} from '../../theme/tokens';
import {isValid24WordBip39Mnemonic} from '../../../utils/walletBackup/walletBackup';
import {ELECTRUM} from '../../../utils/constants/intervalConstants';
import {BACKUP_ROUTES, useBackup} from '../BackupContext';
import {useWalletAuth} from '../useWalletAuth';
import {phoneHasNfc} from '../chipBackup';
import BackupWaySheet from '../BackupWaySheet';

const AFTER_SHEET_MS = 320;

function WayRow({icon, title, body, onPress, testID}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      testID={testID}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowTile}>
        <Icon name={icon} />
      </View>
      <View style={styles.rowText}>
        <Text style={[type.label, {color: colors.text}]}>{title}</Text>
        <Text style={[type.body, {color: colors.textSecondary}]}>{body}</Text>
      </View>
      <Icon name="chevronRightLight" />
    </Pressable>
  );
}

export default function ChooseWay({navigation, route}) {
  const {setPhrase, cloud, finish} = useBackup();
  // null while the store loads; then the sheet (cloud) or the screen without cloud.
  const sheetMode = cloud.mode == null ? null : cloud.mode !== 'none';
  const [waySheet, setWaySheet] = useState(false);
  const [offSheet, setOffSheet] = useState(false);
  const [focused, setFocused] = useState(false);
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  const [nfc, setNfc] = useState(false);
  const [secretSheet, setSecretSheet] = useState(false);
  const [noPhrase, setNoPhrase] = useState(false);
  const later = useRef(null);
  const auth = useWalletAuth({body: 'Enter the password of this wallet to see your recovery phrase.'});

  useEffect(() => {
    let alive = true;
    phoneHasNfc().then(v => alive && setNfc(v));
    return () => {
      alive = false;
      clearTimeout(later.current);
    };
  }, []);

  // Back on this screen: the words of the run are not needed any more.
  useFocusEffect(
    React.useCallback(() => {
      setPhrase(null);
      setFocused(true);
      return () => setFocused(false);
    }, [setPhrase]),
  );

  // With cloud, this screen is only the sheet: it opens each time the screen shows (also Back
  // from a lane), once the store is known.
  const reopen = () => {
    clearTimeout(later.current);
    later.current = setTimeout(() => setWaySheet(true), AFTER_SHEET_MS);
  };
  useEffect(() => {
    if (sheetMode && focused && !route.params?.words) reopen();
    if (!focused) setWaySheet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetMode, focused]);

  // The cloud is checked again on each tap: after "Open Settings" the user comes back here with
  // iCloud Drive on, and the save goes on without a restart of the app.
  const openCloud = async () => {
    let ok = false;
    try {
      ok = (await cloud.store?.isAvailable())?.ok === true;
    } catch (e) {
      ok = false;
    }
    clearTimeout(later.current);
    if (ok) navigation.navigate(BACKUP_ROUTES.cloudPassword);
    else later.current = setTimeout(() => setOffSheet(true), AFTER_SHEET_MS);
  };

  const choose = way => {
    setWaySheet(false);
    clearTimeout(later.current);
    if (way === 'cloud') {
      openCloud();
      return;
    }
    later.current = setTimeout(() => {
      if (way === 'words') setSecretSheet(true);
      else navigation.navigate(BACKUP_ROUTES.chip);
    }, way === 'nfc' ? 0 : AFTER_SHEET_MS);
  };

  // A sheet of the words lane closed without going on: back to "Choose a way".
  const closeSecret = () => {
    setSecretSheet(false);
    if (sheetMode) reopen();
  };

  // "Write down the words" on the chip screen's "This phone cannot use NFC" sheet.
  useEffect(() => {
    if (!route.params?.words) return;
    setSecretSheet(true);
    // Used once: a later visit to this screen opens "Choose a way" again.
    navigation.setParams({words: undefined});
  }, [route.params?.words, navigation]);

  const showWords = () => {
    setSecretSheet(false);
    clearTimeout(later.current);
    later.current = setTimeout(async () => {
      const result = await auth.ask();
      if (!result) {
        if (sheetMode) reopen();
        return;
      }
      const mnemonic = result.seeds?.[ELECTRUM];
      if (!isValid24WordBip39Mnemonic(mnemonic)) {
        setNoPhrase(true);
        return;
      }
      setPhrase(mnemonic.trim().split(/\s+/));
      navigation.navigate(BACKUP_ROUTES.words, {page: 0});
    }, AFTER_SHEET_MS);
  };

  return (
    <View style={styles.root}>
      {sheetMode === false ? (
      <>
      <FadeView style={[styles.content, {bottom: bottomGap + 16, width: column}]}>
        <View style={styles.header}>
          <View style={styles.tile}>
            <Icon name="shieldCheck" />
          </View>
          <Text style={[type.title, styles.center, {color: colors.text}]} accessibilityRole="header">
            Back up your wallet
          </Text>
          <Text style={[type.bodyLarge, styles.center, {color: colors.textSecondary}]}>
            Keep a copy of your recovery phrase.
          </Text>
        </View>
        <View style={styles.list}>
          <WayRow
            icon="docLines"
            title="Write down the words"
            body="24 words on paper"
            onPress={() => setSecretSheet(true)}
            testID="backup-way-words"
          />
          {nfc ? (
            <WayRow
              icon="nfcCard24"
              title="NFC chip"
              body="Save it on a chip you hold"
              onPress={() => navigation.navigate(BACKUP_ROUTES.chip)}
              testID="backup-way-nfc"
            />
          ) : null}
        </View>
      </FadeView>
      <TopBar onBack={() => navigation.goBack()} />
      </>
      ) : null}
      <BackupWaySheet
        visible={waySheet}
        onClose={() => {
          setWaySheet(false);
          finish();
        }}
        onChoose={choose}
        copy={cloud.copy}
        nfc={nfc}
      />
      <Sheet
        visible={offSheet}
        onClose={() => {
          setOffSheet(false);
          reopen();
        }}
        icon={<Icon name="cloud48" />}
        title={cloud.copy.offTitle}
        body={cloud.copy.offBody}
        testID="backup-cloud-off-sheet"
        buttons={[
          {
            label: 'Open Settings',
            variant: 'accent',
            testID: 'backup-cloud-off-settings',
            onPress: () => {
              setOffSheet(false);
              Linking.openSettings().catch(() => {});
              reopen();
            },
          },
          {
            label: 'Cancel',
            testID: 'backup-cloud-off-cancel',
            onPress: () => {
              setOffSheet(false);
              reopen();
            },
          },
        ]}
      />
      <Sheet
        visible={secretSheet}
        onClose={closeSecret}
        icon={<Icon name="shieldAlert" />}
        title="Keep your phrase secret"
        body="Anyone with these words can take your funds. Valu will never ask for them."
        testID="backup-secret-sheet"
        buttons={[
          {label: 'I understand', variant: 'accent', onPress: showWords, testID: 'backup-secret-ok'},
          {label: 'Not now', onPress: closeSecret, testID: 'backup-secret-later'},
        ]}
      />
      <Sheet
        visible={noPhrase}
        onClose={() => {
          setNoPhrase(false);
          if (sheetMode) reopen();
        }}
        icon={<Icon name="shieldAlert" />}
        title="No recovery phrase to show"
        body="This wallet was not made from 24 words. Keep the key or phrase you imported it from in a safe place."
        testID="backup-no-phrase-sheet"
        buttons={[
          {
            label: 'Close',
            onPress: () => {
              setNoPhrase(false);
              if (sheetMode) reopen();
            },
            testID: 'backup-no-phrase-close',
          },
        ]}
      />
      {auth.element}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {position: 'absolute', alignSelf: 'center', gap: 40},
  header: {alignItems: 'center', gap: 8},
  tile: {
    width: 96,
    height: 96,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  center: {textAlign: 'center'},
  list: {gap: 8},
  row: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rowPressed: {backgroundColor: '#FFFFFF0A'},
  rowTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {flex: 1, gap: 0},
});
