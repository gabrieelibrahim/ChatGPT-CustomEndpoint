# ChatGPT-CustomEndpoint

An independent interface study based on supplied mobile screenshots. This is not an official OpenAI application or the original ChatGPT source code.

## Current UI
The default route uses the newer desktop ChatGPT/Codex presentation. The classic Personal interface is retained but disabled. See [DESKTOP.md](DESKTOP.md) for active routes, local interactions and limitations. Desktop now has a Custom Endpoint settings page for provider profiles and optional model discovery; its composer still uses demo replies. The legacy mobile API client at `?mobile=1` remains separate.

## Custom Endpoint settings

Open **Profile → Custom Endpoint** (or Settings), **More → Custom Endpoint**, or search for Custom Endpoint with Ctrl+K. Add a provider name, Base URL, API key and model ID. Multiple profiles can be saved, edited, selected and deleted. Only the OpenAI-compatible protocol is supported here. HTTPS and local HTTP loopback URLs are accepted; no provider is required or hardcoded.

Profile metadata is stored in localStorage; API keys stay in sessionStorage for the current tab session. Keys are masked and excluded from profile serialization. **Tes & ambil model** explicitly requests the configured provider's `/models` endpoint directly, without a proxy, cookies or redirects. Providers must allow browser CORS; model IDs can be entered manually when discovery is unsupported. Saving or selecting a profile does not yet connect the desktop composer.

## Stack
React 19, TypeScript, Vite 6, Tailwind CSS 4. All icons are inline SVG; no CDN or runtime asset dependency.

## Development
```sh
npm install
npm run dev
```

## Production
```sh
npm run build
npm run preview
```
Deploy `dist/` to any static hosting service. `.openai/hosting.json` is hosting-specific and can be omitted outside Sites.

## Structure
- `src/App.tsx`: application state, chat lifecycle, menus, API configuration.
- `src/components/Header.tsx`: fixed-center Chat/Work tabs and right-hand temporary-chat button.
- `src/components/Composer.tsx`: prompt field and controls.
- `src/components/Sidebar.tsx`: search, navigation, local history.
- `src/components/MessageList.tsx`: reference response and message actions.
- `src/components/Icon.tsx`: replaceable typed SVG symbols.
- `src/components/ApiSettings.tsx`: session-scoped endpoint configuration.
- `src/hooks/useKeyboard.ts`: mobile visual viewport detection.
- `src/lib/chat.ts`: message types, safe storage parsing, API client.
- `src/desktop/EndpointSettings.tsx`: desktop provider profile editor and model discovery UI.
- `src/lib/endpointProfiles.ts`: profile validation/storage, session credentials and OpenAI-compatible model discovery.
- `src/styles.css`: Tailwind import plus reference-specific style rules. Components also use Tailwind utilities. Remaining rules can migrate gradually without changing state logic.

## Behavior
New chat uses a capsule composer while the keyboard is closed, expanding into a rounded rectangle when the mobile visual viewport shrinks during input focus. Existing conversations retain the compact composer. No fake keyboard is rendered.

Without API configuration, replies use an explicitly labeled demo mode. Configure a compatible HTTPS base URL (including `/v1` when required), model, and key under the three-dot menu. The browser calls `/chat/completions`; the endpoint must allow CORS. API keys stay in sessionStorage; messages stay in localStorage. Temporary chat is not written to history.

The attachment picker is a UI demonstration and does not upload files. Navigation sections are previews. Speech input and output depend on browser support.

## Icon provenance
The shared desktop icon wrapper uses selected MIT-licensed SVGs from [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui), with source revision and notices under `src/components/openai-icons/`. Reference-specific symbols and third-party marks remain local. This does not imply official affiliation or pixel identity with the current ChatGPT application.

## Verification
`npm run build` type-checks the React/TypeScript source and builds the production bundle. Native Android keyboard behavior still requires device verification. UI is based on screenshots and is not claimed to be pixel-perfect.

## Revision 0.4 — conversation menu and sidebar
The top-right menu follows the supplied reference: share, pin/unpin, add to project, uploaded files, search in chat, add to home screen, archive, and delete. Pinning, project membership, archiving, and deletion persist on this device. Archived conversations are available under the sidebar's API/settings button. Search highlights local message matches. Deleting requires a confirmation in the app.

`ConversationMenu.tsx` handles the popover, click-away dismissal, Escape, and menu keyboard focus. The sidebar uses a scrollable content area and separate footer; pinned rows explicitly use flex to prevent the CSS reset from wrapping their icon above the title.

The uploaded-file menu accurately shows that server uploads are not yet implemented. Adding to the home screen shows browser-specific instructions. No server-side account or cross-device sync is included.
