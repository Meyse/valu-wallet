// The NFC chip lane of import (Paper p-2-0: Import NFC 03 - Scan, 03b - Chip password). The read and
// the decryption are the existing wallet backup calls (ImportNfc.js), unchanged: the chip record
// stays Verus Mobile compatible. Nothing here logs or keeps the phrase outside onboarding state.
import {useRef, useState} from 'react';
import {Keyboard} from 'react-native';
import {NfcError} from 'react-native-nfc-manager';
import {
  isValid24WordBip39Mnemonic,
  walletBackupOrdinalToMnemonic,
  walletBackupRequiresPassword,
} from '../../../utils/walletBackup/walletBackup';
import {
  beginWalletBackupNfcSession,
  cancelWalletBackupNfcRequest,
  endWalletBackupNfcSession,
  readWalletBackupFromNfc,
} from '../../../utils/walletBackup/walletBackupNfc';
import {activateKeepAwake, deactivateKeepAwake} from '../../../utils/keepAwake/keepAwake';

// A cancel is not an error: the library's UserCancel (iOS system sheet, empty message) or a
// cancelled request.
export const isNfcCancel = error =>
  (NfcError?.UserCancel != null && error instanceof NfcError.UserCancel) ||
  String(error?.message ?? error ?? '').toLowerCase().includes('cancel');

// The wallet backup calls report failures as English messages. Map them to the redesign copy.
// A cancel is not an error: nothing shows.
export const nfcReadError = error => {
  if (isNfcCancel(error)) return null;
  const m = String(error?.message ?? error ?? '').toLowerCase();
  if (m.includes('not supported'))
    return {
      title: 'This phone cannot use NFC',
      body: 'Import with your recovery phrase, a private key or a QR code.',
      unsupported: true,
    };
  if (m.includes('disabled'))
    return {title: 'NFC is off', body: 'Turn on NFC in the settings of your phone, then try again.'};
  if (m.includes('timed out'))
    return {title: 'No chip found', body: 'Hold the chip near the top of your phone, then try again.'};
  if (m.includes('does not contain'))
    return {title: 'No backup on this chip', body: 'Use the chip that holds your wallet backup.'};
  return {title: 'Chip not read', body: 'Hold the chip still near the top of your phone, then try again.'};
};

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

// Decrypts the chip record. A wrong password throws. Keeps the phone awake: the key derivation
// of a high-security backup can take a few minutes.
export async function openChipBackup(ordinal, password) {
  activateKeepAwake();
  try {
    await nextFrame();
    return walletBackupOrdinalToMnemonic({walletBackupOrdinal: ordinal, password});
  } finally {
    deactivateKeepAwake();
  }
}

// As the old NFC import: a 24-word phrase from a chip also gives the shielded (Z) seed.
export const chipSeedHasZ = phrase => isValid24WordBip39Mnemonic(phrase);

// Reads one chip. onPhrase(phrase) for an open backup, onLocked(ordinal) when it needs its
// password, onError({title, body}) for a failure. Two taps never start two reads. cancel() stops
// the read: a chip shown after it, or a result that comes in late, is ignored.
export function useNfcRead({onPhrase, onLocked, onError}) {
  const busy = useRef(false);
  const run = useRef(0);
  const [reading, setReading] = useState(false);
  const read = async () => {
    if (busy.current) return;
    busy.current = true;
    const mine = ++run.current;
    const live = () => run.current === mine;
    setReading(true);
    let preRegistered = false;
    let readerStarted = false;
    try {
      Keyboard.dismiss();
      preRegistered = await beginWalletBackupNfcSession();
      if (!live()) return;
      readerStarted = true;
      const ordinal = await readWalletBackupFromNfc({sessionPreRegistered: preRegistered});
      if (ordinal == null || !live()) return;
      if (walletBackupRequiresPassword(ordinal)) onLocked(ordinal);
      else {
        const phrase = await openChipBackup(ordinal, null);
        if (live()) onPhrase(phrase);
      }
    } catch (e) {
      const shown = live() ? nfcReadError(e) : null;
      if (shown) onError(shown);
    } finally {
      try {
        if (preRegistered && !readerStarted) await endWalletBackupNfcSession();
      } finally {
        busy.current = false;
        if (live()) setReading(false);
      }
    }
  };
  const cancel = () => {
    run.current += 1;
    setReading(false);
    cancelWalletBackupNfcRequest();
  };
  return {read, reading, cancel};
}
