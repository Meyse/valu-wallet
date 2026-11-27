// Backup 04 - Choose a way, with cloud backup (Paper p-5-0; Android: "Backup 04 Android wording").
// A sheet with a grabber: the large light tile "Save to iCloud" (Android "Save to Google Drive"),
// and the small tiles "Write on paper" and "To NFC chip". The NFC tile is left out on a phone
// without NFC, as the chip row of the screen without cloud.
import React from 'react';
import {View} from 'react-native';
import {SheetFrame} from '../components/Sheet';
import {BigTile, SmallTile, sheetStyles} from '../onboarding/import/ImportWaySheet';

export default function BackupWaySheet({visible, onClose, onChoose, copy, nfc}) {
  return (
    <SheetFrame visible={visible} onClose={onClose} grabber cardStyle={sheetStyles.card} testID="backup-way-sheet">
      <BigTile
        icon="cloudDark"
        title={copy.saveTile}
        body={copy.saveTileBody}
        onPress={() => onChoose('cloud')}
        testID="backup-way-cloud"
      />
      <View style={sheetStyles.row}>
        <SmallTile icon="wayPaper" label="Write on paper" onPress={() => onChoose('words')} testID="backup-way-words" />
        {nfc ? <SmallTile icon="wayNfc" label="To NFC chip" onPress={() => onChoose('nfc')} testID="backup-way-nfc" /> : null}
      </View>
    </SheetFrame>
  );
}
