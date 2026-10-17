# Official Apps SDK typography and rich messages

Uses `@openai/apps-sdk-ui` **0.2.2** from https://github.com/openai/apps-sdk-ui (MIT). Its `Markdown`, `CodeBlockBase`, syntax highlighter and `Button` render assistant messages, thinking content and mini-chat answers. Existing user messages, raw saved conversation text, provider requests and copy/export message source remain unchanged.

The default UI and code font families now use the SDK's `--font-sans` and `--font-mono` from `styles/variables-semantic.css`. The SDK provides platform font stacks; it does **not** ship a proprietary ChatGPT font binary. User-selected serif/monospace font and size preferences remain available. This is the SDK's typography, not a claim that every ChatGPT product has identical fonts or metrics.

The official renderer supports paragraphs, headings, emphasis, inline code, nested lists, blockquotes, GFM tables and task lists, syntax-highlighted fenced code, and KaTeX math through `includeMath` (the SDK's `$$` delimiters). Code headers include a real copy action with success/error feedback. Math plugins load asynchronously; their bundled stylesheet uses OpenAI CDN font URLs. The renderer and its component styles are loaded on demand, keeping the initial chat JavaScript bundle approximately unchanged.

SDK foundation styles load before existing shell styles. `rich-text.css` restores the SDK component-layer paragraph/heading/button styles within rich messages where existing shell resets would otherwise override them. The existing Settings, navigation and composer dimensions remain intact. SDK `data-theme` follows the client's selected light/dark/system theme.

Provider text is untrusted: raw HTML is skipped, active URL schemes are blocked, links open with `noopener noreferrer`, and remote message images load only after an explicit click, without a referrer. A rendering boundary preserves readable source text if a chunk or renderer fails. No model-provided JavaScript executes. The SDK's pinned lodash and KaTeX dependencies are overridden to patched **4.18.1** and **0.18.2** respectively; `npm audit` reports no vulnerabilities at verification time.

Verification: production build, 53 unit/render tests (including the actual bundled SDK renderer), plus synthetic DOM checks for tables, syntax highlighting, asynchronous math, copy success/failure, explicit image loading and incomplete streamed Markdown. Synthetic tests do not establish pixel identity; direct live browser visual verification remains blocked by the saved origin-access permission.


Reasoning duration is client-observed time from the first received reasoning chunk
until the first answer text, Stop, or stream completion. It is saved as optional
`reasoningDurationMs` message metadata, including stopped reasoning and JSON
export/import. It is not a provider-reported server execution time. Durations
below one second and older messages with unknown duration display `Thought`;
known durations of one second or longer display `Thought for N second(s)`.
The live display timer never writes completed duration from effect cleanup.
