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

const apply = secure => {
  try {
    secureWindow?.setSecure?.(secure);
  } catch (e) {
    // A stale native build without the module: the screen still works.
  }
};

export default function useSecureScreen() {
  useEffect(() => {
    holders += 1;
    if (holders === 1) apply(true);
    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) apply(false);
    };
  }, []);
}
