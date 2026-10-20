# Checkpoint before automatic updates and rich response work

Baseline: `752a35d` on main. Existing source modifications are committed; three pre-existing untracked executable/APK artifacts are excluded from this work.

## Files changed

At this checkpoint, only this document. Planned areas: mobile settings and streaming presentation, shared Markdown and structured widget rendering, Android update/haptic bridges, release packaging script, regression tests and implementation report.

## Dependencies added

None at the checkpoint. Reuse the installed OpenAI Apps SDK UI Markdown/KaTeX/code renderer, ChatKit widget types, Android system installer and existing HTTP/browser infrastructure where practical.

## Features implemented

Baseline already includes custom endpoints, native endpoint vault, Markdown rendering, mobile text presentation, file library/export, completion notifications and direct/server MCP flows. Planned work adds stable release updates from GitHub, native completion haptics, bounded streaming work and safe rich widget validation/rendering. Every future release APK must be named exactly `SuperGPT.apk`; the version belongs in the release tag. Release publishing must explicitly use normal releases, not drafts or prereleases.

## Tests performed

The previous task recorded 199 passing automated tests, a production web build including the SDK CSS ordering guard, and successful Android Kotlin compilation. Those are baseline results, not validation of changes in this task. New work will run focused regression checks, the automated suite, production build, native source compilation and browser checks where available.

## Remaining limitations

Ordinary sideloaded Android applications cannot promise silent installation. Automatic release checks/downloads can be implemented; final installation remains controlled by Android permissions and installer UI. Actual on-device installation, vibration and provider audio behavior require device validation. No new APK publication is requested by this checkpoint.

## Screenshots where possible

Capture the running rich-response and updater UI at a mobile viewport after implementation. Screenshots establish only the captured layout, not universal ChatGPT parity.

## Known provider compatibility issues

Plain supported chat endpoints may return Markdown without ChatKit metadata. Rich widget rendering requires an explicitly supported structured schema; arbitrary HTML/JS and unknown widget actions must never execute. Provider support for tools, vision, audio, Responses and MCP varies. Preserve Chat Completions fallback and current request behavior.

Official public reference: https://developers.openai.com/api/docs/guides/chatkit-widgets. The widget specification documents structured components and Markdown updates; it does not establish proprietary ChatGPT mobile animation or haptic constants.
