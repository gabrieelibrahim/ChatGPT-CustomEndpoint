# Desktop feature status

This client preserves the existing ChatGPT/Codex experiences. UI availability does not imply access to OpenAI's private cloud or desktop services.

## Functional local features

| Area | Current behavior |
| --- | --- |
| Choose project | Create project modal with a custom name and local source folder; native folder dialog or manual-path fallback; recent project selection; Cancel never saves the draft |
| This computer | Anchored Work in menu with This computer selected; Cloud/Remote disabled until their runtimes exist. Actual host/platform/runtime information remains in environment settings |
| Project files | Source index/search, bounded text preview and attach-to-chat; hidden/dependency folders and symlinks skipped |
| Chat | Selected provider/model, streaming, stop, retry, edit/copy/read-aloud, local history and temporary chat |
| Conversation actions | Rename, pin/unpin, archive/restore, delete confirmation, copy, local text fork and project membership |
| Share / storage | Copy/Markdown/JSON export, all-chat backup and validated JSON import; no hosted public share URL |
| Pages / Skills | Local editable notes/instructions; use as draft context, export and delete |
| Sites | Saved HTTP(S) links, open/remove/use URL in prompt; no claim that website content was fetched |
| Files / Images | Local IndexedDB library, import/search/preview/download/remove/attach; no image generation service |
| Scheduled | Local dated reminders and notifications while app is open; Run prepares a prompt for user review |
| Plugins | Explicit HTTP or stdio MCP profiles; configure/enable/disable/remove; applied on next native agent connection |
| Voice | Browser-dependent speech recognition and speech synthesis; clear unsupported/error states |
| Settings | Sixteen searchable tabs with applied appearance, shortcuts, voice, instructions/memory, storage/import/archive, usage metadata and agent permissions; see [SETTINGS.md](SETTINGS.md) |
| Git review | Actual tracked Git status/diff from chosen project, exportable to a review prompt |

New installs contain no fictional conversations, installed plugins, documents or background processes. Existing user history is preserved. Feedback marking is transient within the current view.

## Local agent requirements

The Tauri installer includes Node and the Codex CLI/app-server; no separate runtime installation or development server is required. Browser development uses `npm run dev` on localhost and an installed Codex runtime. Select Codex, choose a project, then enable the agent in Agent settings after confirming that the chosen gateway/model supports Responses API and tool calling. It supports terminal execution/output, runtime file changes/diffs, explicit per-action approvals, stop, read-only planning and configured MCP calls. [AGENT-RUNTIME.md](AGENT-RUNTIME.md) explains isolation and verification.

Local tools follow the configured runtime sandbox. Native folder selection/file browsing/Git and agent execution use private pipes in Tauri or the development bridge in browser development. They are unavailable in a static website build.

## Storage and bounds

- Provider metadata, conversations, project membership, notes, reminders and MCP settings are local to this browser profile. API keys remain session-scoped. No account login/synchronization is implemented.
- File blobs use IndexedDB, up to 10 MB per library file. Sending supports text/source files (512 KB total), or up to four PNG/JPEG/WebP/GIF images (1 MB each) across the submitted history. Other binary formats fail explicitly. Native agent text also has a 100,000-character request limit.
- Selecting a folder does not upload it. Project preview reads only the file selected in that folder; Send explicitly includes attached contents. An enabled agent can read files according to its sandbox and sends the context it uses to the chosen provider.
- Chat backups contain messages and conversation metadata; file blobs, provider profiles/keys, notes, reminders and MCP configuration are not included. Import restores text plus pin/archive/project metadata; reattach files separately.
- Folder scans visit at most 3,000 entries/eight directory levels. Project text preview rejects traversal/symlink escapes, binary NUL bytes and files over 512 KB.
- Development requests use same-origin JSON POST from loopback only, bounded to 8 MB. No third-party requests are routed through Sakelar.

## External capabilities still requiring implementation

Beyond the initial Tauri v0.1.0 shell/native HTTP target (see TAURI.md): signed distribution and automatic updates; desktop mouse/keyboard/screenshot automation; browser extension/tab attachment; private Codex cloud/review/account integration; native worktree management; official pet-service integration; Hooks; maps/GPT marketplace services; MCP OAuth/authenticated profiles; background scheduling while the app is closed; image generation, browsing and research adapters. These do not become functional merely by renaming a UI button. Existing entry points disclose missing integrations instead of reporting simulated success. “Open on chatgpt.com” is disabled because local conversations have no official ChatGPT URL.

## Verification

`npm run build` and `npm test` (60 tests, including native HTTP/agent IPC and desktop host tests: twelve provider, nine agent protocol/transport, four workspace/security, five file-library/hydration, three experience-specific history, six settings and four reasoning/rendering regression tests and four official SDK rich-text tests and five SDK control/feedback tests and one production CSS order guard test). Optional `npm run test:runtime` repeats the real installed-runtime smoke test. Additional synthetic DOM tests cover the original project/computer regression, computed form/header styles, CRUD flows and agent approvals. An installed-runtime smoke test used a fake-key local mock gateway to execute a harmless PowerShell command and a real local MCP echo tool, then verified the returned tool result. No paid inference was performed.

Live browser visual verification was blocked by the saved origin access permission. Synthetic DOM checks do not establish pixel identity, exact animation timing or native folder-dialog appearance.
