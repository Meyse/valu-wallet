// Picks the cloud store and says what the backup and import sheets show:
//   'none'  the sheets without cloud (flag off, debug "off", or the store is not set up)
//   'off'   the cloud tile; a tap shows "iCloud Drive is off" (signed out or Drive off)
//   'ready' the cloud tile works
import {CLOUD_BACKUP_ENABLED} from './config';
import {readDebugCloudStore} from './debugCloudStore';

export async function resolveCloudStore({
  enabled = CLOUD_BACKUP_ENABLED,
  dev = typeof __DEV__ !== 'undefined' && __DEV__,
  readDebug = readDebugCloudStore,
  fakeStore = () => require('./stores/fakeStore').deviceFakeStore(),
  realStore = () => require('./stores/libraryStore').platformStore(),
} = {}) {
  if (!enabled) return {mode: 'none', store: null};
  const debug = dev ? await readDebug() : null;
  if (debug === 'off') return {mode: 'none', store: null};
  const store = debug === 'fake' ? fakeStore() : realStore();
  let availability;
  try {
    availability = await store.isAvailable();
  } catch (e) {
    availability = {ok: false, reason: 'unsupported'};
  }
  if (availability?.ok) return {mode: 'ready', store};
  if (availability?.reason === 'off') return {mode: 'off', store};
  return {mode: 'none', store: null};
}

// The provider name in the copy (Paper: iCloud on iOS, Google Drive on Android).
export const providerName = kind => (kind === 'gdrive' ? 'Google Drive' : 'iCloud');
