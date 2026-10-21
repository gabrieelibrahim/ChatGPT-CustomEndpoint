# Startup crash checkpoint

Baseline: release `v0.1.10`, commit `16cadbb`. The exact released APK (SHA-256 `b092824e865f9da4da3735470aefbbd4e16cbb01ee863a40b2ea3f2bcece9ef1`) was installed and launched on the Android 32 emulator, using ARM64 translation. It crashed before the chat screen.

Observed stack: `ExceptionInInitializerError` in `app.tauri.plugin.PluginManager`, caused by `NoSuchMethodException: C0.H.values []`. The release mapping resolves `C0.H` to `com.fasterxml.jackson.databind.SerializationFeature`, invoked reflectively during Jackson ObjectMapper initialization. The release Gradle configuration omitted the default Android optimization rules.

Plan: restore `proguard-android-optimize.txt`, preserve reflection/JNI behavior through the standard rules, add a release APK startup smoke test, and verify the packaged hotfix with the same release key. Keep R8 enabled. Publish a new patch version after the real APK survives startup and displays the chat UI.
