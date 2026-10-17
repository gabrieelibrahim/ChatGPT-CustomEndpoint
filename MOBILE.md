# SuperGPT mobile — Android & iOS

The native mobile app now renders **`src/mobile/MobileApp.tsx`** and **`src/mobile/mobile.css`**, independently of the desktop shell. Endpoint profiles, native HTTP, streaming, rich text, preferences, file storage and history formats remain shared. Conversation state is in `src/lib/useMobileConversation.ts`. The older `src/App.tsx` prototype is not used. The visual viewport resizes the shell when the keyboard opens; safe-area insets are respected.

## Live preview before compiling

```bash
npm run dev:mobile
```

Open **http://127.0.0.1:1420/?mobile=1** in the browser. The mobile development mode renders the mobile interface even on a desktop browser. Use a phone-sized viewport (for example 390 × 844). Vite updates the preview when source files are saved; no APK build is needed. A normal `npm run dev` continues to show desktop, with `?mobile=1` available as an explicit override.

This is the first separate mobile UI iteration: chat, streaming/stop/retry, file attachments, model selection, history search/pin/delete, temporary chat, endpoint setup and basic mobile settings. Desktop-only collections and the full desktop settings UI are not yet ported into the new mobile navigation. Work currently shares the same chat transport; it does not launch a local terminal. Browser previews do not verify Android keyboard, OS permissions or device back gestures; those still require a device build later. No new APK is produced by this UI revision.

### Composer reference states

The three supplied 614 × 1280 screenshots are compared at a proportional 390 × 813 viewport. The resting home composer is 322 × 49 CSS px with a 34 px bottom gap. With the keyboard viewport reduced to 390 × 476, the composer is 366 px wide and sits 12 px above the viewport bottom. The first focus in each app mount is 96 px tall; subsequent focuses are 49 px tall. Closing a soft keyboard via a viewport resize consumes the first-focus state even when Android retains DOM focus. Ordinary typing still grows the input for multiline text.

The header uses 44 px round buttons and a 176 × 44 px Chat/Work switch. Suggestion rows are 49 px high with 17.5 px text and 20 px icons. Model selection stays available in Settings rather than adding an extra line beneath the reference composer. The Android keyboard itself is supplied by the OS; it is not drawn or simulated by the app. Browser screenshots verify app geometry, while native keyboard timing and inset behavior remain device checks.

No provider credentials, profile or sample conversations are packaged. Onboarding and provider configuration run on the device. Native HTTP uses the existing validated provider transport. Codex switching remains disabled; Node/Codex Windows binaries and local process commands are excluded from mobile builds.

## Android APK on Windows

Prerequisites: Node/npm, Rust, JDK 17, Android command-line tools, SDK platform/build-tools and NDK. The first tested target is ARM64 (`aarch64`), Android 7/API 24 or newer.

Put machine-specific paths in ignored `.env.mobile.local`:

```dotenv
JAVA_HOME="C:/path/to/jdk-17"
ANDROID_HOME="C:/path/to/Android/Sdk"
NDK_HOME="C:/path/to/Android/Sdk/ndk/28.2.13676358"
```

The wrapper also reads `.env.desktop.local` for existing Cargo/Rust paths. Neither file belongs in Git. Install the Rust target with `rustup target add aarch64-linux-android`, then:

```bash
npm ci
npm run android:build
```

`android:build` creates an ARM64 **debug-signed APK for installation and testing**, not a Play Store release. The debug application ID is `id.sakelar.client.debug`. Android signing keys and SDK caches stay outside source control. Output is under `src-tauri/gen/android/app/build/outputs/apk/`.

For a production build, configure your own release signing key, remove the debug flag, and use the Tauri Android build options. Keep the signing key backed up outside the repository: future updates must use the same signing identity. Do not distribute a debug APK as a signed store release.

The Android project is already initialized. Use `npm run android:init` only when deliberately regenerating it, then reapply any project-specific Gradle changes. The checked-in project pins SDK 36, Android Gradle Plugin 8.11.1 and Gradle 8.13.

The generated Android project is checked in without build outputs, local SDK paths or signing secrets. Its launcher icons come from the transparent SuperGPT logo. No desktop runtime resources are bundled.

## iOS

The shared mobile interface and `tauri.ios.conf.json` are prepared. Generating, signing and testing an iOS application requires **macOS with Xcode and Apple's signing setup**. It cannot be compiled into an installable IPA on this Windows machine.

On a Mac with Tauri's iOS prerequisites installed:

```bash
npm ci
npm run ios:init
npm run tauri -- icon public/supergpt-logo.png
npm run ios:dev
npm run ios:build
```

Select your development team and device in the generated Xcode project. The iOS project and IPA remain unverified until built on a Mac. An Android APK cannot run on iOS.

## Verification boundaries

The first Windows-built APK is `SuperGPT_0.1.4_android-arm64-debug.apk` (191,982,767 bytes). Android build tools verified its v2 APK signature, package `id.sakelar.client.debug`, application label **SuperGPT**, minimum SDK 24, target SDK 36, ARM64-only native library, and 16 KB ZIP alignment. It contains no Windows executables. Debug symbols make this initial testing package large; this is not a store release.

SHA-256: `1e16b30d9314a68c78247705efbe1e8c9337cbecc1b38f50767b0765985a0cb1`.

The build completed using Kotlin's non-daemon fallback after Windows cross-drive incremental-cache warnings. This did not prevent APK generation or signature verification. The shared test suite passed 88 tests.

- `npm test` and `npm run build` cover the shared frontend and provider/adapter regressions.
- Browser phone-size checks cover Chat/Work, sidebar navigation and endpoint forms.
- An APK build/signature check confirms packaging; it does not confirm physical-device keyboard, microphone, networking or iOS behavior.
- Desktop-folder projects, terminal execution and desktop filesystem browsing are not implemented on phones; these require the desktop runtime.
- Dictation depends on WebView/platform speech support and reports unavailability when unsupported. Static web CORS requirements still apply; native builds use native HTTP.

References: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and [Tauri CLI](https://v2.tauri.app/reference/cli/).

Windows note: if the JDK cannot create a loopback pipe using an abbreviated `%TEMP%` path, set `JAVA_TOOL_OPTIONS` in `.env.mobile.local` with `-Djava.net.preferIPv4Stack=true` and `-Djdk.net.unixdomain.tmpdir` pointing to an existing, short local directory. This changes only the build JVM; it is not an app network or certificate-validation setting.
