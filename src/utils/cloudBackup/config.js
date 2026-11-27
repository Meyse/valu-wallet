// Cloud backup settings: the feature flag and every account-specific value, in one place.
//
// With the flag off, or while an account value below is missing, the app shows the backup and
// import sheets without cloud (Paper "Alternative ... without cloud"), as before this feature.
//
// NEEDS ACCOUNTS (plan B5). Fill these in only after the account work is done, or the build
// still runs but the store reports "unsupported":
//
// iOS (Apple team U5Y4ZSCF38, App ID com.arkeytyp.valumobile.app):
//   1. Developer portal: enable iCloud (CloudKit off) on the App ID, create the container
//      iCloud.com.arkeytyp.valumobile.app, assign it, and make new provisioning profiles.
//   2. ios/verusMobile/verusMobile.entitlements: add
//        com.apple.developer.icloud-container-identifiers = [iCloud.com.arkeytyp.valumobile.app]
//        com.apple.developer.icloud-services = [CloudDocuments]
//        com.apple.developer.ubiquity-container-identifiers = [iCloud.com.arkeytyp.valumobile.app]
//      Do not add these keys before step 1: signing fails for every developer without the
//      container on the team.
//   3. ios/verusMobile/Info.plist: NSUbiquitousContainers > iCloud.com.arkeytyp.valumobile.app >
//      NSUbiquitousContainerIsDocumentScopePublic = false (the file stays hidden in Files).
//   4. Here: ios.containerId = 'iCloud.com.arkeytyp.valumobile.app'.
//
// Android (package com.valumobile):
//   1. Google Cloud project owned by Valu: enable the Google Drive API; consent screen; scope
//      https://www.googleapis.com/auth/drive.appdata; one Android OAuth client per signing key
//      (upload key, Play App Signing key, each developer debug key) with its SHA-1; test users.
//   2. Here: android.driveReady = true. No client id goes into the app: Google matches the
//      Android OAuth client by package name and signing SHA-1.
export const CLOUD_BACKUP_ENABLED = true;

export const CLOUD_ACCOUNTS = Object.freeze({
  ios: Object.freeze({containerId: null}),
  android: Object.freeze({driveReady: false}),
});

// The Drive scope: the hidden app data folder only (non-sensitive scope).
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
