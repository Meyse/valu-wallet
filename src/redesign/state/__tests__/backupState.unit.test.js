// Paper p-5-0: no reminder while the wallet is empty, the sheet one time at the first funds, then
// the card until the backup is done. An imported wallet has no record and gets no reminder.
import {backupPrompt} from '../backupState';

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
