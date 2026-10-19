# Pull-to-new-chat gesture: REA audit

The previous implementation appended a permanent button after a 36px scroll
threshold. That changed the thread height and lost the reference's pull/release
interaction. It has been replaced with an overdrag controller and an overlay.

## Evidence

User-supplied `ChatGPT.apk`, SHA-256
`a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`,
package `com.openai.chatgpt`, version `1.2026.279` / `2627911`.
REA package evidence: `ev_74afb3391a8e95144f7574fcd34d4970966dabe961f0cd4a6d0ad05ddca825bd`.
JADX 0.7.1; the APK was not launched. Obfuscated names below are build-local.

- `at51.a`: PullToChatLayout binds content transformation, nested scroll and
  pointer handling. `ev_69d3c0913bf21236255055209e31ad058c90729effd1f9b6798f0b780ce94687`.
- `ghm0.a`: accumulated drag uses
  `height * (1 - 1 / (1 + .55 * rawDrag / height))`, with reverse motion reducing
  the accumulated distance. `ev_e8f31528ed82666a7134f136da75334183f266e59383ffeb5dad93272632e744`.
- `xs51.l`: default threshold 112dp; opacity offsets 12/24dp and indicator offset
  24dp. `ev_4d61ff2aee6828305f3d198fe0a6a31db57b7c7f3a79279619ef43c2d430989f`.
- `xs51.i`: 36dp circle, 18dp glyph, 3dp ring, 8dp gap; armed icon scale 1.2,
  spring damping .5 / stiffness 631.6547. Dismissal uses .15/.2 second periods.
  `ev_b0acd542a42bca79aec4098614587fddb94cca654179ced2149e3e82f65ac39c`.
- `f8f0.invoke`: opacity `(distance - 12) / 24` clamped to 0..1, nonlinear
  indicator scale and position (including secondary rubber-banding after half
  the arm threshold). `ev_a9cffb1c0767113ef0c9e3ff0a1afd04d3c852689ffed8c48297b2ac56837e5d`.
- `x420.invoke`, case 26: ring progress `distance / threshold`, clamped.
  `ev_f32868782c9790d4468b29b1f78e51f2a0d78f571407de616dc5852f9b200b55`.
- `fhm0.invokeSuspend`, smali fallback: releasing the last pointer while armed
  invokes the new-chat callback; cancellation follows a different path.
  `ev_91ef19f0ddbdf02d5719c163ea228f3817cd0176099b4e534be380b4ffe04eab`.
- `p4q.invokeSuspend`, smali branch 3: recoil uses a critically damped spring
  with stiffness approximately 109.66227.
  `ev_9a2cb8cbc95c2ec0ad63b0d0f1d32555c6275e621c1fe931bb29e15190343233`.

The user's recording `document_6244436940016330298.mp4` was sampled at 10fps
through the first five seconds. It corroborates content moving up, a growing
progress ring, then a larger blue edit icon. Static analysis does not measure
physical device frame pacing, touch latency or keyboard behavior.

## Implementation

`endPull.ts` owns reversible accumulated drag, geometry, spring animation,
arming and release/cancel. `MobileEndPull.tsx` consumes only a vertical gesture
starting at the lower scroll edge (5px tolerance). Normal scrolling, interactive
links/buttons and nested code blocks keep their input behavior. Multitouch,
blur, pointer cancellation, modal changes, conversation changes and unmount
cancel or dispose pending work. Mouse/pen and wheel support the browser preview.

The content translates continuously; the indicator is portaled outside the
scrollable stack, so revealing it does not add scroll height. Short/reversed
pulls return home. Releasing an armed pull starts exactly one new chat and
focuses its composer. Browser transition uses a 150ms dismissal window before
switching the conversation; this is an implementation choice based on the
native dismissal period, not a measured native navigation delay. Reduced motion
keeps activation thresholds while bypassing the animated return.

## Verification boundary

Controller tests cover resistance, reveal/progress, armed scale overshoot,
short/reversed/cancelled gestures, one-shot release, stale teardown and reduced
motion. Browser checks at 390x813 verify that a short drag returns without
changing scroll height and an armed drag returns to the home composer with focus.
A new native APK has not been compiled or physically tested. Native frame-perfect
parity is not claimed.
