// The cloud store for the backup and import sheets, and the copy that names it (Paper: iCloud on
// iOS, Google Drive on Android). mode: null while it loads, then 'none' | 'off' | 'ready'
// (src/utils/cloudBackup/store.js). 'none' shows the sheets without cloud.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform} from 'react-native';
import {providerName, resolveCloudStore} from '../../utils/cloudBackup/store';

// refresh() resolves the store again (the debug store switch on the hidden testnet sheet).
export function useCloudStore() {
  const [state, setState] = useState({mode: null, store: null});
  const run = useRef(0);
  const refresh = useCallback(() => {
    const mine = ++run.current;
    resolveCloudStore()
      .then(r => mine === run.current && setState(r))
      .catch(() => mine === run.current && setState({mode: 'none', store: null}));
  }, []);
  useEffect(() => {
    refresh();
    return () => {
      run.current += 1;
    };
  }, [refresh]);
  return useMemo(() => ({...state, refresh}), [state, refresh]);
}

const IS_ANDROID = Platform.OS === 'android';

// All cloud copy in one place. iOS: Paper p-5-0 and p-2-0. Android: Paper gives only the tile
// names ("Save to Google Drive", "From Google Drive"); the rest swaps the names the same way.
export const cloudCopy = (kind = IS_ANDROID ? 'gdrive' : 'icloud') => {
  const name = providerName(kind);
  const android = kind === 'gdrive';
  return {
    name,
    saveTile: `Save to ${name}`,
    saveTileBody: 'Locked with your password',
    restoreTile: `From ${name}`,
    restoreTileBody: 'Needs your backup password',
    passwordTitle: 'Create a backup password',
    passwordBody: `It locks your backup in ${name}.`,
    passwordHelper: 'Nobody can reset this password. If you forget it, you cannot restore this backup.',
    saveButton: `Save to ${name}`,
    savingTitle: 'Saving your backup',
    savingBody: 'This takes a few seconds.',
    doneTitle: `Backup saved to ${name}`,
    doneBody: android
      ? 'To restore, you need the same Google account and your backup password.'
      : 'To restore, you need the same iCloud account and your backup password.',
    notSavedTitle: 'Backup not saved',
    notSavedBody: android
      ? 'Your phone could not reach Google Drive. Check your connection, then try again.'
      : 'Your iPhone could not reach iCloud. Check your connection, then try again.',
    offTitle: android ? 'No Google account' : 'iCloud Drive is off',
    offBody: android
      ? 'Add a Google account in Settings. Then come back to save the backup.'
      : 'Turn on iCloud Drive in Settings. Then come back to save the backup.',
    offRestoreBody: android
      ? 'Add a Google account in Settings. Then come back to restore your wallet.'
      : 'Turn on iCloud Drive in Settings. Then come back to restore your wallet.',
    unlockTitle: `Unlock your ${name} backup`,
    unlockBody: date =>
      date ? `Enter the backup password. The backup is from ${date}.` : 'Enter the backup password.',
    wrongPassword: 'This password is not correct. Try again.',
    noBackupTitle: android ? 'No backup in this Google Drive' : 'No backup in this iCloud',
    noBackupBody: android
      ? 'Sign in with the Google account that holds the backup. Or import in a different way.'
      : 'Sign in with the Apple Account that holds the backup. Or import in a different way.',
    lookingTitle: 'Looking for your backup',
    lookingBody: 'This takes a few seconds.',
    unreachableTitle: 'Backup not found',
    unreachableBody: android
      ? 'Your phone could not reach Google Drive. Check your connection, then try again.'
      : 'Your iPhone could not reach iCloud. Check your connection, then try again.',
    damagedTitle: 'This backup is damaged',
    damagedBody: 'Valu Wallet cannot open it. Import your wallet in a different way.',
    updateTitle: 'Update Valu Wallet',
    updateBody: 'A newer version of Valu Wallet made this backup. Update the app, then try again.',
  };
};
