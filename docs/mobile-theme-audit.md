# Mobile theme behavior

Date: 2026-10-18. Scope: appearance selection, shared preference lifecycle, mobile palettes, Android system-bar integration.

## APK evidence (REA)

Artifact: `com.openai.chatgpt` `1.2026.279`, SHA-256 `a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`.

- `defpackage.ttd0.<clinit>()V`: ordered choices System (`system`), Light (`light`), Dark (`dark`). Evidence `ev_9f99d560d80230c35efd1a6e5f4bd09c18e7a5091d1d9843d31c01f097857b84`.
- Incoming references link that enum to application settings/platform paths. Evidence `ev_7297d2b2005a903b57ed8502168006425246a858825cba1492e2f5e8a9a4a49a`.
- `defpackage.gtd0.a(Context, ttd0)`: below Android 12, applies night-mode values -1/1/2; on Android 12+ invokes `UiModeManager.setApplicationNightMode` with values 0/1/2, falling back to the earlier path on error. Evidence `ev_2e6c2669b0061a5bb1f5587cbc5cf62636cc390dbd2ecbf50fc37537d0356305`.
- `defpackage.n9m.<clinit>()V` also contains LightHighContrast/DarkHighContrast internally. Evidence `ev_8e13a07af6fe478d7e9d8a1be77812a9f79f07f335c890d2a15be4493aa53254`. This does not establish additional user-visible options, so none were invented.

These are static code observations, not an execution capture. Native dialog geometry, exact light-mode color values, accessibility variations, APK authenticity and full visual parity are not established by them.

## Implementation

- Settings shows three mutually exclusive choices in APK enum order, and its root row displays the saved preference.
- Selection immediately updates app/SDK theme attributes and native form-control `color-scheme`. System resolves from `prefers-color-scheme` and listens for changes; explicit modes ignore those changes.
- Preference uses the existing validated settings store and cross-window notification path. The existing default and user preferences are preserved.
- A same-origin parser-blocking bootstrap applies the saved scheme before app rendering. Invalid/denied storage falls back deterministically without breaking startup.
- Mobile semantic tokens cover home, segments, composer, sidebar/footer, search/categories, skeleton, settings/editors, library, dialogs, file chips, notices, errors and provider forms. Accent buttons retain white foregrounds; regular text and muted labels use theme-specific colors. SDK controls retain their own semantic token system.
- Light uses white app canvas, pale gray controls/cards, dark text and darker file-type icons. Dark retains the existing black canvas and gray surfaces. Palette values are implementation choices guided by existing references, not recovered native constants.
- Android MainActivity restores its app appearance before creation, follows system via AppCompat, adjusts status/navigation icon contrast and disables WebView automatic darkening. Theme messages accept only three mode strings from the main frame of known app origins; release builds exclude preview origins. There is no data/network/file/command capability on this endpoint.
- Android `uiMode` configuration changes are handled without intentionally reloading the WebView. Logo launcher resources are unaffected.
- iOS receives the web palette; this change does not add native iOS system-bar integration.

## Validation

- 103 automated tests pass. New cases cover startup before React, denied/malformed storage, system light/dark changes, manual overrides, persisted preference, cross-window updates, native presentation messages and listener cleanup.
- TypeScript, production web build and SDK CSS layer-order check pass. The production output includes `theme-init.js`.
- Browser preview at 390 × 813: changed Light → Dark, reloaded and verified Dark persisted; selected System and verified its resolved scheme; restored the original Light choice. Checked home/composer, sidebar/footer, search and Settings colors. The browser driver does not expose OS color emulation; OS transitions were tested with controlled media events in the unit suite.
- Initial Android Gradle attempts stopped before Kotlin compilation with `java.io.IOException: Unable to establish loopback connection`. Follow-up: setting an explicit short JVM socket directory resolved this environment problem. `compileArm64DebugKotlin` and the complete v0.1.5 Android APK build now pass. No device is connected, so native system bars and device behavior remain unverified at runtime.

The Android build now succeeds. Full native 1:1 parity still requires matching Light/Dark screenshots from the reference APK and SuperGPT on the same device/settings.
