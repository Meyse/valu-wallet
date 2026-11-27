// Android: while a screen that shows recovery words or a private key is mounted, the window is
// secure (FLAG_SECURE). Recents then shows no content, and screenshots and screen recordings are
// blocked. Mounted, not focused: the secret stays visible during the fade to the next screen, and a
// Back swipe from the next screen shows it again without a focus change. The flag clears when the
// last such screen is removed (Back, the end of the flow, or the reset after the wallet is made).
// iOS covers the app on 'inactive' (VerusMobile.js).
import {useEffect} from 'react';
import {NativeModules, Platform} from 'react-native';

const secureWindow = Platform.OS === 'android' ? NativeModules.VerusSecureWindow : null;
// A count, not a flag: Write down and Verify are mounted at the same time.
let holders = 0;
let waiters = [];

const apply = secure => {
  try {
    secureWindow?.setSecure?.(secure);
  } catch (e) {
    // A stale native build without the module: the screen still works.
  }
};

// active: false lets a screen hold the flag only while it shows a secret (the cloud backup password
// screens: while a field has text).
export default function useSecureScreen(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    holders += 1;
    if (holders === 1) apply(true);
    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) {
        apply(false);
        const ready = waiters;
        waiters = [];
        ready.forEach(run => run());
      }
    };
  }, [active]);
}

// An Android Modal copies FLAG_SECURE from the activity when its dialog is made, and keeps it. A sheet
// that opens while a secure screen is still mounted (Back from Import phrase to the import sheet, the
// Ready sheet after an import) would then block screenshots until it closes. Open such a sheet here:
// at once when no secure screen is mounted, else after the last one is removed. Returns a cancel.
export function afterSecureScreens(run) {
  if (!secureWindow || holders === 0) {
    run();
    return () => {};
  }
  waiters.push(run);
  return () => {
    waiters = waiters.filter(w => w !== run);
  };
}
