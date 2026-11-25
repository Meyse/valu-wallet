// First-run record for the new Home: how the wallet was made, when, and whether the welcome card
// was dismissed. It holds no key material. One record per account hash.
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = accountHash => `valu.redesign.welcome.${accountHash}`;

// kind: 'created' | 'imported'
export async function recordWalletMade(accountHash, kind) {
  try {
    await AsyncStorage.setItem(keyFor(accountHash), JSON.stringify({kind, at: Date.now(), dismissed: false}));
  } catch (e) {
    // The welcome card is optional; a failed write only hides it.
  }
}

export async function readWelcome(accountHash) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(accountHash));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function dismissWelcome(accountHash) {
  const current = await readWelcome(accountHash);
  if (!current) return;
  try {
    await AsyncStorage.setItem(keyFor(accountHash), JSON.stringify({...current, dismissed: true}));
  } catch (e) {}
}

// "Just now", "5 min ago", "3 h ago", then the date.
export function timeAgo(at, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}
