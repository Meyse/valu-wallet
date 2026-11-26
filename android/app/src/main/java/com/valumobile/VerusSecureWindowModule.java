package com.valumobile;

import android.app.Activity;
import android.view.WindowManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

// FLAG_SECURE for the screens that show recovery words or a private key: the window then shows
// no content in Recents, and screenshots and screen recordings of it are blocked.
public class VerusSecureWindowModule extends ReactContextBaseJavaModule {
  VerusSecureWindowModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "VerusSecureWindow";
  }

  @ReactMethod
  public void setSecure(boolean secure) {
    final Activity activity = getCurrentActivity();
    if (activity == null) return;

    UiThreadUtil.runOnUiThread(
        () -> {
          if (secure) {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
          } else {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
          }
        });
  }
}
