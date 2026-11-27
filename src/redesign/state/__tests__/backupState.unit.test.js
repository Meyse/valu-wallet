// Paper p-5-0: no reminder while the wallet is empty, the sheet one time at the first funds, then
// the card until the backup is done. An imported wallet has no record and gets no reminder.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  backupPrompt,
  markBackedUp,
  markFundsSheetShown,
  readBackup,
  recordNeedsBackup,
  recordRestoredCloudBackup,
  rememberCloudBackupId,
} from '../backupState';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('backupPrompt', () => {
  const fresh = {needsBackup: true, fundsSheetShown: false};

  it('asks nothing while the wallet is empty', () => {
    expect(backupPrompt(fresh, false)).toBe('none');
  });

  it('shows the sheet at the first funds, then the card', () => {
    expect(backupPrompt(fresh, true)).toBe('sheet');
    expect(backupPrompt({...fresh, fundsSheetShown: true}, true)).toBe('card');
  });

  it('asks nothing after the backup or for an imported wallet', () => {
    expect(backupPrompt({needsBackup: false, fundsSheetShown: true, backedUpAt: 1, method: 'words'}, true)).toBe('none');
    expect(backupPrompt(null, true)).toBe('none');
  });
});

describe('markFundsSheetShown', () => {
  it('keeps the reminder when the record cannot be read', async () => {
    await recordNeedsBackup('acct');
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('read failed'));
    await markFundsSheetShown('acct');
    expect(await readBackup('acct')).toEqual({needsBackup: true, fundsSheetShown: false});
  });
});

// Plan B4: the cloud file id is kept before the first write, and the reminder stays until the
// saved file reads back. A wallet restored from the cloud keeps the id of its file.
describe('cloud backup record', () => {
  const ID = '0123456789abcdef0123456789abcdef';

  it('keeps the reminder when only the file id is stored (a save stopped before the read-back)', async () => {
    await recordNeedsBackup('cloud1');
    await rememberCloudBackupId('cloud1', ID);
    const record = await readBackup('cloud1');
    expect(record).toEqual({needsBackup: true, fundsSheetShown: false, cloudBackupId: ID});
    expect(backupPrompt({...record, fundsSheetShown: true}, true)).toBe('card');
  });

  it('ends the reminder after the verified save and keeps the file id', async () => {
    await recordNeedsBackup('cloud2');
    await rememberCloudBackupId('cloud2', ID);
    await markBackedUp('cloud2', 'cloud');
    const record = await readBackup('cloud2');
    expect(record).toMatchObject({needsBackup: false, method: 'cloud', cloudBackupId: ID});
    expect(backupPrompt(record, true)).toBe('none');
  });

  it('stores no file id when the record cannot be read', async () => {
    await recordNeedsBackup('cloud3');
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('read failed'));
    await expect(rememberCloudBackupId('cloud3', ID)).rejects.toThrow('read failed');
    expect(await readBackup('cloud3')).toEqual({needsBackup: true, fundsSheetShown: false});
  });

  it('a restored wallet has a backup and the id of its file', async () => {
    await recordRestoredCloudBackup('cloud4', ID);
    const record = await readBackup('cloud4');
    expect(record).toEqual({needsBackup: false, fundsSheetShown: true, cloudBackupId: ID});
    expect(backupPrompt(record, true)).toBe('none');
  });
});
