# Release signing checkpoint

Baseline: `73e1fa6`. Existing published APKs use `id.sakelar.client.debug` and Android Debug signing. No dedicated release signing configuration exists.

Plan: create one permanent private PKCS12 key outside Git, restrict its filesystem access and create a local recovery copy. Pin only its public certificate fingerprint in the repository. Configure the release variant and default Android build command, and refuse debug/unknown certificates in the publishing script.

Release package: `id.sakelar.client`. It can coexist with the old debug package; Android will not transfer the old app's private data automatically. Do not uninstall the old app or publish a new APK as part of this configuration task.

Verify key reuse, recovery-copy consistency, Gradle release signing validation, rejection of existing debug APKs, automated tests and production web build. A new packaged release APK requires its normal build/release step.
