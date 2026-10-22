# MCP OAuth checkpoint

Date: 2026-10-22 (Asia/Jakarta). Starting HEAD: `0904db4`, branch `main`, two local commits ahead of the recorded remote. Previous attachment-limit changes are retained.

Request: replace the OAuth placeholder in plugin connections with a working sign-in flow. The user asked whether every plugin uses OAuth; supported authentication must follow each server rather than pretending all catalog entries have an OAuth integration.

The source previously implemented public/bearer MCP connections, while Notion, Sentry and Vercel entries explicitly said automatic OAuth was unavailable. Most other catalog entries are custom-server templates without a public MCP endpoint.

Scope: Android/browser public-client OAuth with metadata discovery, PKCE S256, browser authorization, token exchange/refresh, protected Android persistence, and integration with existing main-chat tools. Provider app registration or approval remains provider-controlled. Do not embed a client secret or borrow another application's identity.

No APK, production frontend, Rust or Kotlin compilation; no release, version bump or push is authorized. Existing untracked EXE/APK artifacts must not be committed.
