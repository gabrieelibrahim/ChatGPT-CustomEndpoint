# Desktop reference implementation

## Personal and Workspace views

The default view now follows the two supplied Personal web screenshots. It has a black canvas, expanded/collapsed sidebar, Chat/Work tabs, centered empty-chat composer, Think toggle, local image previews, searchable local chat history, and a mobile sidebar drawer. AI replies, voice, plugin installation and task scheduling remain UI previews.

Switch to the retained desktop interface from the Personal profile menu → Workspace interface. Return from the Workspace profile menu → Be Be → Personal. Direct routes: `/` for Personal, `/?view=workspace` for Workspace, and `/?mobile=1` for the previous mobile study.

Personal desktop uses the supplied 1920px-wide reference canvas, scaled to the actual browser viewport. Personal mobile below 900 CSS pixels uses its own responsive layout. Mobile behavior is an implementation choice because the new supplied references are desktop-only.

The Plugins symbol and collapsed Personal logo are SVG geometry traced from supplied screenshots. Their visual match has not been verified in a browser screenshot comparison.

The desktop layout is based on the supplied 1920 × 1008 screenshots. Open at a viewport at least 900 pixels wide. The previous mobile interface remains available below that width or at `/?mobile=1`.

## Run

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5173
```

## Implemented

- Desktop title bar appearance, navigation rail, collapsible sidebar, pinned/recent conversations, and chat header.
- Reference conversation and a local chat composer with multiline input, local image previews, and sending demo messages.
- Model picker, effort slider, approval selector, profile menu, and navigation menu. Approval and model choices are visual local state; they do not control real permissions or AI models.
- Scheduled task cards, plugin catalog layout, and Sites table.
- Local conversation title storage, search dialog, Escape dismissal, keyboard focus indication, and Enter/Shift+Enter input behavior.

## Validation and remaining differences

TypeScript checking and production build pass. Automated browser visual comparison was blocked by the browser tool, so pixel identity has not been established.

Icons are hand-drawn SVG approximations. Plugin logos, clock imagery, site thumbnail, and native title bar controls are approximate. Fonts have not been matched to the original binary's font files. Native window controls are decorative in the web preview. Full attachment processing, voice, account settings, real scheduling, plugin installation, sharing, and some secondary dialogs are placeholders.

Popover motion is an implementation choice; screenshots do not establish original timing or easing. A recording is required before matching animation behavior. There is no Android/iOS build configuration yet.

Relevant files: `src/desktop/Desktop.tsx`, `src/desktop/desktop.css`, and `src/main.tsx`.
