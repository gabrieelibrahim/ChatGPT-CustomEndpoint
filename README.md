# ChatGPT-CustomEndpoint

An independent interface study based on supplied mobile screenshots. This is not an official OpenAI application or the original ChatGPT source code.

## Current UI
The default route uses the newer desktop ChatGPT/Codex presentation. The classic Personal interface is retained but disabled. See [DESKTOP.md](DESKTOP.md) for active routes, local interactions and limitations. Desktop text conversations use the selected custom endpoint and model, with streaming, stop, retry and local history. No built-in model list or demo reply is used by the desktop composer. The legacy mobile API client at `?mobile=1` remains separate.

## First launch and profile

The desktop experience first asks for a local display name, then offers optional custom endpoint setup. **Lewati endpoint untuk sekarang** starts the UI without changing existing provider profiles or session keys. The name and initials appear in the profile menu; click the name there to edit it. This is a local profile, not an authenticated account. Setup is shared frontend behavior; APK/EXE packaging is not included.

The rail's **More** menu opens on hover and remains open while moving into it; click/touch and keyboard activation remain available. A token recommendation in setup and endpoint settings links to [Sakelar AI](https://sakelar.web.id). Other compatible providers remain available, and setup sends no automatic provider requests.

## Custom Endpoint settings

Open **Profile → Custom Endpoint** (or Settings), **More → Custom Endpoint**, or search for Custom Endpoint with Ctrl+K. Add a provider name, Base URL, API key and model ID. Multiple profiles can be saved, edited, selected and deleted. Only the OpenAI-compatible protocol is supported here. HTTPS and local HTTP loopback URLs are accepted; no provider is required or hardcoded.

Profile metadata is stored in localStorage; API keys stay in sessionStorage for the current tab session. Keys are masked and excluded from profile serialization. **Tes & ambil model** explicitly requests the configured provider's `/models` endpoint; discovered models can be searched and selected, and IDs can also be entered manually. The composer model menu uses saved provider models. Effort is sent only if **Kirim reasoning_effort** is explicitly enabled for a compatible model; supported values depend on the provider. Text attachments and PNG/JPEG/WebP/GIF images can be sent explicitly with Send. Images require a vision-capable model. Files persist in the local IndexedDB library; unsupported formats fail clearly. See [FEATURE-STATUS.md](FEATURE-STATUS.md) for bounds and feature status.

During `npm run dev` on localhost, a development-only same-origin relay in the Vite process forwards requests from this computer to the configured provider. This handles providers that reject browser CORS preflight, without routing through Sakelar or another hosted proxy. It accepts only same-origin JSON POST requests from loopback, allows only `/models` and `/chat/completions`, refuses redirects and never logs or saves payloads/credentials. **Production web builds call providers directly and still require provider CORS support.** The relay is not a production backend or native packaging solution.

## Local Codex agent (development)

The Codex experience can use an installed **Codex CLI/app-server** through a local bridge, alongside the existing provider chat client. No Codex binary is bundled. On Windows the bridge discovers the installed OpenAI/Codex runtime, then falls back to PATH. Set `CODEX_RUNTIME_PATH` on the development server for another installation.

1. Run `npm run dev` and select the **Codex** experience.
2. Use **Choose project** for a native folder picker or validated absolute path. **This computer** shows the actual execution host; **Agent settings** configures runtime access.
3. Choose read-only or workspace editing in Agent settings.
4. Select an endpoint/model in the usual provider menu. Confirm that this provider supports **Responses API with tool calling**; Chat Completions compatibility alone is insufficient.
5. Enable the local agent and send a request. Command output, file-change items, turn diffs, plan updates and permission requests appear below the answer. Stop interrupts the native turn. Plan mode uses a read-only turn policy and disables permission escalation.

Keys are passed to the private runtime process via its environment, never CLI arguments or persistent config. A temporary isolated CODEX_HOME prevents importing the user's main Codex account, plugins or settings. Sessions are ephemeral, closed when starting/opening another chat, and idle sessions expire after 15 minutes. Local text history remains in this client; reopening a conversation starts a fresh native thread with that text as context, without reconstructing old tool state. Only the workspace path/access preference is persisted; enabling agent execution and confirming Responses support must be repeated after reload.

This bridge runs only in localhost development. Production static hosting cannot execute local tools. Native packaging, browser/desktop computer-use adapters, hosted Codex services, OAuth-authenticated MCP configuration and full native thread restoration are not implemented. Plugins now stores independent HTTP/stdio MCP profiles that are passed to the next private runtime session. Unknown native interaction requests fail explicitly instead of being approved. It is not full feature parity with the official application. See [AGENT-RUNTIME.md](AGENT-RUNTIME.md) for evidence and verification.

## Local client features

The desktop now uses real local data for project selection, file browsing/library, conversation rename/pin/archive/restore/delete/fork, project membership, Markdown/JSON export and chat-backup import. Pages, instructions, saved sites and reminders support local CRUD; reminders only fire while the application is open and require user-triggered Run. Plugins configures actual MCP servers rather than displaying a fictional installed catalog. New installs have no seeded demonstration conversations. Existing saved conversations are preserved.

See [FEATURE-STATUS.md](FEATURE-STATUS.md) for implemented behavior, provider requirements and remaining external integrations.

## Stack
React 19, TypeScript, Vite 6, Tailwind CSS 4. All icons are inline SVG; no CDN or runtime asset dependency.

## Development
```sh
npm install
npm run dev
npm run test:providers
npm run test:agent
npm run test:workspace
npm run test:files
```

`npm test` runs all 24 transport/workspace/file tests. Optional `npm run test:runtime` requires an installed Codex runtime and executes a harmless local command and MCP echo against a fake-key local gateway; it uses no external inference.

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

## Legacy mobile behavior (`?mobile=1`)
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
