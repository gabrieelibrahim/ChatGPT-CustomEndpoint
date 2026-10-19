# SuperGPT · Agents SDK + ChatKit

Checkpoint before integration: commit `85d9526`, annotated tag
`before-chatkit-integration`. Existing mobile/desktop chat remains available;
choose **Pengaturan → ChatKit & Agents** on mobile or **Settings → General →
Open ChatKit** on desktop. This integration adds a working alternative chat
surface, not the native ChatGPT Android source or a claim of pixel parity.

Pinned packages: `@openai/agents@0.20.0`, `@openai/chatkit-react@1.6.1`,
`@openai/chatkit@1.9.0` (transitive types), `openai@7.38.0`, `zod@4.3.6`.
ChatKit's actual Web Component and iframe load from the official OpenAI CDN.
Its deployed runtime can change independently of the npm lockfile.

## Run and preview

```sh
npm ci
npm run dev:mobile
```

Open `http://127.0.0.1:1420/?mobile=1&chatkit=1`, choose an existing custom
endpoint and enable only the features its API supports. Vite includes the
Agents/ChatKit service; no second backend command is needed in development.
No model/provider is substituted. Selected models must be in the configured
profile's model list. The original custom endpoint key/vault is reused.

For a production web bundle and a separate local server:

```sh
npm run build
npm run sdk:server
```

Open `http://127.0.0.1:1430/?mobile=1&chatkit=1`. Node 22+ is required. The
server binds to loopback. It is not bundled as a Node runtime inside the APK.
For deterministic UI testing only, `node server/sdk/mock.mjs` serves a clearly
labelled synthetic provider on port 19092. It never calls an external model.

## Feature coverage and actual dependencies

| Feature | Integration | Required service / verification boundary |
| --- | --- | --- |
| Streaming, Markdown/code, loading, near-bottom auto-scroll | Official ChatKit component + real Agents Runner | Browser preview and local mock; no native 1:1 claim |
| Theme, Roboto font, SuperGPT branding, Indonesian locale | ChatKit options mapped to saved SuperGPT settings | CDN/font/network access |
| Threads, paginated history, rename/delete | Custom ChatKit protocol + atomic server store | Persistent server disk; browser-tested and protocol-tested |
| Copy old chats | Explicit non-destructive, idempotent import | Up to 100 text histories per import; old binary files stay in device library |
| Model/tool selectors | Model reaches actual provider request; specialist selection informs orchestration | Endpoint model list and function-calling model |
| Feedback and retry | Feedback persisted; retry rewinds to the user-message checkpoint | Protocol and browser verification |
| Function tools | Arithmetic, real time, search uploaded text, checklist cards, approved note save and note read | Tools enabled; no arbitrary shell execution |
| Handoffs | SuperGPT → Analis / Peneliti dokumen | Real SDK handoff tested with synthetic provider |
| Guardrails and bounded execution | Input/output limits, 12 turns, 4 active turns, 5-minute ceiling | Limits are resource policies, not a universal content safety classifier |
| Human approval / clarification | SDK RunState checkpoints + approval widgets / structured-input questions | Exact-call approval once; duplicate/stale actions rejected |
| MCP | Real Streamable HTTP SDK client; every tool invocation requires approval | Explicit server config/auth; mock MCP transport tested |
| Text/JSON/CSV/Markdown/HTML files | Two-phase upload + UTF-8 context / search tool | 10 MB storage, 128 KB per text document sent to model |
| Images | Preview/upload + `input_image` | Enable vision only if provider accepts image inputs |
| PDF | `input_file` | Responses endpoint with PDF support; contract wired, paid provider not tested |
| Real source annotations / file entities | Provider citations or actual search hits; scoped `@` file references | Sources must exist; no invented citations |
| Widgets, actions, commands and client tools | Checklist/copy, approvals, summary command, display-preference client tool | Schema and transport tests; official UI |
| Hosted web/file search, Code Interpreter, image generation | Official SDK tools; PNG result persisted/rendered, real citation metadata mapped | Responses endpoint, permissions/billing, existing vector stores; synthetic Responses test |
| API dictation | ChatKit recording → server `/audio/transcriptions` | Explicit transcription model; synthetic contract test only, no mic capture during tests |
| Realtime voice | RealtimeAgent + RealtimeSession + WebRTC, mute/end/cleanup | Explicit Realtime model + `/realtime/client_secrets` + `/realtime/calls`; ephemeral `ek_` credential; real device/audio still needs testing |
| Diagnostics / token usage | Local activity and real reported token counts | Unknown usage is omitted; OpenAI trace export disabled |

Video/Office ingestion, computer-use tools, sandbox/shell executors, OAuth MCP,
hosted Agent Builder workflow sessions, and OpenAI trace export are not enabled
by this change. The existing desktop Codex executor remains separate. Those
SDK/platform integrations need their own execution/authentication services;
installing a package does not supply them. The UI does not offer unsupported
binary formats as if the model could read them.

## Android / separate server

Use **Server SuperGPT** for the HTTPS origin of a server you operate, plus its
access token and a ChatKit domain key registered for the application's origin.
Localhost development skips domain verification; production does not. Follow
the [official custom ChatKit guide](https://developers.openai.com/api/docs/guides/custom-chatkit).

Behind a TLS reverse proxy, configure the server's environment (not frontend
build variables) with:

```text
SUPERGPT_PUBLIC_ORIGIN=https://your-server.example
SUPERGPT_ALLOWED_ORIGINS=https://your-app.example,https://tauri.localhost
SUPERGPT_SERVER_TOKEN=<private random access token>
SUPERGPT_SDK_DATA=<persistent private directory>
SUPERGPT_SDK_PORT=1430
SUPERGPT_MCP_CONFIG=<absolute path to private MCP JSON, optional>
```

Remote mode requires public origin, explicit allowed origins and the access
token. The proxy must preserve the external Host for API routing and allow SSE
without buffering. This is a personal-server integration, not multi-tenant
public hosting: add per-user authentication/authorization before exposing it
to unrelated users. The backend access token is memory-only in the client.
Do not put it, provider keys, or private MCP headers in Git or `VITE_*` values.

Copy `server/sdk/mcp.example.json` to a private `*.local` file, supply real URLs
and any authentication headers there, and set the environment path before
starting Vite/the standalone server. No servers from the user's Codex config
are imported or started automatically. Only HTTP MCP is connected here; the
desktop executor's existing stdio configuration remains separate.

Android CSP permits the exact ChatKit CDN script/frame and configured HTTPS
server connections; native bridge origin allowlists remain unchanged. APK,
Android microphone/camera/keyboard, domain allowlisting for the final native
origin, and device WebRTC have **not** been validated by a new native build.

## Storage, lifecycle and rollback

`.supergpt-sdk/` is ignored by Git. It stores prompts, answers, uploads, feedback,
approved notes, tool history and pending SDK state on the selected server's
disk. It does not persist provider API keys. Keys remain in a bounded server
session for 30 minutes of inactivity, renewed from the existing client vault
when needed. API requests use opaque session tokens; external redirects and
credential forwarding outside the selected SDK origin are rejected.

This JSON store supports one server process: atomic rename, per-thread model
lock, 1,000 threads, 1,000 items/thread, 64 MB serialized text/owner, 200 files,
10 MB/file. Use a database before running multiple workers. Back up this folder
privately, separately from Git. ChatKit thread deletion removes attached files.
The original local histories are never automatically deleted or migrated.

Pending tool approvals can resume after server restart using serialized SDK
state, provided provider/model/options and MCP identities are unchanged.
Thread contents persist across restart; an active model request does not.
Stop/connection loss cancels the current request. A durable job queue is still
required for work that must survive app/process closure or server restart.

Rollback: preserve any later work first, restore tracked source from
`before-chatkit-integration`, then `npm ci`. The checkpoint does not include
private data, ignored APK/EXE files, or SDK-server histories. Merely use the
back button to return to the original chat UI without changing source.

## Validation

`npm run test:sdk` exercises the real installed Agents SDK against local HTTP
fixtures: streaming, function result round-trip, model selection, approval and
duplicate rejection, handoff, widgets, clarification resume, durable thread
operations, two-phase uploads, feedback/retry, client tools, error redaction,
owner/session isolation, MCP transport + approval, transcription/Realtime
contracts, Responses hosted tools/citations/generated PNG, and client key
handling/token renewal. These are integration tests with synthetic providers,
not evidence of paid-provider or physical microphone success.

`npm test` covers the older application plus SDK integration. `npm run build`
checks TypeScript, the web production bundle, and the emitted SDK CSS layer
order. It does not compile an APK. The existing sidebar/theme test fixtures
were updated for already-present CSS imports, browser globals and state
propagation; production sidebar/theme behavior was not changed for them.

Official sources:
[Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk),
[custom ChatKit](https://developers.openai.com/api/docs/guides/custom-chatkit),
[ChatKit options](https://developers.openai.com/api/docs/guides/chatkit-themes),
[voice agents](https://developers.openai.com/api/docs/guides/voice-agents).
