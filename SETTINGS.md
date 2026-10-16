# Functional settings

The supplied three-minute settings recording (`225553`) was inspected locally using sampled video frames. The implementation follows its sidebar/section structure while keeping an independent local client identity. It never copies the recorded person's email, usage balance, account identity or installed services.

Settings now opens a real page with searchable navigation. Ctrl+, opens General. Tabs are loaded on demand so the initial chat bundle does not include the full settings panel.

| Tab | Functional behavior |
| --- | --- |
| General | Actual agent read-only/workspace access, chosen project folder, close confirmation, dated inactive-chat archiving (pinned chats excluded), suggestions, MCP master switch, send shortcut and browser completion notifications/sound |
| Import | Validated local chat JSON import/export and versioned preferences import/export; existing chats are preserved |
| Profile | Local display-name editing, real saved chat/message counts and activity from recorded message timestamps |
| Appearance | Dark/light/system mode, colors, font and text/code sizes, reduced motion, translucent sidebar, wide pages and optional trailing smart punctuation |
| Account | Actual local identity, provider configuration and logout back to local onboarding; no fabricated authenticated email/plan |
| Archived chats | Search/project filtering, restore and existing delete confirmation |
| Voice | Explicit microphone permission check, dictation language, actual installed speech voices, speaking rate/volume and Play/Stop preview |
| Storage | Browser quota/usage estimate, persistence request, IndexedDB library management/clear confirmation, export/archive and session-key clearing |
| Configuration | Saved provider/model selection, default/visible effort levels, real local sandbox access/network policy and provider-chat timeout |
| Personalization | User instructions, writing style and explicitly saved memory notes used in subsequent model requests; original stored messages remain unchanged |
| Mini & Pets | A genuine compact provider chat window at `?mini=1`, with streaming/stop/history and a local emoji companion that opens a new chat |
| Keyboard shortcuts | Enable/disable, capture/remap with conflict detection, restore defaults; bindings actually drive the application keyboard handler |
| Usage & billing | Observed client runs, provider-reported input/output tokens, actual local daily run chart, metadata export/clear and an optional user-configured billing portal |
| Data controls | Local backup, sandbox network preference, archive/delete-all confirmations, archive management and resetting preferences without deleting providers/history |
| Custom Endpoint | Existing real provider profiles, model discovery and session credentials, embedded without changing onboarding |
| Plugins | Existing actual MCP profile/skill management and a master allow switch used by the agent |

## State and request integration

`src/lib/clientSettings.ts` validates versioned preferences under `client-settings-v1`. UI changes persist locally and apply immediately; browser windows receive settings changes through storage events. Appearance uses CSS variables/data attributes. Native agent enablement and Responses confirmation remain explicit per reload.

Instructions and optional user-created memory notes are included in the **next request** to the selected provider. They are not automatically extracted from chat history and do not claim to implement the official Codex memory service. The writing-style preference is added as a request instruction. Neither changes saved original message text. Preferences exports explicitly include these user-written fields; provider API keys are never part of that schema.

MCP enablement filters the actual servers passed to the next private runtime connection. Network access defaults off and is forwarded to the native sandbox policy; Plan-only sandbox commands always disable it. **Gateway requests and explicitly configured MCP server connections are independent from the shell sandbox network switch.** No setting turns on automatic unrestricted approval. File access remains read-only/workspace-write with actual permission requests.

Usage metadata (`client-usage-v1`) stores at most 1,000 entries with provider/model, time, source, status and actual token numbers when supplied. It never stores prompts, answers, keys or fabricated quota/cost estimates. Chat Completions usage is observed only when supplied in JSON/SSE; no unsupported stream-options flag is silently added. Native cumulative token notifications are converted to a delta for each turn. Older chats are not assigned invented token counts. Billing/retention/training policy stays with the provider.

The compact window uses the same selected provider, preferences and session-key mechanism. Its text chats are written to the existing local history; no native desktop sidecar is claimed. Popup permission and browser speech/notification/persistence APIs remain browser-dependent. Removing file blobs makes old attachment contents unavailable for resending; the clear action warns and asks for confirmation.

## Intentional capability boundaries

The recording also shows native startup registration, global OS shortcuts, external editor/shell integration, cloud account sync, account billing/quota, automatic cross-app imports, hosted share links and official pet services. These require an actual desktop host or provider service. This browser client reports their real unavailable/provider-controlled status instead of offering toggles that only save a pretend value. Full filesystem access and silent auto-approval are not exposed. Existing local MCP configuration is available for independent tool integrations.

## Verification

- `npm test`: 43 tests, including settings validation/persistence, prompt augmentation without history mutation, custom shortcuts, punctuation, usage privacy, actual provider usage callbacks, native sandbox network/Plan isolation, per-turn token deltas and provider reasoning streams.
- `npm run test:runtime`: installed Codex runtime executes a harmless local command and local MCP echo through a fake-key loopback Responses gateway. Actual usage notifications also stream through the bridge.
- Synthetic DOM tests exercise every settings tab, stable instruction typing/focus, appearance effects, provider/model/effort, voice selection, shortcut execution, preference persistence, import/archive/restore, destructive-action confirmations, preservation of credentials/history boundaries, and mini chat response/stop/persistence.
- Production build passes. Live browser visual QA remains blocked by the saved origin-access permission; no pixel or native service parity is claimed.
