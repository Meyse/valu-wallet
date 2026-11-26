// Backup record of the one wallet (round 5: the backup comes later, inside the wallet).
// It holds no key material: only whether a backup is still needed and whether the one-time
// "You received funds" sheet was shown. One record per account hash.
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = accountHash => `valu.redesign.backup.${accountHash}`;

// Written BEFORE a new wallet is created. It throws on a failed write, so creation stops: a wallet
// must never exist without the record that reminds the user to back it up.
export async function recordNeedsBackup(accountHash) {
  await AsyncStorage.setItem(keyFor(accountHash), JSON.stringify({needsBackup: true, fundsSheetShown: false}));
}

// An imported wallet already has a backup (the words, key, QR code or chip it came from).
export async function clearBackupRecord(accountHash) {
  try {
    await AsyncStorage.removeItem(keyFor(accountHash));
  } catch (e) {}
}

export async function readBackup(accountHash) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(accountHash));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// A read error throws and writes nothing: a partial record would drop needsBackup and end the
// reminder for good.
async function update(accountHash, change) {
  const raw = await AsyncStorage.getItem(keyFor(accountHash));
  const current = raw ? JSON.parse(raw) : {};
  await AsyncStorage.setItem(keyFor(accountHash), JSON.stringify({...current, ...change}));
}

export const markFundsSheetShown = accountHash => update(accountHash, {fundsSheetShown: true}).catch(() => {});

// Throws on a failed write: the caller keeps the reminder and says the backup was not saved.
export const markBackedUp = (accountHash, method) =>
  update(accountHash, {needsBackup: false, backedUpAt: Date.now(), method});

// What Home shows. No funds: nothing (no backup pressure on an empty wallet). First funds: the
// sheet, one time. After that, the card until the backup is done. The card does not block.
export function backupPrompt(record, hasFunds) {
  if (!record?.needsBackup || !hasFunds) return 'none';
  return record.fundsSheetShown ? 'card' : 'sheet';
}
