# Removal of app upload limits

Checkpoint: `3590f87`, source baseline `5969e63` (v0.1.11). The user explicitly requested no compilation. Changes are source-only; no APK was built, version bumped or release published.

## Files changed and behavior

- `src/lib/fileLibrary.ts`: remove the 10 MB local file cap, 28 MB aggregate image-data cap, and 512 KB text-attachment cap. Full attachment content and all selected references are retained.
- `scripts/localProviderRelay.mjs`, `scripts/codexAgentBridge.mjs`, `src-tauri/src/agent.rs`: remove the 32 MB request-envelope cap from the local media forwarding paths. Codex image validation no longer imposes a separate 14 MB data-URL ceiling. Origin/session and image-format validation remain active.
- `server/sdk/service.mjs`, `server/sdk/mainChat.mjs`, `server/sdk/store.mjs`: remove the SDK's 4-attachment input limit, 10 MB upload cap, 200-file library count cap, 128 KB text-file cap, and persisted-history byte ceiling. The main inline-media route no longer uses the generic control-request body ceiling. Large hydrated document text is accepted in main chat. Uploads must still match their declared size and belong to the authenticated owner; oversized/short bodies relative to that declaration are rejected.
- `src-tauri/gen/android/app/src/main/java/id/sakelar/client/FileOpenBridge.kt`: remove the fixed byte/base64 ceilings when opening an explicitly selected local file in another Android application. Filename sanitization, allowed origins/main-frame restrictions and FileProvider permissions remain intact.
- `src/lib/providerTransport.ts` and SDK error handling: HTTP 413 from an upstream provider/proxy remains an explicit provider-size error.
- Regression tests in `tests/files.test.cjs`, `tests/sdk-integration.test.mjs`, `tests/audio-relay.test.mjs`, and `tests/agent-runtime.test.mjs` exercise real byte handling and HTTP forwarding beyond the former boundaries.

Dependencies added: none. UI styling, provider authentication and endpoint selection are unchanged.

## Tests performed

- Full application suite: **218 passed, 0 failed**.
- TypeScript checking: `tsc --noEmit` passed; no build artifacts emitted.
- Local file fixture stores and resolves a 22 MB image whose encoded data exceeds 28 MB without truncation, retains more than four attachments and prior turns, includes text over 512 KB in full, and stores an 11 MB video.
- SDK HTTP test uploads an 11 MB text file plus five other files after the library already contains 200 entries, forwards complete attachment content through the real Agents SDK, and preserves unauthorized-session and mismatched-size rejection. The SDK integration suite was rerun successfully after the final size-consistency error refinement.
- Main chat forwards a 33 MB image data URL and document text above the former hydration threshold through the SDK to the local provider fixture.
- Provider and Codex relay HTTP tests forward media above 32 MB. The provider's own HTTP 413 is preserved. Existing format, ownership, cancellation and origin-rejection tests continue passing.
- `git diff --check` passed. No screenshot comparison was needed because this changes upload/storage/transport behavior rather than layout.

## Remaining limitations and provider compatibility

There is no fixed application size/count ceiling for these attachment paths. Actual device memory, IndexedDB/disk quota, HTTP servers/proxies, model context windows and provider limits still apply. Images are currently encoded in memory; very large requests are constrained by available memory and the runtime's buffer/string capacity. Removing caps does not add a streaming/chunked upload protocol to providers.

File-type support is unchanged: the local library can store video/documents, while the regular model bridge hydrates supported image formats and text files. Other formats still require a compatible provider protocol/feature; storing a video does not make a text/vision-only endpoint capable of processing video. Recording-specific dictation duration/buffer rules, generated-output guards, and limits for unrelated control requests/imports are outside this attachment change.

Rust/Kotlin changes were reviewed in source only. Native compilation and Android runtime testing are deferred until the user authorizes the next build. The already installed/published APK is unchanged.
