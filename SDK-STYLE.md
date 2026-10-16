# Shared Apps SDK UI components

Extends the existing official `@openai/apps-sdk-ui` 0.2.2 integration beyond rich messages. `src/components/SDKPrimitives.tsx` centralizes the actual SDK components; `sdk-controls.css` resolves the existing shell's higher-priority resets while preserving desktop dimensions and the SDK's light/dark tokens.

| SDK component | Active application use |
| --- | --- |
| Alert | Actual errors in chat, endpoint settings/onboarding, general settings, local agent, project/folder dialogs, files, collections and mini chat; success feedback for saved settings and model discovery |
| Button | Settings actions, endpoint save/reset/delete/test/model selection, onboarding submission, chat retry/settings actions and dismissing notifications |
| Input | Onboarding/profile names, endpoint name/URL/key/model; native IDs, refs, required validation, key masking and controlled state remain intact |
| Switch | Actual saved settings and native network/plugin preferences; controlled state, disabled behavior and keyboard support come from Radix through the SDK |
| Tooltip | Shared icon buttons, keyboard focus, Escape, collision-aware portal placement and existing 450ms hover delay |
| LoadingIndicator | Settings loading and actual endpoint-testing button state |
| EmptyMessage | Empty conversations, model searches, archived chats and file libraries |
| Avatar / Badge | Local profile menu identity and selected endpoint badge |

Toast notifications now use a dismissible SDK information alert. Error alerts preserve existing safe text, recovery handlers and retry guards; no provider response body, API key, fake quota or fictitious service is introduced. Existing project dialogs keep their real folder pickers, focus traps and explicit native permissions. Custom navigation rows, project cards, composer and pet thumbnails retain their layout rather than being replaced with unrelated catalog examples.

The SDK is a design system for apps inside ChatGPT, not the source for the complete ChatGPT/Codex desktop application. This integration does not claim pixel identity. The supplied screenshots still determine application-level layout. Live browser visual checking remains blocked by the saved origin permission.

Validation: 53 unit/render tests; synthetic DOM regression checks for the full settings workflow, endpoint typing/focus/key visibility, denied connection/recovery/model discovery/save, switch callbacks, toast dismissal, streaming/retry/stop and native agent approvals. These use fake credentials and mocked transport. Production build passes; React is split into a shared cacheable chunk while rich Markdown and math remain loaded on demand. No new dependencies were added for this extension.

Style regression fix: the SDK foundation import must precede JavaScript imports that bring in component CSS. CSS layers are registered by first occurrence; emitting `components` before `base` let the reset override the SDK through `revert-layer`. The production build now checks the emitted entry stylesheet, not only React markup. Native input spacing/borders no longer override nested SDK inputs, secret reveal buttons use an explicit flex row, and endpoint authentication/effort toggles use the actual SDK Switch.
