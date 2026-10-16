# ChatGPT-CustomEndpoint desktop UI

## Active experience

The default route opens the newer desktop interface. ChatGPT and Codex are presentation choices in the sidebar selector, not authenticated account tiers or provider/model restrictions. The earlier classic Personal implementation is retained under `src/personal/` but is not reachable through the active shell, including `?view=personal`. The older mobile study remains available at `?mobile=1`.

ChatGPT starts with Chat/Work tabs, a centered composer and project/files/plugins actions. Codex starts with its own mark, build prompt, bottom composer and project/computer context bar. Selecting an experience opens its home screen. Existing chat reference data and local conversations remain available from the sidebar.

## Development

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
npm run build
```

The current desktop composition follows a 1920px-wide reference canvas scaled to the browser viewport. Native mobile layouts and packaging require separate work; the desktop reference is not a completed Android/iOS build.

## Local interactions

- Experience selector with descriptions, current selection and keyboard navigation.
- Collapsible Projects/Recents, independently scrolling history, hover previews and pin/archive controls.
- Navigation pinning from More, saved on this device.
- Tooltips with shortcut labels, anchored in the scaled interface.
- Conversation markers based on user turns, smooth jumps and a scroll-to-latest button.
- Message copy, local editing, hover timestamps and browser-dependent read aloud.
- Full-width Add menu anchored to the composer; file previews, local selection chips and a sketch canvas.
- Local project names and text conversations saved in localStorage.

Ctrl+Shift+S toggles the sidebar, Ctrl+Shift+O starts a new local conversation, and Ctrl+K opens search when the browser delivers those shortcuts to the page.

## Fonts

The active UI uses the installed `Segoe UI Variable Text` font first, followed by platform UI fallbacks. This matches a reported ChatGPT Windows CSS stack, not verified current runtime typography. No system font files are bundled. See `src/typography.css` for provenance. Exact appearance depends on platform fonts, DPI and browser rendering.

## Icon and corner geometry

`src/components/UIIcon.tsx` supplies the shared smooth SVG paths. Active desktop icons no longer use pixel-grid traces, Unicode window-control glyphs, or a four-square fallback for unknown names. `src/desktop/shapes.css` keeps icon strokes, rounded corners and toolbar hover shapes consistent without replacing the existing page layout. All 66 registered icons render at 27px and 54px; rectangle shapes use explicit corner radii. These are independent reference-based drawings, not an official icon package.

## Functional limits and verification

Desktop chat replies remain local demo replies. The legacy mobile API client has not been connected to the newer UI. Model names, approval controls, Plan/Goal chips and plugin selections do not grant permissions or invoke agent capabilities. Chrome attachment explicitly reports unavailable. Local file selection does not upload files to a provider.

Production build and read-only server-render smoke checks pass for both home variants, disabled classic routing, Add menu, navigation pin labels and user-turn markers. Browser visual QA of the latest patch was blocked by the browser origin permission gate. Pixel identity and exact animation timing are not established. Native window controls are decorative; icons remain reference-based SVG approximations.