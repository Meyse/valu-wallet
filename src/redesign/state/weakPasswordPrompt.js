// Weak password prompt (Paper p-6-0, "Make your password stronger"). It is OFF for users until the
// redesign has a change-password flow: its "Change password" button has nowhere to go yet. Debug
// builds can turn it on (Settings) to see it. "Not now" hides it for 7 days.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const WEAK_PASSWORD_PROMPT_ENABLED = false;

const DEBUG_KEY = 'valu.debug.weakPasswordPrompt';
const dismissKey = accountHash => `valu.redesign.weakPasswordPrompt.${accountHash}`;
export const WEAK_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export async function readDebugWeakPrompt() {
  try {
    return (await AsyncStorage.getItem(DEBUG_KEY)) === 'on';
  } catch (e) {
    return false;
  }
}

export async function setDebugWeakPrompt(on) {
  if (on) await AsyncStorage.setItem(DEBUG_KEY, 'on');
  else await AsyncStorage.removeItem(DEBUG_KEY);
}

export async function readWeakPromptDismissedAt(accountHash) {
  try {
    const raw = await AsyncStorage.getItem(dismissKey(accountHash));
    const at = raw == null ? null : Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch (e) {
    return null;
  }
}

export const dismissWeakPrompt = (accountHash, now = Date.now()) =>
  AsyncStorage.setItem(dismissKey(accountHash), String(now)).catch(() => {});

// enabled: the constant, or the debug switch in a debug build. fails: passwordFailsRule of the
// active account (undefined until an unlock or a password change sets it).
export const shouldShowWeakPrompt = ({enabled, fails, dismissedAt, now = Date.now()}) =>
  enabled === true &&
  fails === true &&
  (dismissedAt == null || now - dismissedAt >= WEAK_PROMPT_SNOOZE_MS);
