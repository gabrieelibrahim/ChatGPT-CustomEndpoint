# Android Google authorization source design

2026-10-22, Asia/Jakarta. Source prepared only; no Gradle dependency resolution, Kotlin/Rust compilation, APK, or release was run.

Current integration uses the embedded SuperGPT Google API MCP adapter instead of Google's preview MCP services. The bridge authorization/account-binding design remains applicable; the allowlist now follows the narrowed Google API tool scopes in `shared/googleWorkspace.json`. See [current registration](../google-workspace-registration.md).

`GoogleAuthorizationBridge.kt` exposes `SuperGPTGoogleAuth` only to the existing allowlisted top-level app WebView origins. It accepts `authorize {id, scopes, interactive, account?}`, `cancel {id, requestId}`, and `clear {id}`. Requested scopes must be a fixed allowlist matching the nine official Workspace entries in `shared/googleWorkspace.json`, plus `userinfo.email`. No arbitrary endpoint, OAuth client secret, auth code or refresh token can be supplied through this bridge.

Authorization uses Google Identity Services `AuthorizationClient` from pinned `com.google.android.gms:play-services-auth:22.0.0`. Initial interactive authorization requests Google's account selector and may launch Google's returned PendingIntent. Silent authorization requires an account and never launches a PendingIntent: a resolution yields `reconnect-required`. Every requested scope must be covered by grantedScopes; partial consent does not return a usable token. Coverage accepts Google's email/profile aliases and equivalent broader grants (write versus its readonly variant, full Drive/Calendar grants, Calendar events versus freebusy, and Gmail modify/full versus readonly). Broad scopes are accepted only when returned by Google; the request allowlist never asks for full mail/Drive/Calendar access.

The modern AuthorizationResult API does not directly expose the account. Rather than using deprecated GoogleSignInAccount conversion or enumerating device accounts, the bridge requests userinfo.email and calls only the fixed HTTPS Google userinfo endpoint without redirects, with bounded response size and timeouts. A verified email binds subsequent silent requests through AuthorizationRequest.Builder.setAccount(Account(email, "com.google")). Results for a different account are rejected. The bridge returns account email and token only to the app reply; it does not log or persist them. The TypeScript layer must store account/service binding only in the protected vault.

Only one authorization is active at a time. Cancellation, sign-out clear, timeout or Activity destruction invalidates it. Delayed tasks/activity results do not publish tokens, and a token returned after cancellation is cleared from the Google local token cache. There is no supported API to dismiss an already launched Google-owned consent UI; cancellation cannot undo consent already granted by the user, but it prevents using its eventual result. Each activity-result identity is consumed separately to avoid assigning an old result to a later login.

`clear` cancels pending work and asks Google to clear access tokens observed in the current native bridge lifetime (inventory bounded to the latest 64 distinct tokens). It neither revokes project-wide grants nor signs out a Google device account/other applications. It does not reset Google's default authorization account: every subsequent silent call must provide its saved account explicitly. Device/process recreation drops the in-memory token inventory; Google continues to own its own token cache. No long-lived Google refresh token is stored on the device.

Before real use, register the Android OAuth client for `id.sakelar.client` and its permanent signing certificate SHA-1, configure consent and required APIs/MCP services, and follow Google's AI-powered agent client requirements. Google Play services/account availability, partial consent, app registration and Workspace admin/preview permissions can prevent authorization. A future authorized Android compile and real-account/emulator/device exercise are still required.

References:

- [Android Google authorization and dependency](https://developer.android.com/identity/authorization)
- [AuthorizationRequest.Builder account and scopes](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationRequest.Builder)
- [AuthorizationResult API](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationResult)
- [Google Workspace MCP configuration](https://developers.google.com/workspace/guides/configure-mcp-servers)
- [Google loopback restrictions for Android OAuth clients](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration)
