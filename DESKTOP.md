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
- Shared grid composer motion, retained animated sidebar sections and preview cards that stay mounted while changing hover targets. Motion helpers live in `src/desktop/Motion.tsx` and `motion.css`.
- Custom Endpoint settings from Profile/Settings, More and the search palette: add/edit/delete/select profiles, manually choose a model or explicitly fetch `/models`. Metadata persists locally; API keys are session-scoped and never included in persistent profile JSON.

Ctrl+Shift+S toggles the sidebar, Ctrl+N or Ctrl+Shift+O starts a new local conversation, Ctrl+K toggles search, Alt+Left/Right traverses local navigation, and Ctrl+Shift+J opens a temporary Chat session when the browser delivers those shortcuts. Browser-reserved shortcuts may take precedence. Settings and Ctrl+, open Custom Endpoint settings; unsupported native commands in the search palette open local preview dialogs. Open folder uses the existing local project chooser.

## First launch and profile

The newer desktop UI requires a local display name on first launch, then offers the existing endpoint editor as an optional second step. Skipping preserves any saved endpoint metadata and session credentials. The form can be revisited through Profile / Custom Endpoint. No automatic connection test is performed. The local name persists under `client-local-profile-v1`; it updates avatar initials and the editable profile menu name, replacing the reference's hardcoded identity. This is not account authentication or cross-device identity.

Setup uses a full-page dark authentication-style presentation outside the scaled desktop canvas: a centered narrow column, rounded outline inputs, pill buttons and a persistent independent Sakelar wordmark. Its name column is 340 CSS px wide and the connection column is 410 CSS px, matching the supplied reference's proportions at 150% display scale rather than treating screenshot pixels as CSS pixels. Name inputs and primary buttons are 52 CSS px high. Widths shrink to fit smaller screens.

Name editing retains its existing responsive dialog. Both use initial focus, Tab containment and hidden/inert inactive steps. The endpoint step first shows a compact connection choice and Skip; activating Custom endpoint reveals the editor and focuses its first field. Kembali collapses it without discarding the draft. Returning to edit the name also retains the endpoint draft. Existing chat state is retained. The rail More menu opens on pointer hover, with a short leave grace while crossing into its panel, and keeps click/touch and keyboard activation. Escape restores focus to its trigger without reopening the panel. Unsupported account actions remain previews; Invite a coworker is disabled to match the reference.

A recommendation card in setup and endpoint settings links explicitly to `https://sakelar.web.id`; it does not preconfigure a provider or route requests through Sakelar. The startup flow can be reused by future native wrappers, but no APK/EXE packaging is implemented here.

## Fonts

The active UI uses the installed `Segoe UI Variable Text` font first, followed by platform UI fallbacks. This matches a reported ChatGPT Windows CSS stack, not verified current runtime typography. No system font files are bundled. See `src/typography.css` for provenance. Exact appearance depends on platform fonts, DPI and browser rendering.

## Icon and corner geometry

`src/components/UIIcon.tsx` maps 46 shared controls to official MIT-licensed SVG components from [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui), pinned to revision `0f00143c7a639906f1621fe58e1b6be7b5bea46d`. The selected components are copied unchanged under `src/components/openai-icons/`, with source details and license. Filled paths explicitly disable inherited strokes to preserve their original geometry. No global SDK styles or extra runtime dependencies are loaded; existing icon dimensions and layout stay in place.

The previously approved round Plugins symbol is preserved as `public/plugins-symbol.svg` on its original 27px canvas: the upstream Plugin is a different puzzle symbol. Reference-specific controls without matching symbols and third-party logos remain local. `src/desktop/shapes.css` retains the existing rounded controls. The production build includes the OpenAI MIT notice at `/third-party/apps-sdk-ui-LICENSE.txt`.

## Functional limits and verification

Desktop text chat now calls the selected OpenAI-compatible profile's `/chat/completions`, using its session key and the actual selected model ID. `endpointChat.ts` handles fragmented UTF-8/SSE, JSON fallback and safe errors. Stop aborts the request; retry retains the original user turn; navigation, profile/model changes and logout abort generation and retain partial text in the original conversation. History writes occur at the user turn and completion/cancellation, rather than synchronously on every token. Missing keys/configuration and attachments block sending with an actionable error; no demo reply is substituted. The legacy mobile client remains separate.

`ProviderModelMenu.tsx` lists saved provider models with search, selected checks and incremental rendering. Discovery in settings exposes a searchable result list rather than relying solely on native datalist behavior. Both lists use dark, narrow scrollbars. The effort popover follows the six-stop reference with a white thumb, dots, lightning/reset controls and a model link. Its values are sent as `reasoning_effort` only when the profile's explicit compatibility checkbox is enabled; not all providers/models accept these values. Approval, Plan/Goal and plugin controls remain local UI previews, not agent capabilities.

In localhost development, `scripts/localProviderRelay.mjs` forwards same-origin, loopback-only JSON requests through the Vite process to the configured provider. It does not use a Sakelar relay, save credentials, forward cookies or follow redirects. It enforces request size and timeout limits and limits destination paths to models/chat completions. Vite production builds omit this transport; a static web deployment requires provider CORS or a future explicitly configured native/self-hosted transport. No cloud/backend integration or packaging is included.

`npm run test:providers` covers fragmented SSE, JSON fallback, configured model/auth/effort payloads, safe errors and real local HTTP relay security/forwarding. Additional DOM checks cover provider-derived model selection, streaming/history, retry, stop, navigation cancellation and existing setup/navigation regressions. A public unauthenticated probe confirmed the Sakelar endpoint's OPTIONS preflight returns 401 without CORS headers; the local relay reaches that provider and preserves its unauthenticated 401. A successful paid request with the user's actual key has not been verified.

Production build and read-only server-render smoke checks cover both home variants, disabled classic routing, Add menu, navigation pin labels and user-turn markers. Browser visual QA was blocked by the browser origin permission gate. Pixel identity and exact animation timing are not established. Native window controls are decorative. Official SDK icons do not guarantee that every symbol matches the current ChatGPT desktop application.
