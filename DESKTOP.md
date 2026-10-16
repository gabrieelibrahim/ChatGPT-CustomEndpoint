# ChatGPT-CustomEndpoint desktop UI

## Active experience

The default route opens the newer desktop interface. ChatGPT and Codex are presentation choices in the sidebar selector, not authenticated account tiers or provider/model restrictions. The earlier classic Personal implementation is retained under `src/personal/` but is not reachable through the active shell, including `?view=personal`. The older mobile study remains available at `?mobile=1`.

ChatGPT has distinct Chat/Work presentations. Work uses a stacked composer with project/files/plugins actions. Chat uses the single-row capsule from the reference, the heading "Where should we begin?", an effort-only label and a temporary-chat toggle. The toggle skips local history persistence for that temporary Chat session; it does not configure a remote provider. Codex starts with its own mark, build prompt, bottom composer and project/computer context bar. Switching experiences preserves the active conversation and draft, restoring the destination's last view when one exists; only New chat resets to a home screen. Existing chat reference data and local conversations remain available from the sidebar.

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
- Search palette with chat/content filtering, quick actions and navigation; arrows, Enter, Escape and Alt+1 through Alt+9 selection.
- Sidebar collapse preserves scroll position and folded sections; Pinned is available in both experiences.
- Local Back/Forward history and a sliding Chat/Work selection indicator, with reduced-motion support.

Ctrl+Shift+S toggles the sidebar, Ctrl+N or Ctrl+Shift+O starts a new local conversation, Ctrl+K toggles search, Alt+Left/Right traverses local navigation, and Ctrl+Shift+J opens a temporary Chat session when the browser delivers those shortcuts. Browser-reserved shortcuts may take precedence. Settings and native commands in the search palette open local preview dialogs; Open folder uses the existing local project chooser.

## Fonts

The active UI uses the installed `Segoe UI Variable Text` font first, followed by platform UI fallbacks. This matches a reported ChatGPT Windows CSS stack, not verified current runtime typography. No system font files are bundled. See `src/typography.css` for provenance. Exact appearance depends on platform fonts, DPI and browser rendering.

## Icon and corner geometry

`src/components/UIIcon.tsx` maps 46 shared controls to official MIT-licensed SVG components from [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui), pinned to revision `0f00143c7a639906f1621fe58e1b6be7b5bea46d`. The selected components are copied unchanged under `src/components/openai-icons/`, with source details and license. Filled paths explicitly disable inherited strokes to preserve their original geometry. No global SDK styles or extra runtime dependencies are loaded; existing icon dimensions and layout stay in place.

The previously approved round Plugins symbol is preserved as `public/plugins-symbol.svg` on its original 27px canvas: the upstream Plugin is a different puzzle symbol. Reference-specific controls without matching symbols and third-party logos remain local. `src/desktop/shapes.css` retains the existing rounded controls. The production build includes the OpenAI MIT notice at `/third-party/apps-sdk-ui-LICENSE.txt`.

## Functional limits and verification

Desktop chat replies remain local demo replies. The legacy mobile API client has not been connected to the newer UI. Model names, approval controls, Plan/Goal chips and plugin selections do not grant permissions or invoke agent capabilities. Chrome attachment explicitly reports unavailable. Local file selection does not upload files to a provider.

Production build and read-only server-render smoke checks cover both home variants, disabled classic routing, Add menu, navigation pin labels and user-turn markers. Browser visual QA was blocked by the browser origin permission gate. Pixel identity and exact animation timing are not established. Native window controls are decorative. Official SDK icons do not guarantee that every symbol matches the current ChatGPT desktop application.
