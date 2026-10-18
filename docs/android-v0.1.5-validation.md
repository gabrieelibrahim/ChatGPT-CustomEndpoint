# Android 0.1.5 build verification

Date: 2026-10-18.

## Build

- Command: `npm run android:build`.
- Output: `app-universal-debug.apk`, containing only `arm64-v8a` native code for the requested aarch64 target.
- Package: `id.sakelar.client.debug`, label SuperGPT, version name `0.1.5`, version code `1005`.
- Android SDK target: 36. This is a debug/test APK, not a production store release.
- Kotlin compilation succeeds, including the appearance bridge and status/navigation icon contrast handling added in the previous change.
- Production frontend build and SDK stylesheet layer-order verification pass. All 103 automated tests pass.
- APK signature verification succeeds using APK Signature Scheme v2.
- Packaged square/round launcher and opaque white background assets are present at all five densities. The extracted xxxhdpi launcher matches the source asset byte-for-byte.

## Build environment repair

The JDK/Gradle environment failed with `Unable to establish loopback connection`. Using an explicit short directory for Java Unix-domain sockets together with IPv4 preference allowed Gradle to proceed. `scripts/mobile.mjs` now configures these options for its Windows child process and uses an ignored `.java-tmp/` directory within the checkout. Existing explicit JVM options are preserved. No global Java, network, firewall or Codex configuration is changed.

## Real API verification

- A real 9Router endpoint over Tailscale returned HTTP 200 and 221 model IDs with existing local authentication.
- Model `sr/deepseek-v4-flash`: a streaming chat request returned HTTP 200, multiple SSE events, `[DONE]` and `API_OK`.
- A second live request ran through the actual `src/lib/endpointChat.ts` and `providerTransport.ts` code, returning `TRANSPORT_OK` through four text updates.
- An initial request to the `CLAUDE` route returned HTTP 403. Listing a model is not a guarantee that its provider route is authorized/available; the successful model above is the tested route.
- The authentication key was read in memory from the existing local 9Router store. It was not printed, copied into source, committed or included in the APK. Private host configuration is omitted from this report.

## Runtime boundary

No Android device is connected to ADB. The APK is built and statically verified; installation, actual device UI, native HTTP calls and system-bar rendering on a phone remain to be tested. Browser preferences and session keys are not embedded in the APK. The phone needs its own endpoint configuration and an active Tailscale connection to reach a tailnet address; `127.0.0.1` on the phone refers to the phone itself.
