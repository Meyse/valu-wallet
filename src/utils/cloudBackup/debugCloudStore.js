// Debug builds only: which cloud store the app uses. 'fake' = the local folder of fakeStore.js,
// 'off' = as if the feature flag were off, null = the real store of the platform.
// Release builds never read this value (store.js checks __DEV__ first).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'valu.debug.cloudStore';
export const DEBUG_STORE_MODES = [null, 'fake', 'off'];

export async function readDebugCloudStore() {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value === 'fake' || value === 'off' ? value : null;
  } catch (e) {
    return null;
  }
}

export async function setDebugCloudStore(mode) {
  if (mode === 'fake' || mode === 'off') await AsyncStorage.setItem(KEY, mode);
  else await AsyncStorage.removeItem(KEY);
}

export const debugStoreLabel = mode =>
  mode === 'fake' ? 'Fake store (local folder)' : mode === 'off' ? 'Off (flag off)' : 'Real store';
