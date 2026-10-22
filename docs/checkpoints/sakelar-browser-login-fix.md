# Sakelar browser login correction

22 October 2026. User supplied a 7.33-second recording from SuperGPT v0.1.12. The failure is the optional Sakelar connection in Custom Endpoint, not Google Workspace plugin authorization. The visible message says automatic Sakelar connection is not activated; no browser is opened.

Current public GET checks on both the dashboard proxy and API returned ready=true, version=1 and the expected model base URL. Dashboard requests carrying a Tauri Origin returned 403. These observations do not prove which response the recorded APK received, or that Google sign-in/key exchange succeeds. Backend PR #1 is now merged and deployed by the operator; the earlier local deployment checkpoint is historical.

## Correction

- Remove the separate GET readiness gate. Start the proof-bound connection through the authoritative POST, then open its validated Sakelar consent URL in the system browser. The API still enforces readiness, limits, expiry and consent.
- Native uses the fixed HTTPS Sakelar API for start/token/cancel without dashboard cookies. Browser builds retain the dashboard proxy and existing CORS restrictions.
- Preserve fixed browser origin/path, exact code binding, random verifier/S256 proof and token validation. No key or device proof is put in a browser URL.
- Describe the intended flow in the app: browser Sakelar -> Google sign-in -> explicit SuperGPT approval -> return to app -> real account models and credentials.
- While polling, show a reopen-browser button using only the existing validated URL; it does not start another grant. Closing the browser after consent does not cancel the flow.
- Distinguish unavailable backend, rejected origin and rate limit. A cleanup error now retains the original cause instead of replacing it.

No Google account consent or API key issuance was performed by the agent to diagnose this recording. Checks of source and release startup must not be presented as proof of completed Google login or key exchange.
