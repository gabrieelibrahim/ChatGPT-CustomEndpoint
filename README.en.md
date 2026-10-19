<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/supergpt-logo-dark.svg" />
    <img src="public/supergpt-logo.png" alt="SuperGPT logo" width="140" height="140" />
  </picture>
  <h1>SuperGPT</h1>
  <p><strong>by Sakelar</strong></p>
  <p>One AI client. Your choice of providers and models.</p>
  <p><a href="README.md">Bahasa Indonesia</a> · <strong>English</strong></p>
  <p><a href="#quick-start">Quick start</a> · <a href="#desktop-app">Desktop</a> · <a href="#documentation">Documentation</a></p>
</div>

---

**SuperGPT** is an independent AI client with a React interface and a Tauri 2 desktop app. The interface, model, and provider are independent: connect an OpenAI-compatible endpoint without being tied to one service.

**Sakelar AI** is a recommended provider, not a requirement. SuperGPT is not an official OpenAI app and does not include an account, subscription, or API credits.

## What you can do

| Feature | Capability |
| --- | --- |
| Conversations | Streaming responses, stop, retry, and local history. |
| Providers & models | Multiple endpoint profiles, provider model discovery, and manual model IDs. |
| Workspace | Chat and Work modes, local projects, search, pin, archive, and chat import/export. |
| Content | Markdown, code blocks, tables, math, plus text and image attachments for compatible models. |
| Settings | Light/dark themes, text sizes, shortcuts, custom instructions, and storage controls. |
| Mini Chat | A compact conversation at `?mini=1`. |
| Desktop | A Tauri 2 window and native HTTP connections to providers. |

> **Codex status:** switching to Codex mode is temporarily disabled. The local runtime, terminal, file editing, approval, and MCP implementation remains in the project, but is not an active selectable feature in this release. See [feature status](FEATURE-STATUS.md) and [agent runtime](AGENT-RUNTIME.md).

## Quick start

For web development, install Node.js and npm:

```bash
git clone https://github.com/gabrieelibrahim/SuperGPT.git
cd SuperGPT
npm ci
npm run dev
```

Open the localhost address printed by Vite. On first launch, enter a local display name, then configure an endpoint or skip that step.

### Connect a provider

1. Open **Profile → Custom Endpoint**.
2. Enter a connection name and **Base URL**, including `/v1` if your provider requires it.
3. Enter an API key if required.
4. Select **Tes & ambil model** to discover models, or enter a model ID manually.
5. Save the endpoint and send a message through **Ask SuperGPT**.

Available models, image input, and `reasoning_effort` depend on the provider. The desktop composer does not ship a built-in model catalog or demo responses.

### Connection paths

| Environment | Transport |
| --- | --- |
| Localhost web development | A local relay in the Vite process handles providers that reject CORS preflight. |
| Static web / `npm run preview` | Direct browser requests; the provider must allow CORS. |
| Tauri app | Native HTTP directly to the provider. |

Endpoint validation accepts HTTPS, HTTP loopback, and Tailscale IPv4 addresses in `100.64.0.0/10`. A reachable server, correct port, and network permissions are still required.

## Android & iOS

The mobile layout shares the conversation engine and provider configuration. The Android target builds an **ARM64 testing APK**; iOS builds require a Mac and Xcode. See [MOBILE.md](MOBILE.md) for setup, build commands, and verification boundaries.

```bash
npm run android:build
```

## Desktop app

The desktop target uses **Tauri 2**. Windows builds require Rust MSVC, Visual Studio C++ Build Tools with a Windows SDK, and WebView2 Runtime.

```bash
# Start desktop development
npm run desktop:dev

# Build the Windows app and installer
npm run desktop:build
```

Future builds use **SuperGPT**, the `SuperGPT.exe` executable, and the new transparent logo. Updating source does not change existing EXE files. The application identifier and existing storage keys are retained for local data compatibility.

See the [Tauri guide](TAURI.md) for native prerequisites and packaging details. Static web hosting cannot run a local terminal or agent runtime.

## Data & privacy

- **Name, preferences, and history:** stored locally on the device.
- **API keys:** kept in `sessionStorage`; excluded from profile exports and chat backups.
- **File library:** stored in IndexedDB.
- **Temporary chat:** excluded from local history; provider-side retention follows the provider's policy.
- **AI requests:** sent to your chosen provider. The development relay runs on your own computer, not a hosted Sakelar proxy.

There is no built-in cloud sync, cloud account, quota, or billing service. Keep credentials and personal configuration out of commits.

## Development & checks

```bash
npm test
npm run build
```

The build checks TypeScript and SDK CSS layer order. Tests cover provider transport, streaming parsing, storage, rendering, and native HTTP/agent adapters. Additional runtime checks use a fake-key local gateway; read the [runtime guide](AGENT-RUNTIME.md) before running them.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Tauri 2 · OpenAI Apps SDK UI.

## Documentation

The detailed technical guides are maintained in their existing language.

| Guide | Contents |
| --- | --- |
| [FEATURE-STATUS.md](FEATURE-STATUS.md) | Available features, provider requirements, and limitations. |
| [TAURI.md](TAURI.md) | Desktop builds, runtime, and Windows packaging. |
| [DESKTOP.md](DESKTOP.md) | Desktop shell, navigation, and local interactions. |
| [SETTINGS.md](SETTINGS.md) | Settings, preferences, and storage. |
| [AGENT-RUNTIME.md](AGENT-RUNTIME.md) | Agent protocol, sandbox, approvals, and MCP. |
| [RICH-TEXT.md](RICH-TEXT.md) | Markdown, code, math, and rendering. |
| [SDK-STYLE.md](SDK-STYLE.md) | SDK components and CSS foundations. |

## Logo & attribution

The SuperGPT logo comes from artwork supplied by the project owner. The transparent master is [`public/supergpt-logo.png`](public/supergpt-logo.png); application icons, installer icons, and the favicon share this design. The light version for dark surfaces preserves its shape and transparency.

Some interface icons and components use [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui). Source attribution and icon licenses are in [`src/components/openai-icons/`](src/components/openai-icons/). Provider marks and interface icons are separate from the SuperGPT application logo.

## Tools in the main chat

The existing composer runs Agents SDK with the selected custom endpoint.
Web search, MCP approvals, questions, cards, and source links appear inside the
conversation. Configure **Settings / General / Fitur AI** (mobile:
**Pengaturan / Fitur AI**) and add HTTP MCP servers in **Plugin**.
There is one chat UI and one device history. ChatKit schemas are used only for
inline content; its full chat component is not loaded.

Function calling requires a compatible model. The browser development server
includes the SDK service; APK builds need a configured HTTPS server.
[Setup and verification limits](docs/sdk-integration.md).
