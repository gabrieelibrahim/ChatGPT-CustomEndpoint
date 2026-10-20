# Mobile device settings and composer corrections

## Changes

- Report bug opens a Telegram draft addressed to `@gaasssiikkkkk`. It contains a short diagnostic summary without chat contents, recordings, API keys or file names. Telegram handles final sending. Public username draft syntax follows https://core.telegram.org/api/links#public-username-links.
- Export conversations writes JSON through Android's `ACTION_CREATE_DOCUMENT` picker. Saving, cancelling and write failures return separate results to the UI. Browser export downloads the same JSON. The export includes conversation content and pin/archive metadata; media binaries remain in the device library.
- Storage opens an actual IndexedDB file library with search, import, previews, names, sizes, dates and explicit deletion confirmation. No example file entries are generated. Back returns to Storage.
- The notification preference controls a native notification channel for successful chat completion. Failed/stopped requests do not trigger completion notifications. Notification taps open the conversation. Due reminders also notify while the application runs; scheduling after process termination remains unsupported.
- Dictation can select a different saved endpoint profile and a transcription model. The selected chat endpoint does not change when choosing the dictation profile. Credentials use the existing endpoint key vault. Providers must support the OpenAI-compatible `/audio/transcriptions` multipart API.
- Opening the composer plus menu prevents pointer-driven blur, avoids inerting the active textarea, and avoids moving focus into the menu. File/camera pickers keep their normal platform focus behavior.
- Android IME visibility events supplement viewport measurements so keyboard dismissal collapses the composer even if DOM focus remains. The initial closed-IME observation preserves first-focus expansion. Existing width and height transitions and reduced-motion behavior remain active.
- Mobile hides generic `Memproses...` agent progress while preserving the blue waiting dot and meaningful tool progress.
- Splash uses the full 1254 px logo from drawable-nodpi instead of the small launcher foreground. The dedicated drawable is 68 dp, with theme tint and the existing single launch handoff.
- Removed the four-image and one-MB vision restrictions. The retained storage limit is 10 MB per file; the request uses a 28 MB aggregate base64 image budget inside 32 MB transport limits. Providers may impose their own limits. Successfully saved attachments remain in the composer if a later selected file fails.
- Session rows and context menus suppress WebView text selection/callout; opening a menu clears any existing selection. Inputs for renaming retain selection. Sidebar SuperGPT opens a new conversation and shows a rounded press response.

## Evidence and validation

- REA opened the supplied `ChatGPT.apk`: SHA-256 `a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`. Static inspection of `defpackage.bjp.f` (`ev_7143f23bcbe6796c91c2d6394a40b75c1b62baeddc66945402ecff13b758c080`) confirms a composer-dictation entry anchor in deep-link handling, not animation constants. Motion geometry follows the supplied recordings documented in `mobile-video-motion-audit.md`. No exact runtime timing was recovered from this static pass.
- Live Android observation was unavailable through REA because its configured adb executable could not be found. No claim of physical-device or universal 1:1 parity is made.
- At 390 x 813 in the running preview, composer width measured 321.8125 px after blur and 365.8125 px while active. Computed width/height transition is 240 ms cubic-bezier(.2,.8,.2,1). Clicking plus preserved `Message` as the focused element and left the textarea outside an inert subtree.
- Actual browser export produced `SuperGPT-chats.json` with a download success notice. Storage and library independently showed nine existing local files totalling 3.2 MB; no test files were inserted for this check.
- Regression checks cover more than four images, images exceeding one MB, aggregate image budget, separate transcription routing/model, Unicode export, cancellation/write failures and notification success/failure/mute behavior.
- TypeScript/Vite production build and the emitted SDK CSS ordering guard pass. Android `compileArm64DebugKotlin` passes with the Rust packaging task excluded; no APK was packaged or released in this task. One existing `Notification.Builder` deprecation warning remains in TaskForegroundService.
- Audio provider integration, Android save-picker behavior, notification delivery and keyboard interaction still require a physical-device check with the user's provider and permissions.
