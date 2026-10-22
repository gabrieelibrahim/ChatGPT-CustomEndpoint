# Google API MCP checkpoint

2026-10-22. User approved replacing Google's Developer Preview MCP dependency with a SuperGPT MCP adapter over public Google REST APIs and per-user OAuth. No compile/build/release authorized in this step.

## Source changes

- `shared/googleApiMcp.mjs` implements initialize/tools/list/tools/call, fixed REST routes for nine services, strict top-level argument schemas and read/write tool selection. It runs in memory; it does not listen on a public port. `googleApiMcpFetch` adapts the same engine to the server SDK's MCP client.
- The reserved `.invalid` URLs are internal resource identities. `httpClient.ts` intercepts them before any network request. `server/sdk/agents.mjs` intercepts them through an in-memory fetch transport. Only fixed Google hosts/routes receive OAuth bearer tokens.
- Mobile plugin setup forwards the chosen write permission, hides the internal URL, authorizes the user, probes one real read endpoint and lists implemented tools before saving an active profile. It never seeds fake data.
- `mainMcpProfiles`, SDK session validation and configured server MCP profiles preserve `googleWrite`. Existing exact per-call approval remains in direct and SDK runtimes. Server mode passes access tokens to the configured AI server; device mode calls Google directly.
- Existing preview resources require explicit reconnect. Old preview URLs are blocked on runtime clients. Existing grants are not revoked automatically; requesting read mode only hides local write tools.
- OAuth scopes were narrowed to implemented operations. Native Android, TypeScript and broker recognize Google's canonical Classroom read scope. Existing Cloud Data Access may contain a superset without causing the app to request every listed scope.
- API response: 2 MB streamed limit; args: 64 KB; per request: 30 seconds; no API retries. SDK write failures are MCP isError results to avoid transport retry. Network/timeout/cancellation may leave a write accepted by Google: inspect before repeating.

## Checks and limits

TypeScript noEmit, JavaScript syntax and diff checks are the checks for this change. No tests were added or run. No account login, network operation with user credentials, Gradle/Kotlin build, SDK runtime integration run or release was performed. Historical tests in older checkpoints apply to their older source only.

Ordinary public APIs do not require Workspace Developer Preview. Public OAuth distribution still requires the appropriate consent branding, audience and Google verification; current owner project is Testing. No claim is made that all APIs work for every personal account. Chat/Classroom and admin/role restrictions remain. Web/iOS broker still requires an actual HTTPS deployment and Web OAuth client; iOS native compilation still requires Mac/Xcode.

See [registration and capability table](../google-workspace-registration.md) for supported operations and setup.
