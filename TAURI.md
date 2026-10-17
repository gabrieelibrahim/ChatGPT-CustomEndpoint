# Sakelar desktop v0.1.2

The first Tauri 2 desktop target reuses the existing React interface. It does not import Chrome history, provider profiles, API keys, or browser storage into the desktop app.

## Run on Windows

Install Rust stable with the MSVC toolchain, Visual Studio C++ Build Tools **including a Windows SDK**, and Microsoft Edge WebView2 Runtime. Then run:

```powershell
npm ci
npm run desktop:dev
```

The desktop development frontend uses loopback port 1420 with strict port selection. An existing web preview on port 5174 can stay open. For the standalone application and per-user NSIS installer:

```powershell
npm run desktop:build
```

Outputs: `src-tauri/target/release/sakelar.exe` and `src-tauri/target/release/bundle/nsis/`. The installer is not code-signed in this first version. No signing credentials or updater endpoint are included.

If Rust is installed outside the normal PATH, optional `CARGO_HOME` and `RUSTUP_HOME` paths can be set in `.env.desktop.local`. `DESKTOP_WINDOWS_SDK` can select an extracted official Windows SDK, and `DESKTOP_NODE_PATH` can select the Node executable to bundle (its adjacent LICENSE is required). The desktop launcher loads this file locally; Git ignores it and the app does not bundle it. Standard Rust installations need no such file.

## Version one behavior

- The native window loads bundled frontend assets in release; Vite is not required to run the release app.
- Initial window dimensions fit the current monitor's usable area and DPI scale.
- Custom provider discovery, chat, reasoning and streaming use Tauri's Rust HTTP plugin. Browser builds keep their existing transport.
- HTTPS and HTTP loopback providers are supported. Redirects are disabled so bearer credentials are not forwarded to another destination. Keys stay in sessionStorage, profiles/preferences in localStorage, and uploaded blobs in IndexedDB inside the app webview's private data directory. Closing the session requires re-entering keys; secure persistent credentials are not implemented.
- Chat history, pin/archive, local collections, settings, HTML file selection and exports reuse the existing implementation. There are no seeded chats or built-in provider credentials.
- External HTTP/HTTPS links open in the system browser. A single frameless titlebar reuses the existing File/Edit/View/Help header and adds working native minimize/maximize/restore/close controls, without an extra branded OS caption row. Empty header regions support dragging and double-click maximize. Window controls remain available during onboarding.
- Both onboarding steps (name and optional custom endpoint) show only minimize/maximize/close in the titlebar; navigation and File/Edit/View/Help appear after entering the main app. Continuing past the name step immediately persists the local profile. Closing before optional endpoint setup no longer repeats onboarding on the next launch. Endpoint profiles persist independently; API keys remain session-only. Only explicit Log out or clearing app data resets the local profile.
- The native agent uses bundled Node and Codex executables through private inherited pipes and Tauri channels. There is no localhost agent server, Vite dependency, or end-user Node/Codex installation requirement. Project selection/indexing/previews, terminal output, file changes, approval decisions, stopping turns and configured MCP calls reuse the existing validated bridge. Only the configured project/access policy is persisted; enabling execution and confirming Responses support are explicit per-session actions. MCP servers may need their own external executables, and Git features need Git installed.
- Production CSP blocks remote scripts and frames. The webview has no generic shell/process plugin; two restricted agent commands forward only supported bridge actions. On Windows a job object kills the bundled runtime and its descendants when the app exits or crashes. The host also closes agent sessions and removes isolated temporary Codex homes on normal shutdown.
- Packaging stages executable files and public license notices only. Runtime binaries and local toolchain paths are Git-ignored. Provider keys never enter build configuration, resources, or logs. No existing Codex profile, account, API key or settings are copied into the installer.
- Native computer/mouse control, official Codex cloud services and other service integrations remain outside this universal client version.
- The update button stays absent until a real signed updater release feed is configured. Cloud sync, automatic background task execution and native packaging parity are not claimed.

## Checks

Pending the next native build: the HTTP capability source now escapes IPv6 URLPattern colons and uses an explicit IPv4 loopback regex. An invalid IPv6 pattern in the old v0.1.2 executable rejects every native HTTP request while deserializing scope. String transport failures now receive actionable UI errors. Existing installers retain the old embedded capability until rebuilt; no new native build is part of this source-only fix.

```powershell
npm test
npm run build
npm run test:desktop-runtime
npm run test:native
npm run test:desktop-window
```

`tests/native-desktop.test.cjs` checks native HTTP and agent channels through mocked IPC; `tests/desktop-host.test.mjs` exercises the private host with concurrent approval and cancellation. `test:desktop-runtime` then uses the actual staged Node and Codex executables through the desktop pipe host to execute an explicitly approved command, write/preview a temporary file, call a real local MCP echo tool, stream an answer, and shut down. These tests use fake credentials and a local mock gateway, with no paid inference. Native-window rendering and installer behavior are checked separately after the Rust build.

`test:native` additionally exercises Rust channels, the Windows job object, bundled runtime discovery, project/file reads, and process cleanup with the actual staged executables.

`test:desktop-window` is an opt-in Windows integration test using Playwright Core and the actual compiled executable. It enables WebView CDP only in its own child process, uses one isolated temporary data directory across three launches, and checks interrupted onboarding, endpoint persistence, session-only credentials, frameless controls, maximize/restore/minimize/close, and dark/light themes. Model discovery and chat streaming must reach a fake-key local HTTP gateway with no CORS headers, so an invalid native capability cannot pass through mocked IPC. This new network check is pending execution after the next authorized native build; the old v0.1.2 executable has the confirmed scope failure. It never attaches to an existing user window. `SAKELAR_TEST_EXE` selects another built or installed executable; `SAKELAR_TEST_SCREENSHOTS` optionally saves screenshots. The test closes its app and removes its temporary profile; leave test profiles out of shortcuts and normal launches.

For manual smoke testing, start with a fresh desktop profile, enter a test endpoint explicitly, discover a model, send a message, stop a stream, reopen saved history, restart the app, test dark/light themes, resize the window, select/export a file, and open a web link. Do not place real credentials in tracked source, fixtures or screenshots.
