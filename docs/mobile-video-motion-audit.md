# Mobile motion: supplied 2026-10-18 recordings

## Evidence

- `document_6244436940016330292.mp4`: 590x1280, 11.458s, variable frame timing. Launcher-to-app entry, repeated keyboard opening/dismissal. App content uses the normal Android activity transition; the recording is not proof of a separate timed splash on every warm resume.
- `document_6244436940016330295.mp4`: 882x452 crop, 6.118s. Chat/Work selection surface moves across the segment, with the temporary-chat control fading out in Work.
- `document_6244436940016330296.mp4`: 590x1280, 59.074s. Initial expanded editor/keyboard, send around14.6s, keyboard dismissal, pale blue wait marker, incremental response from around18.9s. Embedded demo cards/charts/controls are response content; pointer/touch indicators and system notifications are not app controls to reproduce.

FFmpeg contact sheets and focused timestamp samples are saved in the chat's `work/video-ux-oct18` directory. Frame samples preserve the original video as reference; resampled contact-sheet labels are approximate and are not timing instrumentation.

## Geometry comparison

For a matched app-content comparison, the 590px-wide reference frame at14.8s is cropped by48px at the top (system status area) and32px at the bottom, then resized to390x793. Browser preview uses390x793. Device insets are handled separately in native code/CSS; no Android dp density is inferred solely from screenshot size.

- Reference user bubble is approximately422x117 source pixels atx144,y172. Normalized app area: x95.2,y82.0,width278.9,height77.3. Preview after settling: x94.76,y81.3,width279.24,height76.79. Corresponding line wrapping matches the reference sentence.
- Mobile message padding is16CSSpx. User bubble max-width78%,18px text/26.4px line height,padding12px18px. Blue sampled from the compressed recording is nearRGB(2,4,97); lossless source color is unknown.
- Resting composer inset is34px before and after the first send, and49.5px high. Engaged editor moves to12px inset. First app-session focus uses96px expanded editor; subsequent reopening remains compact until content requires more height.
- Waiting marker center is nearx35,y346 in the reference. It varies around18–23source-pixel diameter with a roughly1.25s pulse. UI uses15CSSpx,#aecbfa and.78–1scale; these are recording-based reconstruction settings, not recovered original implementation constants. Phase depends on request start time.

## Changes

- On initial app-session chat entry, focus the composer once. An origin-restricted, main-frame-only Android bridge requests IME explicitly after the window gains focus. Later navigation does not repeatedly reopen the keyboard. Browser preview focuses the field but cannot reproduce the Android keyboard itself.
- Send consumes the first tap, blurs the textarea and hides the native IME. The existing composer transition collapses the first expanded editor and restores resting width.
- Chat/Work uses one sliding selection surface and hides the temporary-chat control in Work.
- Assistant output no longer translates the entire article on arrival. Raw provider/history text remains immediate; a presentation-only frame scheduler coalesces small token bursts and settles larger bursts within180ms. It preserves surrogate pairs, handles rewrites, cancels on unmount, bypasses animation for existing history/reduced motion and waits to show response actions until final display catches up. Endpoint latency/token cadence still determines when data is available; it is not fabricated to match reference network timing.
- A ResizeObserver follows rendered content growth while the user is at the bottom. Scrolling upward opts out of automatic following; footer clearance remains independently measured.

## Validation and limits

- TypeScript and focused composer/conversation/stream-presentation/markdown tests pass. Tests cover final text integrity, emoji boundaries, burst coalescing, rewritten content, cleanup and immediate history rendering.
- Actual mobile app preview uses the existing local mock endpoint only. Input has focus on startup;96px initial editor was measured. One-tap send removes focus, settled composer returns to49.5px height and34.09px inset, and a997px answer scroll area followed to within0.67px of bottom. Four response actions appear after completion.
- Native keyboard bridge source is updated, but no new APK is built or released by this task. Physical Android keyboard/IME animation and exact display refresh/font rendering remain unverified; the browser screenshot comparison is not a claim of universal pixel identity.
- Preview artifacts: `mobile-ux-video-comparison.png`, `mobile-ux-waiting.png`, and a short `mobile-ux-streaming-preview.mp4` captured from actual browser frames with timestamps. The recording is a local simulation, not a real provider response.
