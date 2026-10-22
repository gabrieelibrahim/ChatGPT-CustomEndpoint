# Google Workspace OAuth source verification

2026-10-22, Asia/Jakarta. Starting commit `78b8e47`.

## Source behavior

- `shared/googleWorkspace.json` defines all nine currently documented official Google Workspace MCP services and per-service read/write scopes. Source catalog entries are OAuth integrations rather than custom-server placeholders. Google Tasks/Photos/YouTube and other products outside this list are not implemented by this change.
- `src/mcp/googleAuth.ts` implements Google-specific authorization: Google Identity for Android and an optional OAuth server for web/alternative native use. Google tokens are never sent to an edited/unrecognized resource URL. Account binding is checked on every subsequent authorization/access request. Partial scope grants fail visibly; broader already-granted equivalent scopes are recognized.
- Native login uses Google's consent UI and returns a verified account email from a fixed HTTPS userinfo request. Silent refresh is bound to the saved account and does not launch consent UI. Only account/service/scope binding is stored in the Android encrypted MCP vault; native access tokens are retrieved when needed. See the native design document for lifecycle/cancellation and dependencies.
- Broker login keeps Google client secret and refresh tokens on the application server. Server PKCE/state protect the Google callback; separate application proof protects result polling. Connection capabilities, service identity and account binding protect subsequent access requests. Token records are AES-256-GCM encrypted and survive server restart with the same configured encryption key.
- Broker routes include config readiness, start/callback/result/access/cancel/disconnect. Remote start/result/cancel require the configured server token. Browser origins and request hosts are checked, body sizes are bounded, redirects are refused on token requests, and errors do not return Google raw bodies/secrets. Callback redirects to a clean completion URL without returning tokens in URLs.
- UI exposes per-service account login and requested read or read/write permissions. Official Google URLs are fixed for catalog entries. Advanced settings configure the optional OAuth server separately from the model endpoint. The app does not ask end users for a Google client secret.
- Plugin activation requires successful account authorization and actual MCP initialization/tool discovery. Direct tools and SDK use Google tokens in the existing main chat. Every tool invocation retains the existing exact approval flow.
- Maximum active MCP profiles is now 16 instead of 8, consistently through UI/profile resolution/server SDK, so all nine Google services can coexist. Direct model tool count still follows its existing supported limit.
- Removing a Google connection clears local binding and attempts server credential deletion. Sign-out cancels native requests, clears Google connections, then clears remaining MCP credentials. It does not sign out the device account or revoke Google project-wide combined consent.

## REA investigation of original ChatGPT

The inspected original target was installed ChatGPT desktop package `OpenAI.Codex_26.1016.6573.0_x64__2p2nqsd0c76g0`, `app/resources/app.asar`, SHA-256 `6f56542b508eea5b6e4d03e852dcd90afc2578aac7125baa3f25ebe85ebc7e25`.

REA archive inventory observed eight companion native-file integrity contradictions and marked those members observed-untrusted. A broad ASAR JavaScript analysis was stopped; its session restarted. To narrow the question, ordinary shell extraction copied six selected JavaScript entries and verified each against the ASAR-declared SHA-256. REA then parsed the extracted inert JavaScript without executing it. The original ChatGPT app and configuration were not modified.

- Evidence `ev_afd8977e2dfd1eb9f0abd6208f4da4cb79f3c0843e4e6def6cfaa84b56491147`: five selected callback/connection/Google modules, 37,146 text bytes, 9,875 AST nodes; remaining dependencies outside the selected subset are unknown. Static callback syntax includes pending connection/account context and Google scope mismatch recovery.
- Evidence `ev_413d96a508ab5a31af083c866244dd939af12bc47df78cba644ede86bc97a0e9`: selected connection-modal module, 131,750 text bytes and 31,457 AST nodes. The packaged modal includes Google permission guidance and handling for incomplete consent. This supports providing explicit permission failure/reconnect feedback; it does not establish private backend implementation.
- Selected extraction, hashes, summaries and complete exported REA records are in the current session `work/chatgpt-google-reference`, `work/chatgpt-google-rea-summary.json`, and `work/chatgpt-google-rea-evidence.json` respectively. The exported bundle is large and is not a release artifact.

**No CDP debugger endpoint was available. No original ChatGPT login UI was clicked or recorded.** This is static shipped-artifact evidence. It does not prove a live Google connection, network protocol, private backend, screen parity or equivalent runtime behavior. No OpenAI OAuth client ID, token or private credential was copied for SuperGPT.

## Verification and remaining work

JS/TypeScript tests use simulated native bridges and mocked Google/server responses. They exercise account/scopes validation, partial consent, cancellation and late results, silent account-bound access, fixed resource binding, all nine profiles, source UI activation only after MCP discovery, broker proof/state, encrypted persistence and refresh behavior. Existing conversation fixtures were extended to load the shared JSON catalog.

Final `npm test`: **267 passed, 0 failed**. Final `node node_modules/typescript/bin/tsc --noEmit`: passed without artifact output. `git diff --check`: passed. The intermediate full suite exposed two existing fixture loaders that could not load the newly shared JSON catalog; they now resolve JSON and the original history/reasoning checks pass. Final log: `C:\Users\LAPTOP WA\Documents\Codex\2026-10-22\baca-playbook-c-users-laptop-wa\work\google-workspace-final-tests.log`.

No production frontend build, Gradle dependency resolution, Kotlin/Rust compile or APK packaging has been run. Native sources and real Google Play services behavior remain unverified. No server has been deployed and no real Google account has been authorized.

The Google project/client registration, Developer Preview membership, API/MCP activation, AI agent client setting, consent/scope verification and Workspace admin access are prerequisites. Android client support for the AI agent setting must be verified on the real project; if unavailable, the documented server-client path is the alternative. Instructions include production package and certificate SHA-1 read from the existing signed APK without modifying signing credentials.

Access tokens are obtained at the start of a chat run. Very long runs can outlive provider token validity and may require reconnect/retry by the user; tool calls are not automatically replayed. Choosing read permissions does not revoke broader historical Google grants. Actual available tools follow the server's `tools/list` and account permissions, not catalog descriptions.

## Primary references

- [Google Workspace MCP endpoints, scopes and configuration](https://developers.google.com/workspace/guides/configure-mcp-servers)
- [Android authorization](https://developer.android.com/identity/authorization)
- [Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Android loopback restrictions](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration)
- [Official ChatGPT plugin documentation](https://learn.chatgpt.com/docs/plugins)
