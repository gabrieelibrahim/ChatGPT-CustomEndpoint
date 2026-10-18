# Mobile dictation and history revision

## Reference boundary

Reviewed the supplied `document_6244436940016330298.mp4` (864×936,
8.95 s), `...0299.mp4` (1078×424, 36.56 s), `...0300.mp4`
(794×1280, 21.22 s), plus the full 614×1280 sidebar screenshot.
The videos are cropped; their pixel widths are not Android density values.
Contact sheets and focused frames were inspected before editing.

The first recording shows an extra upward swipe exposing **Obrolan baru** at
the completed response end. The second shows cancel, a changing waveform,
stop and a blue arrow, followed by a transcription state and text in the
composer. The third shows anchored session menus and a rename dialog.

REA `inspect_android_method(defpackage.pzu.a)` returned complete Java source
for `DictationBarHintLabel`, with a default `220` parameter and modifier
arguments `24.0f`, `128.0f`, and `32.0f`:
`ev_dbe6f8568b682feea17ffdbb134cacd8c531dfb5269c35f7dcbc3c28ac68baf1`.
These numbers alone do not establish a whole composer size or animation
duration. This is static evidence, not a runtime microphone test. The file's
independently calculated SHA256 is
`a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`;
REA's `engine.artifact_sha256` differs and is not used to identify the APK.

## Changes

- Replaced the malformed paperclip path with one continuous, open-ended loop.
- Use the existing OFL Roboto variable font in mobile so Windows preview and
  Android do not select different system font families. Normal text is 400;
  navigation and attachment labels are 500. Proprietary APK fonts are not
  redistributed. SDK markdown and icon assets remain in use.
- Navigation and pinned-chat icons use 21 px. Response-action glyphs use
  21 px (overflow dots 18 px), retaining 44 px response button hit targets.
- Long press (450 ms) opens an anchored 294 px menu with 49 px rows. Movement
  beyond 8 px cancels the pending hold; release after a hold does not open the
  chat. Keyboard Context Menu/Shift+F10 and preview right-click also work.
- Pin, rename, project assignment, archive, and confirmed deletion use local
  conversation data. Rename updates messages and pin/archive/project references;
  conflicting names are rejected. Current streaming chat rename/delete waits
  for the response to stop, and changing another chat does not resurrect it
  during streaming persistence.
- An extra upward swipe at the completed conversation end exposes the new-chat
  shortcut. Only tapping it starts another chat. Normal scrolling is retained;
  the browser's Android overscroll physics are not replaced by a custom engine.
- Dictation uses Android SpeechRecognizer through a trusted top-frame bridge
  in the APK, and Web Speech where available in the browser. Microphone permission
  is requested only after dictation is invoked. Partial/final transcripts,
  actual Android RMS levels, processing, cancellation and error states are
  routed by session ID. Late replies cannot reinsert cancelled text.
- The dictation bar now has cancel, waveform, stop, and blue acceptance controls.
  It waits for final transcription, then inserts text into the draft once.
  It does not automatically send a chat. Browser engines without RMS output
  show a quiet baseline rather than fabricated audio levels.

## Verification and limits

Preview screenshots at 390×813 verify the paperclip, labels, sidebar menu and
rename-dialog state. Checked the context menu width (294 px), no horizontal
overflow, and disabled rename action while the name is unchanged. Automated
tests cover final-result waiting, cancellation/stale replies, permission errors,
gesture thresholds, and metadata preservation/rollback. No real audio was
recorded during testing.

The focused suite passed 31 tests; TypeScript and the web production build
including the SDK CSS layer-order check passed. Kotlin sources were checked
with the cached standalone compiler against Android API 36 and actual cached
AndroidX/Tauri/Wry classes, without APK packaging. Browser measurements confirmed 21×21 px response glyphs inside
44×44 px buttons and the extra-scroll shortcut appeared at the conversation end.

Android dictation uses the device's installed recognition service; it is
separate from custom endpoint chat/audio protocols. Availability and speech
quality depend on that service. Native permission, keyboard, microphone and
overscroll behavior still require a real-device test. Exact visual/animation
parity across Android font scaling and device density is not established by a
desktop screenshot. This revision does not create or publish an APK.
