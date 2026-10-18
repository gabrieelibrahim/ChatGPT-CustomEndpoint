# Settings navigation and skeleton reference

Reference: user-supplied `video6246688739830013512.mp4`, 588×1280,
5.86 seconds. Inspected the contact sheet plus 80 ms samples around forward
navigation, Back and the memory skeleton. Personal account details visible in
the reference are not reproduced in screenshots or fixtures.

## Observed behavior

- Around 1.84–2.12 s, personalization leaves through a short horizontal shift
  and fade, then the settings menu becomes visible. It is not a full-screen
  drawer slide.
- Around 2.64–2.96 s, memory opens with bar, switch, caption and field-shaped
  placeholders before the real controls appear.
- Plugin Back returns to the settings menu, with the same general transition.

## Implementation

`MobilePageTransition` keeps keyed outgoing and incoming page layers together.
The outgoing layer is inert and hidden from accessibility while departing;
its mounted instance and scroll position are retained during the fade. Back
reverses the motion direction. Rapid navigation cancels the older removal timer.
Only settings and settings-owned destinations use this wrapper; chat rendering
and streaming are unchanged. Reduced-motion preferences skip retained motion.

Timing is tuned from the supplied video, not recovered from native source:
32 px horizontal displacement, 120 ms departure, incoming fade/movement over
160 ms after a 60 ms offset, with layer removal at 220 ms.

Settings details show semantic skeletons while preparing controls. There is a
240 ms visual settling window so controls do not replace placeholders halfway
through navigation. It does not represent a provider/network request. Storage
also waits for its real IndexedDB file query and shows an error caption if that
query fails. Stale preparation is cancelled after leaving the screen. Cached
root settings return directly, without an invented data-loading phase.

## Verification

Browser comparison used a 390×813 app viewport. Captured real browser frames
through forward navigation and Back, including visible skeleton frames followed
by live controls. Checked that only the current page is accessible and Plugin
Back returns to settings. Tests cover reverse direction, inert outgoing content,
rapid navigation, reduced motion, skeleton replacement and stale preparation.
The web build checks TypeScript and emitted SDK CSS layer order.

Desktop-browser timing is not proof of exact native-device parity. No APK was
created, SDK integration installed or GitHub release changed by this revision.
