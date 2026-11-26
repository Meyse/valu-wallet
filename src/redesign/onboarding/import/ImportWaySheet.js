// Import 02 - Choose a way (Paper p-2-0): a sheet with a grabber over Welcome. One large light tile
// for the phrase lane (words or a private key), and two dark tiles for Scan QR and the NFC chip.
// A swipe down, a tap on the backdrop or Back closes it.
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SheetFrame} from '../../components/Sheet';
import Icon from '../../components/Icon';
import {colors, radius, type} from '../../theme/tokens';

function SmallTile({icon, label, onPress, testID}) {
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

export default function ImportWaySheet({visible, onClose, onChoose}) {
  return (
    <SheetFrame visible={visible} onClose={onClose} grabber cardStyle={styles.card} testID="import-way-sheet">
      <Pressable
        onPress={() => onChoose('phrase')}
        accessibilityRole="button"
        accessibilityLabel="Import phrase. Words or private key"
        testID="import-way-phrase"
        style={({pressed}) => [styles.big, pressed && styles.bigPressed]}>
        <View style={styles.bigTop}>
          <Icon name="wayPhrase" />
          <Icon name="chevronDark" />
        </View>
        <View style={styles.bigTexts}>
          <Text style={[type.titleSmall, styles.bigTitle]}>Import phrase</Text>
          <Text style={[type.body, styles.bigBody]}>Words or private key</Text>
        </View>
      </Pressable>
      <View style={styles.row}>
        <SmallTile icon="wayQr" label="Scan QR" onPress={() => onChoose('qr')} testID="import-way-qr" />
        <SmallTile icon="wayNfc" label="From NFC chip" onPress={() => onChoose('nfc')} testID="import-way-nfc" />
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  card: {padding: 12, gap: 8},
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
  row: {flexDirection: 'row', gap: 8},
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
});
