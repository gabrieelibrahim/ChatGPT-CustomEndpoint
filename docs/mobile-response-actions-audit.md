# Mobile response actions and drawer clipping

Reference: user-supplied ChatGPT.apk, SHA256 a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e.

## REA evidence

- y1b0.<clinit>: message action enum includes Copy, SelectText, ReadAloud, Share and other actions. Evidence ev_eeffb6f2cccf71e83dd3756bdffdecbb78f2156fe5d945434fc323565631a2a5.
- ozh.c: CopyButtonImpl has remembered success state, feeds two icon/label states into mn7; the icon is 24dp. Evidence ev_ee60c23436e0167c7ec6cbd39c81bacac6ac25929b9c718c521e6744d45c696c and ev_b9609e99780ad8d76b335eeb5e699c4cf6a266ab84abca981d59001d2712ae43.
- lzh.invokeSuspend sets success only after successful clipboard result. kzh.invokeSuspend waits ozh.a then clears it. ozh.<clinit> initializes duration 2 in vmw.d, verified as SECONDS in vmw.<clinit>. Evidence ev_95fb112225c2db870c9a51fbbaab606c72f4af18641da30e632a57e14634a6e5, ev_adf4fbd2a5a2d737255d879f97554808968846e563d3209288ef811d76dc6716, ev_bca269df20a58c6606f74b005251a5ffd04a5dfc7dad5a22fdb11748a8ee6d84.
- Existing reference-video contact sheet shows copy, audio, Android share silhouette, vertical overflow beneath the answer. The supplied 2026-10-18 160257 video shows app content clipping during/after drawer interaction.

## Implementation and checks

Four response actions: copy, read aloud, share, overflow. Copy/check feedback persists 2 seconds only after success, timers are cleaned up, repeated requests discard stale completion. Short 160ms feedback entrance is reconstruction tuning, not recovered native timing. Android share uses the three-node silhouette; native share UI is used where available, otherwise only the response text is copied. Cancel is silent. Overflow offers text selection, copy and share; the entire reference overflow feature set is not claimed implemented.

Shell and sidebar motion now use overflow:clip, so focus cannot programmatically scroll those clipping containers. Drawer, sheet and search focus use preventScroll. This addresses the inferred focus/overflow source of the clipping seen in the supplied video; exact old timing was not reproduced in a native runtime.

Live browser at the user's 515 x 524 viewport: all four actions present, copy becomes check, later returns to copy. Text selection via overflow works. Opening drawer and closing by tapping the outside area leaves app scrollLeft=0, content x=0, header button x=14, composer x=12.09. Screenshot saved in chat outputs/mobile-response-copy-feedback.png.

TypeScript no-emit check and four focused response/sidebar/presence tests passed. No APK compilation or publication performed, per user instruction. Native-device animation parity remains unverified.
