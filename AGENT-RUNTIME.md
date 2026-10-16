# Local Codex agent integration

This is a functional local-development integration, not a full reconstruction of the official Codex desktop application.

## Evidence and choice

The prior REA assessment examined exact packaged manifest/preload bytes from the installed Windows app. Retained REA Evidence: `ev_63f9287b99f3e155c8112a7783c4e4b65f54ceee99eb5cbc0e4ed19577783e2c`. The extracted preload SHA-256 is `a3e622f8d80a83e58fb3cfcc640fa7e14e6461cccdae9ef7d7b0c821dde256b7`. It observes Electron context bridges and IPC. Separate static reading of the main bundle observes node-pty terminal creation, app-server command construction and computer-use runtime paths. These are static observations, not proof of end-to-end execution. Full-ASAR analysis encountered an unrelated unpacked native-member integrity mismatch and was not completed; the successful REA subset does not cover native internals.

The custom client integrates through the documented [Codex App Server protocol](https://learn.chatgpt.com/docs/app-server). It does not copy the official renderer, computer-use service, native binaries or private API routes. Installed-runtime `app-server --help` and `generate-json-schema` were checked before implementation. The installed schema identifies read-only/workspace-write sandbox values, turn input, command/file approval decisions, initialization and streaming methods.

## Implemented

| Capability | Behavior |
| --- | --- |
| Workspace | Absolute folder entered in Agent workspace; resolved and checked on this computer |
| Provider | Selected custom Base URL/model; Responses API required; no forced Sakelar/OpenAI account |
| Agent loop | Private installed app-server over newline JSON-RPC; initialize, thread/start and turn/start |
| Chat | Agent deltas/final messages streamed into existing composer/history flow |
| Terminal | Native commandExecution items and live output, with exit/status details |
| Files | Native fileChange items and turn diff shown as inert, expandable text |
| Plan | Native plan notifications displayed; existing Plan mode constrains the turn to read-only with no approval escalation |
| Approval | Command/file requests require explicit accept-once or decline from client; unsupported interaction requests return errors |
| Stop | turn/interrupt; handles cancellation while waiting for turn identity |
| Lifecycle | New/opened conversations close old sessions; idle sessions expire; server shutdown closes owned processes |

Workspace editing follows the runtime's sandbox, not a custom string-based command filter. A permission request can ask to go beyond normal access; review its command, reason, working directory and any supplied additional permissions. No permanent or session-wide approval is sent by this client. Plan-only turns are read-only; ordinary access preference is restored explicitly on the next turn.

## Transport and storage

`scripts/codexAgentBridge.mjs` is registered only while Vite serves development. Requests require loopback socket/Host, matching Origin, JSON POST, request size limits and an unguessable per-session capability. Browser clients cannot choose arbitrary executable paths or invoke arbitrary app-server RPC methods. Set `CODEX_RUNTIME_PATH` in the trusted server environment if discovery needs an override. There are at most four sessions. No key is accepted in URLs or logs; configured keys are redacted from streamed events.

Runtime home directories are newly created under the OS temp directory. The bridge does not read or modify the user's existing Codex config/account/plugins. The selected provider key is an environment variable; the private runtime's provider configuration contains only its variable name. Temporary homes are removed after closing owned processes, with bounded retries. An abnormal OS/process termination can leave temporary runtime files; this is not a permanent credential-vault implementation.

Browser session history and native agent state remain distinct. Native threads are ephemeral; reconnecting sends old local text as context, without claiming to restore original command state or tool history. The agent's active connection and Responses acknowledgment are not persisted. Native activity output/diffs remain in memory for the current session.

## Verification

- `npm run build`: TypeScript and production bundle.
- `npm run test:providers`: existing seven provider/relay tests.
- `npm run test:agent`: loopback/origin checks, folder/provider validation, RPC tool streaming, explicit approvals, unknown-request rejection, secret redaction, stop during turn creation and HTTP session isolation.
- Installed Windows runtime: real initialize and thread/start succeeded using an isolated home and fake key.
- Real runtime with a local mock Responses gateway: a deterministic function call requested a harmless PowerShell `Write-Output` command. Approval was explicitly accepted by the test, command exited 0, output streamed, and the runtime made the next model request and completed its answer. No external inference service or paid key was used.
- Existing desktop and navigation DOM regression checks passed after integration. A focused agent UI test also verified configuration/enablement, selected-provider forwarding, no implicit approval, accept-once interaction, output/diff rendering, streamed completion and session closure on a new chat.

The mock test establishes local executor wiring; it does not establish that every gateway/model accepts Responses, supports tool calls, or supports every reasoning level. File-change/diff notifications are protocol-tested; a paid real-model autonomous edit has not been verified. Browser visual timing remains unverified.

## Not implemented

Production/native app packaging; native mouse/keyboard/screenshot automation; browser automation adapter; importing the official app's account/tools/services; configuring MCP servers/plugins through this UI; interactive runtime questions; restoring/forking native threads across reloads; full native cloud/review/automation parity. MCP activity is rendered if a configured runtime emits it, but the isolated runtime deliberately imports no existing MCP configuration. Private component names found with REA are not treated as a public integration API.
