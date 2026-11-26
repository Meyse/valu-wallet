// Backup words 08 - Done and Backup NFC 08 - Done (Paper p-5-0): one sheet, one "Done" button,
// back to Home. The backup is already recorded when this shows.
import React from 'react';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';

export default function BackupDone({visible, title, body, onDone}) {
  return (
    <Sheet
      visible={visible}
      onClose={onDone}
      icon={<Icon name="shieldCheck" />}
      title={title}
      body={body}
      testID="backup-done-sheet"
      buttons={[{label: 'Done', variant: 'accent', onPress: onDone, testID: 'backup-done'}]}
    />
  );
}
