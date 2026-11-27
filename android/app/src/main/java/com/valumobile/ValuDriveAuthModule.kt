package com.valumobile

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.Scope

// Access token for the Google Drive app data folder (cloud backup). It uses the Identity
// Services AuthorizationClient: the account picker and the consent screen show only when they are
// needed, and the wallet needs no Google sign-in. No client id is in the app: Google matches the
// Android OAuth client of the Cloud project by package name and signing SHA-1
// (src/utils/cloudBackup/config.js lists what the project needs).
//
// The token is returned to JS and is never logged or stored here. Reject codes:
// CANCELLED (the user closed the picker or the consent screen), UNAVAILABLE (anything else).
class ValuDriveAuthModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pending: Promise? = null

  private val listener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = pending ?: return
        pending = null
        if (resultCode != Activity.RESULT_OK || data == null) {
          promise.reject(CANCELLED, "The user closed the Google consent screen")
          return
        }
        try {
          finish(Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data), promise)
        } catch (e: Exception) {
          promise.reject(UNAVAILABLE, "Google did not give access")
        }
      }
    }

  init {
    reactContext.addActivityEventListener(listener)
  }

  override fun getName() = "ValuDriveAuth"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactApplicationContext)
    promise.resolve(status == ConnectionResult.SUCCESS)
  }

  @ReactMethod
  fun getToken(scope: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(UNAVAILABLE, "No activity")
      return
    }
    if (pending != null) {
      promise.reject(UNAVAILABLE, "A request is already open")
      return
    }
    val request = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(scope))).build()
    Identity.getAuthorizationClient(activity)
      .authorize(request)
      .addOnSuccessListener { result ->
        val intent = result.pendingIntent
        if (result.hasResolution() && intent != null) {
          pending = promise
          try {
            activity.startIntentSenderForResult(intent.intentSender, REQUEST_CODE, null, 0, 0, 0, null)
          } catch (e: Exception) {
            pending = null
            promise.reject(UNAVAILABLE, "Could not open the Google consent screen")
          }
        } else {
          finish(result, promise)
        }
      }
      .addOnFailureListener { promise.reject(UNAVAILABLE, "Google did not give access") }
  }

  private fun finish(result: AuthorizationResult, promise: Promise) {
    val token = result.accessToken
    if (token.isNullOrEmpty()) promise.reject(UNAVAILABLE, "Google gave no token") else promise.resolve(token)
  }

  companion object {
    private const val REQUEST_CODE = 0x5641 // "VA"
    private const val CANCELLED = "CANCELLED"
    private const val UNAVAILABLE = "UNAVAILABLE"
  }
}
