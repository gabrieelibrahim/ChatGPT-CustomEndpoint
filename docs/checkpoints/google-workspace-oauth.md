# Google Workspace OAuth checkpoint

2026-10-22, Asia/Jakarta. Baseline commit: `78b8e47`; previous local upload-limit and generic MCP OAuth commits retained.

User asked which plugins support OAuth and requested all Google services through MCP/OAuth, using REA to inspect original ChatGPT. User confirmed there is no Google Cloud project/client yet and authorized preparing source and registration instructions. Compile, release and push remain unauthorized.

Official Google documentation now publishes nine Workspace MCP endpoints (Developer Preview): Gmail, Drive, Docs, Sheets, Slides, Calendar, Chat, People/Contacts, Classroom. These replace the earlier Gmail/Drive custom-server catalog placeholders. Google requires preregistered OAuth clients rather than the generic public-client dynamic registration used by some other MCP servers.

Implementation has three connected parts: shared service/scopes catalog; Android Google Identity authorization; optional confidential OAuth server for browser/alternative native use. Google Identity API is a separate path from the generic native loopback callback (Google does not allow Android OAuth clients to use that loopback method).

All connected plugins remain in main chat with tool approvals. Token resolution handles native authorization sequentially because Google Identity permits one operation at a time. The former eight-server cap is raised to sixteen across UI, profile resolution and SDK so all nine Google services can be represented.

No Cloud project, client registration, public deployment or account consent was performed. Details: `docs/google-workspace-registration.md`, `docs/verification/google-workspace-oauth.md`, and `docs/verification/google-android-authorization.md`.
