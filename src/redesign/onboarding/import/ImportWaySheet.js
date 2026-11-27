// Import 02 - Choose a way (Paper p-2-0): a sheet with a grabber over Welcome. A swipe down, a tap
// on the backdrop or Back closes it.
// With cloud backup (Paper "Import 02 - Choose a way"): the large light tile "From iCloud" (Android:
// "From Google Drive"), the row "Import phrase", and the small tiles Scan QR and From NFC chip.
// Without cloud ("Alternative - Import 02 - Choose a way, without cloud"): the large light tile is
// "Import phrase", with the same two small tiles.
// The tiles are shared with the backup sheet (BackupWaySheet).
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SheetFrame} from '../../components/Sheet';
import Icon from '../../components/Icon';
import {colors, radius, type} from '../../theme/tokens';

export function SmallTile({icon, label, onPress, testID}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({pressed}) => [styles.small, pressed && styles.smallPressed]}>
      <Icon name={icon} />
      <Text style={[type.label, styles.smallLabel]}>{label}</Text>
    </Pressable>
  );
}

export function BigTile({icon, title, body, onPress, testID}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      testID={testID}
      style={({pressed}) => [styles.big, pressed && styles.bigPressed]}>
      <View style={styles.bigTop}>
        <Icon name={icon} />
        <Icon name="chevronDark" />
      </View>
      <View style={styles.bigTexts}>
        <Text style={[type.titleSmall, styles.bigTitle]}>{title}</Text>
        <Text style={[type.body, styles.bigBody]}>{body}</Text>
      </View>
    </Pressable>
  );
}

// Paper: the 72-high dark row with the icon at the left (Import 02, "Import phrase").
function RowTile({icon, title, body, onPress, testID}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      testID={testID}
      style={({pressed}) => [styles.rowTile, pressed && styles.smallPressed]}>
      <Icon name={icon} />
      <View style={styles.rowTexts}>
        <Text style={[type.label, styles.smallLabel]}>{title}</Text>
        <Text style={[type.body, styles.rowBody]}>{body}</Text>
      </View>
    </Pressable>
  );
}

// cloud: null for the sheet without cloud, else {title, body} of the cloud tile.
export default function ImportWaySheet({visible, onClose, onChoose, cloud = null}) {
  return (
    <SheetFrame visible={visible} onClose={onClose} grabber cardStyle={styles.card} testID="import-way-sheet">
      {cloud ? (
        <>
          <BigTile
            icon="cloudDark"
            title={cloud.title}
            body={cloud.body}
            onPress={() => onChoose('cloud')}
            testID="import-way-cloud"
          />
          <RowTile
            icon="wayPaper"
            title="Import phrase"
            body="Words or private key"
            onPress={() => onChoose('phrase')}
            testID="import-way-phrase"
          />
        </>
      ) : (
        <BigTile
          icon="wayPhrase"
          title="Import phrase"
          body="Words or private key"
          onPress={() => onChoose('phrase')}
          testID="import-way-phrase"
        />
      )}
      <View style={styles.row}>
        <SmallTile icon="wayQr" label="Scan QR" onPress={() => onChoose('qr')} testID="import-way-qr" />
        <SmallTile icon="wayNfc" label="From NFC chip" onPress={() => onChoose('nfc')} testID="import-way-nfc" />
      </View>
    </SheetFrame>
  );
}

export const sheetStyles = StyleSheet.create({
  card: {padding: 12, gap: 8},
  row: {flexDirection: 'row', gap: 8},
});

const styles = StyleSheet.create({
  card: sheetStyles.card,
  big: {
    height: 124,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
  },
  bigPressed: {opacity: 0.85},
  bigTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  bigTexts: {gap: 4},
  bigTitle: {color: colors.textOnPrimary},
  bigBody: {color: '#525252'},
  row: sheetStyles.row,
  small: {
    flex: 1,
    height: 104,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    justifyContent: 'space-between',
  },
  smallPressed: {backgroundColor: '#FFFFFF14'},
  smallLabel: {color: colors.text},
  rowTile: {
    height: 72,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rowTexts: {gap: 2},
  rowBody: {color: '#EBEBEB'},
});
