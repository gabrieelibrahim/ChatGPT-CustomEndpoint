# Agents SDK and ChatKit assessment — 19 October 2026

Study only: neither SDK is installed or integrated by this change. The separate
settings navigation repair is authorized and implemented independently.

## Sources inspected

- [Agents SDK repository](https://github.com/openai/openai-agents-js), commit
  `9687b544c8c873080e6ff7e7d294c0b353cd9ab6`: README, model/provider guide.
- [ChatKit repository](https://github.com/openai/chatkit-js), commit
  `22613848a656077a408788f028c7727e38d10449`: README, package manifest,
  `types/index.d.ts`, React entrypoint and hook.
- [Agents models/providers](https://developers.openai.com/api/docs/guides/agents/models),
  [voice agents](https://developers.openai.com/api/docs/guides/voice-agents),
  [ChatKit custom backend](https://developers.openai.com/api/docs/guides/custom-chatkit),
  [ChatKit appearance/options](https://developers.openai.com/api/docs/guides/chatkit-themes).

## Roles and fit

Agents SDK runs the model/tool loop and can coordinate specialist agents. It
does not provide an Android settings screen or the ChatGPT mobile UI. The
documented server runtimes include Node 22+, Deno and Bun. SuperGPT's Android
WebView is not a Node runtime; server orchestration needs an actual backend.
Browser Realtime uses a separate transport and short-lived credentials.

ChatKit supplies an embedded chat interface with React bindings. The inspected
`@openai/chatkit` package publishes types; the README loads the actual web
component from OpenAI's CDN. Its options refer to a chat iframe. This repository
does not contain the complete native ChatGPT Android UI implementation. Copying
its types/bindings cannot reproduce native keyboard/composer/drawer animations.
The hosted component's loading/network/CSP and Android microphone behavior need
a separate preview before replacing the current mobile chat surface.

## Candidate capabilities

| Capability | Source | What still needs implementation |
| --- | --- | --- |
| Streamed replies and managed thread UI | ChatKit | ChatKit-compatible event stream and storage; map/import current local history |
| Theme, typography, placeholder, model/tool selectors | ChatKit options | Apply approved branding; model selection must reach actual provider requests |
| Rename/delete history, response feedback and retry | ChatKit options | Server handlers and durable thread ownership/storage |
| Rich cards, lists, forms and buttons in replies | ChatKit widgets/actions | Agent emits widgets; client/server action handlers execute actions |
| Images and document attachments | ChatKit | Upload/file store, access control and previews; provider must accept the input format |
| Source annotations and entity mentions | ChatKit | Retrieval/search backend must return real source metadata and entity records |
| Dictation UI | ChatKit composer options | Transcription service, microphone permissions and native WebView verification |
| Function tools and MCP | Agents SDK | Implement/connect actual tools and required authentication; endpoint supports tool calls |
| Multi-step tasks and specialist handoffs | Agents SDK | Runner, session state, execution environment and app-visible progress |
| Validation, approval pauses and diagnostics | Agents SDK | App policies and approval UI; configure tracing explicitly before export |
| Two-way Realtime voice | Agents SDK Realtime | Audio-capable endpoint, supported WebRTC/WebSocket protocol, session credentials and device audio integration |
| Tasks that continue while phone app is closed | Backend architecture | Persistent worker/job queue and database; SDK installation alone does not provide this |

## Custom endpoint compatibility

The inspected provider guide supports `OpenAIProvider({ baseURL, apiKey,
useResponses: false })` for the Chat Completions path, or a custom `ModelProvider`
adapter. This can preserve Sakelar AI and other OpenAI-compatible endpoints,
but it does not add unsupported provider features. Responses-only tools and
Realtime voice cannot be enabled merely by changing a base URL.

ChatKit's custom `api.url` must serve the ChatKit protocol. It cannot point
directly at SuperGPT's existing `/v1/chat/completions` URL. The official custom
server guide uses a ChatKit Python server, thread/message storage and a file
store. It can connect to an agent service, including a JS Agents SDK backend,
through an adapter. Combining those services introduces backend work and
deployment costs; they are not bundled inside the APK by installing npm packages.

## Proposed adoption order, awaiting user review

1. Keep the current mobile shell while comparing a small ChatKit preview with
   the approved Android reference. Borrow feature contracts first; replacing
   the entire chat surface may change geometry and native interactions.
2. Add an Agents SDK server adapter behind existing custom endpoint profiles,
   starting with streamed text and one explicitly defined function tool.
3. Add durable threads, uploads, real tool progress, citations and widgets.
4. Add Realtime only after the selected endpoint's audio protocol is known.
5. Add background workers if tasks must survive app/process termination.

No SDK feature is claimed active in SuperGPT by this assessment. No inference
was sent, API key entered, hosted agent deployed, APK built or release published.
