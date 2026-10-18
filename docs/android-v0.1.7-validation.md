# Android 0.1.7 revision

## Changes and boundaries

- Android endpoint credentials now use a restricted main-frame WebMessage bridge, AES-GCM and a nonexportable Android Keystore key. Ciphertext is kept in app-private preferences excluded from cloud/device-transfer backup. App startup hydrates the memory cache before rendering. Save success waits for native acknowledgement. Signout clears the cache, invalidates older writes and retains a nonsecret deletion tombstone if native clearing fails. Browser previews intentionally remain session-only. Already-lost keys cannot be recovered; enter and save once in the updated APK.
- User-started requests register a bounded dataSync foreground service, ongoing notification and partial wake lock. WebView is resumed during Home/pause while such a task is active. Successful, failed and aborted request paths release the registration in finally. The service does not auto-start, restart or run indefinitely; its hard ceiling is 330 seconds and the configured provider timeout still applies. Navigating app pages no longer calls chat.stop; Stop/new chat still cancel deliberately. This is not a durable job runner that survives force-stop, process death, reboot or every OEM battery restriction.
- Photo/video selection accepts both media kinds. Photos get thumbnails; video gets a preview/play affordance; documents show name/type/size. Photos/video can open a full-screen preview; draft cards have remove controls and object URLs are revoked on unmount. Input still uses the delegated Android camera/file picker. Android package-visibility queries cover camera/video intents. No claim of original in-app camera UI parity is made.
- Existing provider bridge sends supported image types and text-file contents. Video/PDF/Office binary uploads are still rejected before provider transmission; displaying a card is not support for those protocols. Current storage/vision/text limits remain explicit in fileLibrary.ts.
- The native launch theme shows the custom SuperGPT logo against the matching light/dark background, followed by a web loading logo pulse while initialization is pending. Reduced-motion disables the web pulse. Native reference timing/animation remains unresolved by static REA; no exact timing parity is claimed.
- Mobile markdown restores installed Apps SDK semantic spacing and type styles under app resets, including headings, emphasis, ordered/unordered lists, quotes, tables and syntax-highlighted code/copy controls. Preview metrics: paragraph16px/25.6px, h2 24px/29.328px, code13px/20.15px. This preserves SDK typography; exact Android native font metrics have not been measured on a physical device.

## Size and build

The previous 0.1.6 APK was 192,248,022 bytes; its native library alone was 185,076,096 bytes (96.3%). ELF debug sections accounted for 142,397,421 bytes, plus symbol/string tables. Debug ARM64 builds now default to process-local CARGO_PROFILE_DEV_DEBUG=0 and CARGO_PROFILE_DEV_STRIP=symbols, preserving the debug package ID and signing path. These do not alter system Cargo settings and can be explicitly overridden for developer diagnostics.

## Validation

- TypeScript no-emit, production Vite build and production SDK stylesheet order guard passed.
- Focused provider/file/markdown/background/vault/profile tests passed; native request registration is released after success and cancellation, and vault tests cover reload hydration, queued writes, failure reporting and signout races.
- Browser at 390x813 confirmed image/document draft cards, full-screen photo preview and rendered headings/lists/quote/table/code. Samples use repository logo/README and isolated markdown fixture, with no provider credentials or real camera/microphone capture.
- Kotlin/Android packaging and APK signature/manifest checks are performed on the final APK. No physical Android device was attached; Home/screen-off behavior, native camera appearance and real Keystore restart remain physical-device checks.
- Camera/media REA investigation and timeout limits are recorded in mobile-camera-media-audit.md.

## Final package verification

- Final compacted/signed APK: `SuperGPT_0.1.7_android-arm64-debug.apk`, 29,067,713 bytes (29.07 MB / 27.72 MiB), approximately 84.9% smaller than the prior192,248,022-byte APK.
- SHA256: `ba7dcc1e2dee9e9ee7f21d4b62e3733cf2146bd64341538b5c2e1ee50a6f2f00`.
- SDK apksigner verifies v2 signature; signer certificate SHA256 `869b4ad90279f3f311991e738549dafc349bb954941e4357b2a198e2339e8abf` matches0.1.6. SDK zipalign check with16KB native-library page alignment passed.
- Package `id.sakelar.client.debug`, versionCode1007, versionName0.1.7, minSDK24, targetSDK36, ARM64 only. Manifest includes the dataSync foreground service and expected permissions; EndpointVault/TaskForegroundService classes and current production frontend asset names are present.
- Incremental packaging left unused ZIP gaps. Compaction preserved byte-identical contents for every packaged member, then the result was aligned and signed with the same Android debug certificate. No API keys, private configuration or signing keys were bundled.
- Final Kotlin/Android build passed;24 focused tests passed. Physical-device install/Home/restart/camera parity remains untested. No GitHub upload was performed in this task.
