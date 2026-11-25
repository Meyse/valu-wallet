// The redesign switch and the small UI state the redesigned shell needs.
// The switch is a UI preference only. It never touches profiles, keys or passwords.
import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'valu.redesign.enabled';
// Default on in the redesign branch.
export const REDESIGN_DEFAULT = true;

let state = {
  enabled: REDESIGN_DEFAULT,
  // True from the start of wallet creation until the user leaves R15 "Wallet ready".
  // It keeps the onboarding on screen while the new account signs in behind it.
  // In memory only: after an app restart the normal routing applies.
  holdOnboarding: false,
};
const listeners = new Set();

const emit = () => listeners.forEach(listener => listener());
const setState = patch => {
  state = {...state, ...patch};
  emit();
};
const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadRedesignFlag = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'true' || stored === 'false') setState({enabled: stored === 'true'});
  } catch (e) {
    // Keep the default when storage cannot be read.
  }
};

export const setRedesignEnabled = async enabled => {
  setState({enabled});
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    // The switch still applies for this session.
  }
};

export const setHoldOnboarding = holdOnboarding => setState({holdOnboarding});
export const getRedesignState = () => state;

export const useRedesignEnabled = () => useSyncExternalStore(subscribe, () => state.enabled);
export const useHoldOnboarding = () => useSyncExternalStore(subscribe, () => state.holdOnboarding);
