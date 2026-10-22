# Plugin OAuth implementation

Date: 2026-10-22 (Asia/Jakarta). Based on checkpoint `0904db4`.

## Implemented behavior

- Plugin connection settings offer OAuth browser login or public/bearer access. Existing OAuth catalog entries select OAuth by default; saved authentication overrides are preserved. Custom MCP URLs can also select OAuth. Catalog rows identify OAuth, public access, token requirements, and templates requiring a server.
- Discovery obtains an unauthenticated MCP resource challenge, validates protected resource metadata, discovers OAuth/OpenID metadata, checks issuer identity and PKCE S256, and refuses HTTPS-to-HTTP downgrades. No ambient cookies or authorization headers are forwarded during discovery.
- Public clients use dynamic registration with `token_endpoint_auth_method=none`, or an explicitly supplied preregistered Client ID. Authorization code exchange includes PKCE verifier, exact redirect URI and resource indicator. State, callback destination and duplicate callback parameters are checked. Provider errors never insert a connected plugin.
- A connection is advertised as enabled only after actual MCP initialization and tools discovery. Both direct main-chat tools and the optional SDK server path resolve the OAuth access token before connecting. Existing per-call tool approvals remain in place.
- Expiring tokens refresh before use, including refresh-token rotation and one refresh for concurrent requests. Rejected refreshes ask for a new login. Changed MCP URLs cannot receive old OAuth credentials. Deleted connections and sign-out invalidate pending credential writes.
- Android source adds an allowlisted top-level WebMessage bridge, a temporary random-port IPv4 loopback callback with random path/state, a system-browser login, and a separate AES-GCM Android Keystore vault. OAuth preferences are excluded from cloud backup/device transfer. Browser credentials remain in sessionStorage, separate from exported plugin configuration.
- Browser preview has a same-origin popup callback page and a loopback-only development OAuth relay. The relay validates request origin, refuses redirects/credential URLs, bounds responses and forwards no ambient authentication headers.
- Removing a connection deletes local OAuth credentials; sign-out clears all local plugin credentials. These actions do not claim provider-side token revocation.

## Verification

- OAuth integration fixtures exercise the full metadata/registration/authorization-code/PKCE/token flow using a local HTTP server and a simulated native bridge or browser popup. Cases cover wrong resource/issuer/state, missing PKCE, client-secret-only providers, missing registration, denied consent, invalid token type, refresh rotation/concurrency/rejection, URL changes, deletion during refresh, sign-out, chat token resolution, popup message provenance, cancellation, HTTPS downgrade prevention and development relay restrictions.
- UI tests verify the OAuth login form and existing public/token connection behavior. Sign-out tests await secure cleanup and check provider/plugin credentials are removed while conversations/preferences remain.
- Final `npm test`: **239 passed, 0 failed**. Includes 20 new OAuth protocol/bridge/relay cases, the OAuth connection-form case, and extended credential cleanup coverage. An intermediate suite exposed asynchronous sign-out cleanup after a synchronous fixture teardown; sign-out now returns its cleanup promise and the test awaits and verifies it. Tests transpile fixtures in memory; they do not package the application.
- Final `node node_modules/typescript/bin/tsc --noEmit`: passed, no build artifacts. `git diff --check`: passed.
- Final test log: `C:\Users\LAPTOP WA\Documents\Codex\2026-10-22\baca-playbook-c-users-laptop-wa\work\mcp-oauth-final-tests.log`.

## Public metadata checked, without account login

Read-only requests on 2026-10-22 confirmed protected resource metadata, public-client OAuth support, S256 and dynamic-registration endpoints for:

- `https://mcp.notion.com/mcp`, issuer `https://mcp.notion.com`.
- `https://mcp.sentry.dev/mcp`, issuer `https://mcp.sentry.dev`.
- `https://mcp.vercel.com/`, issuer `https://vercel.com`. Its token/registration endpoints are on `api.vercel.com`.

No live provider client was registered and no private account was authorized during these checks.

## Limits and work requiring a future authorized build

- **No Android/Kotlin/Rust or production frontend build was run. No APK was produced or published.** The new Android bridge has not been compiled or exercised on an emulator or physical device. The JS bridge tests simulate its contract; they are not native encryption/socket tests.
- Notion/Sentry/Vercel real account consent and private tools were not tested. Browser callbacks also depend on the provider permitting the registered redirect and web CORS behavior; Android uses native HTTP. Android may require manually returning from the browser. Process termination during authorization requires restarting login.
- A catalog entry without a service endpoint remains a custom-server template. Gmail, Google Drive and other such entries do not automatically acquire hosted MCP services or registered provider OAuth applications. Tokens/public servers continue to use their supported authentication methods.
- Vercel explicitly requires reviewed/approved clients. A SuperGPT Client ID/approval must be obtained from providers that require it; no other client's identity is reused. Confidential clients requiring a client secret need an application backend. Client ID Metadata Document hosting is not provisioned here.
- This OAuth browser bridge targets Android and web. Native desktop OAuth callback handling is not added; the existing desktop token path remains available.
- Access tokens are resolved at the start of a chat request. A provider rejecting a token before its declared expiry requests reconnection; tool calls are never silently replayed. Very long server-side runs may outlive their initial access token.

## References

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Notion MCP connection guide](https://developers.notion.com/guides/mcp/get-started-with-mcp)
- [Sentry MCP](https://mcp.sentry.dev/)
- [Vercel MCP and client approval requirements](https://vercel.com/docs/agent-resources/vercel-mcp)
