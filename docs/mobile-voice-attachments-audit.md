# Mobile attachment, dictation, voice and bottom-fade audit

## REA reference evidence

Target: supplied ChatGPT.apk, SHA256 a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e.

- k76.<clinit> includes PromptOnly, Camera, Gallery, CameraOrGallery and Sketch input modes. Evidence ev_0274178ba0f13d608c622d54352e3d6487ecb8808add7f3ee820485d5d6ee409. This enum does not prove all tools are available for every account/menu configuration.
- pzu.a identifies DictationBarHintLabel and layout extents 24dp / 128dp and another 32dp branch. Evidence ev_47f64730eaf7656b2ae21d025da97f8ca3e7581b3a426fd1a798ae6127c55722.
- f5v.invoke / DictationIconButtonImpl returned no decompiled body. inp0.d identifies VoiceModeSessionHostImpl and processIntent but does not recover a ready-to-use voice backend. Evidence ev_c7484ebc795d8347aa13e57b44736c151a5fc76502a34d456257081d22769ff2 and ev_e7c3ce2b1e63e98a53ed92312a05262c13a2bd2d444ebabbc4864c0596ab80cb.

## Supported implementation

Plus opens a bottom sheet offering camera, photos and files, using separate file inputs (image capture=environment, multi-image picker, general multi-file picker). Existing local file validation/storage and provider attachment handling are retained. Sketch and unsupported remote tools are not invented as working menu entries. Camera capture availability depends on the host picker.

Dictation has starting/listening/review/error states, live transcript, cancel and confirm. Confirm waits for final recognition results and inserts text into the draft; it never automatically sends a chat. Cancel discards pending text and clears callbacks/timers. Permission denial and unavailable recognition are explicit errors. Wave bars are a listening indicator, not measured audio amplitude.

Voice opens a caption/microphone/end panel. Opening alone does not start recording; the user starts the microphone. Completed utterances go through the selected existing text-chat transport/history; replies are spoken using device speech synthesis and settings. Pending provider requests, recognition and speech playback are canceled on close. The same modality continues to respect temporary-chat personalization/storage rules.

This is a device/browser speech + selected text-provider implementation, NOT ChatGPT's native duplex voice/Realtime backend. No Android-native SpeechRecognizer bridge or audio-provider protocol is included. WebViews without Web Speech support show an unavailable message; no working native Android audio parity is claimed. That requires a supported native/audio-provider integration and a physical-device test.

Conversation footer overlays scrolling messages. Its gradient extends from 40px above the footer to the physical bottom and ends at 97% opacity (3% transparent). A border-box ResizeObserver adjusts message bottom clearance with composer size/padding. Right message scrollbar is hidden with Firefox and WebKit rules while scrolling remains enabled.

## Verification and limits

TypeScript no-emit check passed. Ten targeted speech/controller/UI/conversation tests passed with simulated recognition and synthesis: final-result ordering, interim replacement, canceled/late events, denied permission, unsupported engine, voice not recording on open, accepted dictation not sending chat, completed voice reply delivery, and audio cleanup. No live microphone was captured by automation.

Browser preview at 515x524 verified the three attachment choices, separate picker attributes, voice open/close controls, gradient rgba/97% bottom alpha and scrollbar-width:none. Screenshots in chat outputs: mobile-attachment-menu.png, mobile-voice-panel.png, mobile-composer-bottom-fade.png. Actual camera/audio recording, native visual parity and physical Android support remain unverified. No APK compilation/publication performed.
