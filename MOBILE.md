# SuperGPT mobile — Android & iOS

The mobile layout reuses the main `Desktop` React engine and provider/storage modules. It does not use the older `?mobile=1` prototype. At phone widths (768 px or less), or in a native mobile WebView, the shared shell uses an unscaled phone layout: Chat/Work tabs, a sidebar drawer, a bottom composer, temporary chat, settings and custom endpoints. The visual viewport resizes the shell when the keyboard opens; safe-area insets are respected.

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
