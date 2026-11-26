// Paper p-5-0: no reminder while the wallet is empty, the sheet one time at the first funds, then
// the card until the backup is done. An imported wallet has no record and gets no reminder.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {backupPrompt, markFundsSheetShown, readBackup, recordNeedsBackup} from '../backupState';

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
