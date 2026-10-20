# Plugin catalog adaptation

The supplied two 590×1280 recordings (26.616 s and 35.238 s) and two 614×1280 stills are the UI references. The recordings show catalog categories, a bottom search field, installed-icon strip, a separate added-plugins list, and plugin details with sample prompts, information, and a fixed installation action. Focused frame sequences around 1.1–2.4 s and 9.6–11.8 s show horizontal fade navigation and detail skeletons. Timing here is an adaptation estimate, not instrumented APK timing.

The mobile sidebar opens the catalog. Settings → Plugin opens Ditambahkan. There are 69 catalog templates in 16 categories, with 13 documented remote endpoint URLs prefilled. Category buttons expose the complete category; search filters names, descriptions and category labels. Installed rows show only actual saved MCP connections and available SuperGPT builtins. ChatGPT's installed list is not copied as if the same services were already installed locally.

Detail pages include prompt examples, connection information, public documentation links and actual saved tool names/status. Example prompts prepare a draft rather than send it. An unconnected example first asks for a working MCP connection. Builtin Pages opens the existing local notes library; Browser prepares a web search draft; Plugin Management opens the catalog. Pets, Remotion and other reference-only builtins are not falsely shown as installed.

Install opens a connection form. Public URLs are prefilled; token-based URLs ask for a bearer token. Custom-service entries need the user's MCP server URL. OAuth entries explicitly explain that automatic provider login is not implemented; they can use an authenticated gateway or the provider's official documentation. A template alone is not an account integration. The 13 endpoint presets are configuration choices, not 13 newly verified account connections. MCP still initializes and lists real tools before saving an enabled profile. Token storage remains session-only and separate from configuration/history. Existing profiles without a catalog ID are preserved and matched by endpoint or shown as custom.

Back/Escape and Android Back first leave detail/connection/category/menu, then return to the caller. Category/catalog scroll offsets are restored on return. Navigation reuses the application's horizontal fade, including direction hints; skeletons appear only while lazy code is loading, without an artificial network delay. Reduced-motion settings suppress animations. Bottom search and detail action use a fade to the screen edge; scrollbars are hidden.

Geometry uses the supplied stills normalized to 390×813: approximately 45 px back control, 48 px catalog marks, 81 px catalog row, 55 px added-plugin row, 18 px item name/14 px description, and a 49 px search field. First preview inspection at 390×813 confirmed the catalog layout and readable type. Some unavailable logos use local initials/symbols; exact logo parity is not claimed. Browser access was then disabled in Work settings, preventing final screenshot/interaction verification. No APK was compiled or released for this task.

Validation: catalog filtering/auth types; real saved-only installed list; Pages action; nested Back; denied login does not install; successful MCP initialization preserves unrelated profiles/documents and stores tokens only in session storage. All 196 tests pass, including existing model/MCP approval/cancellation cases. Build includes TypeScript and emitted SDK CSS order checking.

Official endpoint references:
- https://github.com/github/github-mcp-server
- https://docs.stripe.com/mcp
- https://supabase.com/docs/guides/ai-tools/mcp
- https://render.com/docs/mcp-server
- https://developers.notion.com/guides/mcp/get-started-with-mcp
- https://context7.com/docs/resources/all-clients
- https://huggingface.co/docs/hub/en/agents-mcp
- https://mcp.sentry.dev
- https://vercel.com/docs/agent-resources/vercel-mcp
- The four public templates retain references in mobile-mcp-timeout-launch.md.
