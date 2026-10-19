# SuperGPT: tools inside the main conversation

Agents SDK runs behind the existing mobile/desktop composer, using the selected
Custom Endpoint, model and key. The original shell owns navigation, attachments,
response actions, theme and device history. There is no separate Agents/ChatKit
workspace, iframe, CDN script or domain-key setup.

## ChatKit's role

The official ChatKit packages expose a complete embedded chat, not an isolated
message-only renderer. This integration uses its typed widget schemas for inline
cards and actions. Markdown, code, math, tables and links use the installed
OpenAI Apps SDK Markdown renderer. This is not the ChatKit runtime or native
ChatGPT Android source.

Pinned: `@openai/agents@0.20.0`, `@openai/chatkit@1.9.0` (types only),
`@openai/apps-sdk-ui@0.2.2`, `openai@7.38.0`, `zod@4.3.6`.

## Preview and configuration

```sh
npm ci
npm run dev:mobile
```

Open `http://127.0.0.1:1420/?mobile=1`, configure Custom Endpoint and send through
the normal composer. Vite includes the Node SDK backend. In mobile Settings /
Fitur AI (desktop Settings / General / Fitur AI), select Chat Completions or
Responses and enable web/MCP. The model must support function calling.
Unsupported requests fail visibly; the app never substitutes a mock or provider.
Turning tools off uses the original direct chat transport.

For synthetic UI testing only, `node server/sdk/mock.mjs` supplies a labelled mock
endpoint at `http://127.0.0.1:19092/v1`, model `reasoning-test-model`. Requests with
`checklist` or `catatan` exercise inline cards and approvals. This is not AI inference.

## Capabilities in the main chat

| Feature | Behavior / dependency |
| --- | --- |
| Function tools | Arithmetic, time, checklist/copy cards, approved note save/read |
| MCP | Enabled HTTP profiles from Plugin; real SDK discovery and exact-call approval inside the reply |
| Web search | Exa MCP function tool usable with function-calling Chat Completions models |
| Provider web search | Optional hosted web-search tool for supported Responses endpoints |
| Sources | Actual tool/provider URLs in links and source list; unsafe URLs discarded |
| Clarification | Inline question/choice pauses and resumes the same request |
| Handoffs | Analis / Peneliti dokumen inside the same conversation |
| Attachments | Device library resolves existing text/image inputs before the SDK call; no second attachment library |
| Existing controls | Stop/retry, copy/share, theme, keyboard and dictation keep the current shell |

Hosted image generation, Code Interpreter, vector stores and Realtime are not
activated automatically in this main route. They require provider capabilities
and separate configuration. Legacy protocol backend contracts remain, while its
alternate frontend has been removed. Existing desktop Codex execution and stdio
MCP stay in that runtime; main-chat MCP uses HTTP only.

Exa's public endpoint is `https://mcp.exa.ai/mcp` and has quotas. During the live
check on 19 October 2026 it returned its free-rate-limit message: a successful
live external search is **not** claimed. Configure private `SUPERGPT_WEB_MCP_URL`
on the server for an authenticated Exa MCP URL, or choose provider Responses
search. Keep keys out of frontend code, logs and Git. Only the public query is
sent by the web tool; results are untrusted evidence. Local tests exercise the
real SDK/MCP transport using synthetic search evidence and citations.

## APK and deployed server

Node SDK is not bundled inside the APK. Configure a server you operate under
Fitur AI / Server pemrosesan AI. Without one packaged/static clients use direct
endpoint chat and report that web/MCP need an AI server. For a local production
web test, run `npm run build`, `npm run sdk:server`, open port 1430 and set that
origin as the AI server in Settings. Web asset building does not compile an APK.

Behind your HTTPS reverse proxy, configure the server environment:

```text
SUPERGPT_PUBLIC_ORIGIN=https://your-server.example
SUPERGPT_ALLOWED_ORIGINS=https://your-app.example,https://tauri.localhost
SUPERGPT_SERVER_TOKEN=<private random access token>
SUPERGPT_SDK_DATA=<persistent private directory>
SUPERGPT_SDK_PORT=1430
SUPERGPT_MCP_CONFIG=<optional private HTTP MCP JSON path>
SUPERGPT_WEB_MCP_URL=<optional private Exa MCP URL>
```

Remote access requires public origin, explicit allowed origins and server token.
The proxy preserves external Host and must not buffer SSE. This is a personal
server: add per-user authentication before multi-tenant hosting. Copy
`server/sdk/mcp.example.json` privately for MCP auth headers. Plugin profiles
accept HTTP MCP URLs without URL credentials; no Codex config is imported or
changed. The server token is session-only on the client.

## Storage and lifecycle

Main history stays in the device store. The server holds transient runs and
pending approvals (15-minute inactivity limit); completed runs are removed.
Only explicitly approved notes persist under ignored `.supergpt-sdk/`.
Temporary-chat notes stay transient. Keys are in bounded memory-only server
sessions, tracing is disabled. Stop, page reset and connection loss cancel the
request. Pending main approvals do not survive app/server closure; stale buttons
are disabled. Four concurrent requests, twelve SDK turns and timeouts bound
execution. A durable job queue is needed to survive process closure.

The old `/chatkit` protocol history stays on disk if previously used; this change
neither migrates nor deletes it. Device history is not duplicated.

## Checks and rollback

`npm test` includes real SDK function/MCP round trips with synthetic providers,
main-chat history continuity, exact-call/owner checks, temporary notes, questions,
source parsing, client resume/cancel and key handling. `npm run build` validates
TypeScript, web assets and CSS order. These do not prove paid-provider inference,
native APK, microphone or pixel parity.

Checkpoint: `85d9526`, tag `before-chatkit-integration`. Preserve later work before
restoring; the checkpoint excludes private server data and binaries.

Official references: [Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk),
[custom ChatKit](https://developers.openai.com/api/docs/guides/custom-chatkit),
[tools](https://developers.openai.com/api/docs/guides/tools),
[Exa MCP](https://exa.ai/docs/get-started/exa-mcp).
