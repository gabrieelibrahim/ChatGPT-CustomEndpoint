# Mobile media, conversation menu, and dictation

Reference: user-supplied 614×1280 screenshots, normalized to a 390×813 CSS viewport. These changes do not establish physical-device animation or microphone parity.

## Reference evidence

REA inspected the supplied `ChatGPT.apk` (SHA-256 `a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`, package `com.openai.chatgpt`, version `1.2026.279`). Retained class evidence:

- `ev_018dc463004b52f20fe8f93c98fa9544dbf01b5cb7811b0ae7b1622a9ea3110f`: `DictationService.createSession(DictationOptions, DictationObserver)`.
- `ev_adbf2f85643d04cf10bc4b1635b7924071eaae63b188527721d005afb0758ec2`: dictation options contain language/context.
- Class inventory `ev_594f1b29d784b2568bfb50a883f564b8d720cbab69b68482389227360f1f3870` identifies recording and streaming error classes, including microphone-busy and capture-start exceptions.

These are static observations, not a live microphone test or evidence that an arbitrary custom provider supports audio. No original APK code or assets were copied.

## Implemented behavior

- Photos sit inside the composer surface, with horizontally scrolling 98×122 thumbnails and inset removal buttons. The empty three-photo composer is 225 CSS px tall; multiline text expands it. Sent photos preserve image proportions outside the text bubble.
- Video attachments use a filename pill with a purple video icon and chevron. Opening it plays the local video in a full-screen preview. Document cards download in browsers or open through Android's file chooser using a temporary FileProvider copy.
- The upper-right conversation menu supports transcript sharing, pin/unpin, project membership, uploaded files, in-chat search, Android launcher shortcuts, archive, and confirmed deletion. Sharing opens Android's share chooser. A launcher must support pinned shortcuts; they reopen the saved local conversation. Temporary chats cannot be pinned/archived/added to a project or launcher.
- Settings → Log aplikasi shows a bounded local ring of 300 technical events with category filtering, copy, export and clear. Only fixed diagnostic codes/counters are persisted; no API credentials, URLs, filenames, transcripts, chat bodies, audio or provider response bodies.
- Settings → Suara selects Auto, Custom Endpoint or Device, plus transcription model/language. On Android with a selected endpoint and recording bridge, Auto records AAC/M4A and transcribes through that selected endpoint; otherwise it uses device recognition. Device recognition errors now distinguish network, busy, audio, permissions and language errors. An unsupported transcription route/model is reported explicitly, without silently submitting to another provider.
- API transcription uses multipart `file`, `model`, `response_format=json` and language when set, following [OpenAI's transcription API](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create). The default model identifier is `whisper-1` for compatible endpoints and can be changed. Providers need to support the selected audio route/model.
- Recording is explicit and foreground-only, bounded to 60 seconds and 5 MB. Cancel, timeout, unload, permission denial and leaving the recording screen stop/discard it. Android temporary audio is deleted after stop/error/cancel. Finishing a recording uploads audio to the configured provider; the response fills the existing composer. Voice mode uses a simple measured-silence boundary, not the proprietary ChatGPT realtime service.

## Validation and limits

Final checks: 181 automated tests pass; frontend production build and emitted SDK stylesheet-order guard pass; all four changed/new Kotlin sources compile successfully against the cached Android dependencies. This is a compile-only native check, not APK packaging or microphone execution.

Runtime tests cover multipart fields/authorization, successful dictation, unsupported-provider errors, duplicate native events, cancellation before permission and during HTTP, late-result suppression, log redaction/ring bounds, native UTF-8 JSON log sharing, plus real local HTTP multipart relay and origin checks. Kotlin is compiled against Android 36 and cached dependencies independently of APK packaging. Browser checks use the actual app at 390×813 for photos, menu, search, pins, logs and video preview.

Physical Android microphone permissions, hardware recording, provider transcription, launcher shortcuts, Android share/file choosers and decoder behavior still require a device test. A working chat endpoint does not imply audio API support. No real-provider transcription or actual microphone capture was claimed by the mock tests. Video/PDF cards and previews do not add binary video/PDF model input support to the existing text/image bridge. No APK/release is produced by this change.
