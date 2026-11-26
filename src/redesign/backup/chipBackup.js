// The NFC chip lane of the backup (Paper p-5-0, Backup NFC 05-08). It uses the existing wallet
// backup calls unchanged, in the order of the old NFC backup screen (WalletBackupRequestInfo):
// the record format and the encryption stay Verus Mobile compatible. The key stretch is the old
// screen's default (medium). The library releases the chip at the end of the write, so it cannot
// read the chip back in the same session: the write is not verified by a read.
import {Platform} from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import {
  WALLET_BACKUP_ENCRYPTION_ITERS_MEDIUM,
  buildWalletBackupOrdinal,
} from '../../utils/walletBackup/walletBackup';
import {
  beginWalletBackupNfcSession,
  cancelWalletBackupNfcRequest,
  endWalletBackupNfcSession,
  writeWalletBackupToNfc,
} from '../../utils/walletBackup/walletBackupNfc';

// Android has no system NFC sheet: the app shows its own "Hold the chip" sheet, with Cancel.
export const cancelChipWrite = () => cancelWalletBackupNfcRequest();
import {withKeepAwake} from '../../utils/keepAwake/keepAwake';

export async function phoneHasNfc() {
  try {
    return await NfcManager.isSupported();
  } catch (e) {
    return false;
  }
}

const IOS = Platform.OS === 'ios';

// The library reports failures as English messages. Map them to the redesign copy. A cancel on
// the system sheet is not an error: nothing shows.
export function chipWriteError(error) {
  const m = String(error?.message ?? error ?? '').toLowerCase();
  if (m.includes('cancel')) return null;
  if (m.includes('not supported on this device')) return {noNfc: true};
  if (m.includes('disabled')) {
    return {title: 'NFC is off', body: 'Turn on NFC in the settings of your phone, then try again.', retry: true};
  }
  if (m.includes('already contains a wallet backup')) {
    return {title: 'This chip already holds a backup', body: 'Use an empty chip. The app does not write over a backup.', retry: true};
  }
  // Other data the library will not write over (for example a spendable key with funds).
  if (m.includes('refusing to overwrite')) {
    return {title: 'This chip already holds data', body: 'Use an empty chip. The app does not write over the data on it.', retry: true};
  }
  if (m.includes('read-only') || m.includes('enough space') || m.includes('ndef')) {
    return {title: 'This chip cannot hold the backup', body: 'Use a writable chip with space for the backup.', retry: true};
  }
  // Paper "Chip not written": the chip moved, or the write stopped for another reason.
  return {
    title: 'Backup not written',
    body: IOS
      ? 'The chip moved too soon. Hold it still near the top of your iPhone, then try again.'
      : 'The chip moved too soon. Hold it still against the back of your phone, then try again.',
    retry: true,
  };
}

// Encrypts the phrase with the password and writes it to one chip. Resolves when written.
// onStage('hold') when the phone waits for the chip, onStage('writing') while it writes.
export async function writeChipBackup({mnemonic, password, onStage}) {
  let preRegistered = false;
  let writerStarted = false;
  try {
    preRegistered = await beginWalletBackupNfcSession();
    const ordinal = await withKeepAwake(() =>
      buildWalletBackupOrdinal({mnemonic, password, kdfIters: WALLET_BACKUP_ENCRYPTION_ITERS_MEDIUM}),
    );
    writerStarted = true;
    onStage?.('hold');
    await writeWalletBackupToNfc(ordinal, {
      sessionPreRegistered: preRegistered,
      onStatus: status => {
        if (!/^(Writing|Formatting)/.test(status)) return;
        onStage?.('writing');
        // Paper Backup NFC 07: the system sheet says "Hold still." while it writes.
        if (IOS) NfcManager.setAlertMessageIOS('Hold still.').catch(() => {});
      },
    });
  } finally {
    if (preRegistered && !writerStarted) await endWalletBackupNfcSession();
  }
}
