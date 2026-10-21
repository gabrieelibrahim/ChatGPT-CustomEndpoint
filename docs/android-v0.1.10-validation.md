# Android v0.1.10 release validation

- Package `id.sakelar.client`, version name `0.1.10`, version code `1010`.
- Android 7.0+ (minSdk 24), target/compile SDK 36, ARM64 only.
- Dedicated pinned SuperGPT Release certificate SHA-256: `7544dc65194da6bb8b0bb8c86005759e91707f7dc0a6f8ddb53eb907bf7a7737`.
- `apksigner verify --verbose --print-certs` passed; certificate matched the public pin. APK metadata has no `application-debuggable` flag, and the package has no `.debug` suffix.
- `zipalign -c -P 16 -v 4` passed. Native ELF LOAD segments use alignment `0x4000` (16 KB).
- Archive contains 942 entries, one ARM64 native library, and no `.env`, keystore, PKCS12 or signing-properties files.
- Final asset `SuperGPT.apk`: 22,674,836 bytes; SHA-256 `b092824e865f9da4da3735470aefbbd4e16cbb01ee863a40b2ea3f2bcece9ef1`.

`npm test` passed all 208 tests. TypeScript/Vite production build and the emitted SDK stylesheet-order guard passed as part of Android preparation.

The Tauri CLI completed the optimized ARM64 Rust build. Its Gradle runner stalled while resolving network artifacts, so Android packaging was completed using the cached dependencies with `:app:assembleArm64Release -x :app:rustBuildArm64Release --offline --no-configuration-cache`. The completed native library was byte-compared with Gradle's merged native library: identical. Release Kotlin/Java compilation, R8 minification, vital lint, signing validation and APK assembly all passed.

No physical-phone runtime test was performed. Initial production-package installation and future production-to-production automatic updates require device verification. The old debug package cannot be replaced by this differently signed production package; keep it while exporting needed data and configuring the new app.
