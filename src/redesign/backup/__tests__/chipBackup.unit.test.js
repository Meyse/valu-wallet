// The chip lane shows the library's English errors as redesign copy. The messages below are the
// ones src/utils/walletBackup/walletBackupNfc.js throws.
jest.mock('react-native-nfc-manager', () => ({isSupported: jest.fn(), setAlertMessageIOS: jest.fn()}));
jest.mock('../../../utils/walletBackup/walletBackup', () => ({}));
jest.mock('../../../utils/walletBackup/walletBackupNfc', () => ({}));
jest.mock('../../../utils/keepAwake/keepAwake', () => ({}));

const {chipWriteError} = require('../chipBackup');

const title = message => chipWriteError(new Error(message))?.title;

describe('chipWriteError', () => {
  it('shows nothing when the user cancels the system sheet', () => {
    expect(chipWriteError(new Error('UserCancel'))).toBeNull();
  });

  it('sends a phone without NFC to the words lane', () => {
    expect(chipWriteError(new Error('NFC is not supported on this device.'))).toEqual({noNfc: true});
  });

  it('names the reason when the chip cannot take the backup', () => {
    expect(title('NFC is disabled on this device.')).toBe('NFC is off');
    expect(title('This NFC card already contains a wallet backup. Refusing to overwrite it.')).toBe(
      'This chip already holds a backup',
    );
    expect(
      title('This NFC card contains a funded spendable key that has not been saved to pending requests. Refusing to overwrite it.'),
    ).toBe('This chip already holds data');
    expect(title('This NFC card is read-only and cannot be used for backup.')).toBe('This chip cannot hold the backup');
    expect(title('This NFC card does not have enough space for the wallet backup.')).toBe('This chip cannot hold the backup');
  });

  it('says "Backup not written" when the write stops for another reason', () => {
    expect(title('Tag connection lost')).toBe('Backup not written');
  });
});
