# Permanent Android release signing

Checkpoint before changes: `3dd305e` (source baseline `73e1fa6`).

The production package is `id.sakelar.client`, signed with a dedicated **SuperGPT Release** RSA-4096 key in a password-protected PKCS12 keystore. Public identity is pinned in `config/android-release-signing.json`; the certificate expires in March 2054. The private key/password are never committed.

## Local files and recovery

- Primary directory on this machine: `C:\Users\LAPTOP WA\.supergpt\signing`.
- Local recovery copy: `C:\Users\LAPTOP WA\Documents\SuperGPT-Signing-Backup`.
- Each directory contains `supergpt-release.p12` and `release.properties`. The latter contains private credentials; treat both files as secrets. Windows ACLs grant access only to the current account and SYSTEM. They are not intended for GitHub, chat attachments or public downloads.
- The local recovery copy was byte-verified against both originals. It is on the same computer and does not replace a secure offline backup. Keep both files together in an encrypted backup. Losing the key/password prevents ordinary updates of this app identity.
- On another machine, restore these same files into the private signing directory, update only `storeFile` in the private properties if the absolute location changed, and restrict filesystem permissions again. Use the same alias/password/key and public fingerprint. `SUPERGPT_ANDROID_SIGNING_PROPERTIES` can point to an alternative absolute properties path.
- `npm run android:signing:init` creates the key only during the first setup. With an existing identity it verifies/reuses the key and checks the recovery copy; it refuses to silently replace a missing or mismatched identity. Never delete the public pin to work around a missing key.

## Build and release

`npm run android:build` now builds a **release** APK. `npm run android:build:debug` is explicitly for development and is not publishable. Gradle validates the permanent certificate and signs/verifies a local challenge with its private key before release assembly/signing. Missing or mismatched signing information fails closed; it does not fall back to the debug keystore.

Publication continues through `npm run release:android -- --tag vX.Y.Z --apk <built-apk> --notes <notes-file> --startup-report <report.json>`. It checks production package identity, version/tag agreement, ARM64 support, absence of the Android debuggable flag, valid APK signatures and the pinned release certificate before publishing. The public asset remains exactly `SuperGPT.apk`; GitHub release flags remain `--prerelease=false --latest`.

Before publication, run `npm run test:android-release -- --serial <adb-device-serial> --apk <final-apk> --output <local-report-directory>`. This installs with `-r` and preserves app data, then requires a surviving process, a foreground activity, rendered chat/settings controls and no startup crash. If this is the test device's first install, complete the local name/welcome screen first and rerun; the test intentionally rejects a splash or empty WebView. Pass the generated `report.json` to publication. A report for another APK hash or a failed run is rejected. Never use a debug/source-only run in place of this packaged release check.

The keystore is for the sideloaded/GitHub APK. No Google Play account or Play App Signing configuration was changed.

## Transition from the old APK

Existing published APKs use `id.sakelar.client.debug` and `Android Debug` signing. The new production package can be installed alongside them as a separate application. It does not automatically inherit old private chats, endpoint credentials, permissions or Android Keystore entries. Keep the old app installed while exporting any needed conversations and setting up the release app. This configuration task does not uninstall or modify the existing app.

The first production APK must be installed manually. The updater intentionally rejects a package or certificate mismatch and cannot update the old debug app into this different production identity. Subsequent production APKs must preserve `id.sakelar.client`, this signing key, the exact release asset name and an increasing Android version code. Bump the app version before publishing the first production APK; do not republish v0.1.9 as though it already used this key.

## Validation

- Initialization run twice: same public fingerprint; no key replacement.
- Primary/recovery keystore and credentials compared by SHA-256: identical. Directory inheritance disabled with only owner/SYSTEM access.
- Gradle `:app:validateSigningArm64Release` and `:app:signingReport`: release config points to the dedicated PKCS12 key, not Android Debug.
- Gradle release verification additionally proves that the private key/password can sign and that its signature verifies with the pinned certificate.
- Existing real v0.1.9 debug APK passed to the publication script in dry-run mode: rejected before publication.
- Automated tests: **208 passed, 0 failed**. Tests cover production/debug package distinctions, debuggable APK rejection, unknown/debug/additional signer rejection and missing/partial credential handling.
- Production web build and emitted SDK CSS guard passed.
- No new packaged APK was built or uploaded during this signing-configuration task. Release packaging, R8/runtime verification and physical-device installation remain checks for the next APK build.

[Official Android signing documentation](https://developer.android.com/studio/publish/app-signing) explains the distinction between debug and release certificates, protecting app signing keys and preserving signing identity for updates.
