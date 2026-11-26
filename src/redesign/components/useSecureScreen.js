// Android: while a screen that shows recovery words or a private key is in focus, the window is
// secure (FLAG_SECURE). Recents then shows no content, and screenshots and screen recordings of it
// are blocked. Other screens stay normal. iOS covers the app on 'inactive' (VerusMobile.js).
import {useCallback} from 'react';
import {NativeModules, Platform} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

const secureWindow = Platform.OS === 'android' ? NativeModules.VerusSecureWindow : null;
// A count, not a flag: on a move from one secure screen to the next, the new focus can come
// before the old blur.
let holders = 0;

const apply = secure => {
  try {
    secureWindow?.setSecure?.(secure);
  } catch (e) {
    // A stale native build without the module: the screen still works.
  }
};

export default function useSecureScreen() {
  useFocusEffect(
    useCallback(() => {
      holders += 1;
      if (holders === 1) apply(true);
      return () => {
        holders = Math.max(0, holders - 1);
        if (holders === 0) apply(false);
      };
    }, []),
  );
}
