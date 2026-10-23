# Official Apps SDK typography and rich messages

Uses `@openai/apps-sdk-ui` **0.2.2** from https://github.com/openai/apps-sdk-ui (MIT). Its `Markdown`, `CodeBlockBase`, syntax highlighter and `Button` render assistant messages, Codex stream commentary and mini-chat answers. Existing user messages, raw saved conversation text, provider requests and copy/export message source remain unchanged.

The default UI and code font families now use the SDK's `--font-sans` and `--font-mono` from `styles/variables-semantic.css`. The SDK provides platform font stacks; it does **not** ship a proprietary ChatGPT font binary. User-selected serif/monospace font and size preferences remain available. This is the SDK's typography, not a claim that every ChatGPT product has identical fonts or metrics.

The official renderer supports paragraphs, headings, emphasis, inline code, nested lists, blockquotes, GFM tables and task lists, syntax-highlighted fenced code, and KaTeX math through `includeMath` (the SDK's `$$` delimiters). Code headers include a real copy action with success/error feedback. Math plugins load asynchronously; their bundled stylesheet uses OpenAI CDN font URLs. The renderer and its component styles are loaded on demand, keeping the initial chat JavaScript bundle approximately unchanged.

SDK foundation styles load before existing shell styles. `rich-text.css` restores the SDK component-layer paragraph/heading/button styles within rich messages where existing shell resets would otherwise override them. The existing Settings, navigation and composer dimensions remain intact. SDK `data-theme` follows the client's selected light/dark/system theme.

Provider text is untrusted: raw HTML is skipped, active URL schemes are blocked, links open with `noopener noreferrer`, and remote message images load only after an explicit click, without a referrer. A rendering boundary preserves readable source text if a chunk or renderer fails. No model-provided JavaScript executes. The SDK's pinned lodash and KaTeX dependencies are overridden to patched **4.18.1** and **0.18.2** respectively; `npm audit` reports no vulnerabilities at verification time.

Verification: production build, 53 unit/render tests (including the actual bundled SDK renderer), plus synthetic DOM checks for tables, syntax highlighting, asynchronous math, copy success/failure, explicit image loading and incomplete streamed Markdown. Synthetic tests do not establish pixel identity; direct live browser visual verification remains blocked by the saved origin-access permission.


ChatGPT presentation never renders provider reasoning or a Thinking/Thought card,
including reasoning in old saved chats. Until the first answer text arrives, an
empty streaming assistant message displays the blue waiting dot. Stop and stream
completion remove that dot. Leading provider `<think>` blocks are parsed out of
the visible answer; literal tags in code and prose remain untouched.

Provider reasoning and optional `reasoningDurationMs` remain stored for history
compatibility and JSON export/import. Duration is observed by the client, not
reported by the provider. These fields do not create UI in ChatGPT mode.

Codex keeps its separate Thinking shimmer and elapsed Working indicator. Its
activity stream renders real commentary, summaries and tools in event order.
Adjacent completed command batches collapse into Ran commands; running, failed
and stopped tools keep their actual state. Shell command/output details are
expandable. Summaries are shown only while actually supplied by the runtime.

## Rich answer formats (v0.1.22)

Settings → Umum → **Format jawaban interaktif** (on by default) adds formatting guidance to each request; **Contoh format jawaban** shows every format locally with mock data, no model call. Answers stay ordinary Markdown text in history, so export, copy and other clients are unaffected.

Beyond Markdown (headings, lists, task lists, tables, quotes, code with copy, KaTeX), the renderer recognises fenced blocks:

| Fence | Content | Renders |
| --- | --- | --- |
| ` ```ui ` | JSON component tree, schema `src/rich/schema.ts` (version `1.0`) | badges, cards, grid/row/stack, title/text/markdown, callout, counter, form (text, textarea, radio, checkbox, select, slider, native date), segmented control, accordion, carousel, popover, icon grid, image gallery, writing block, sources |
| ` ```chart ` | JSON data, `src/rich/chart.ts` | line, area, bar, pie, donut, scatter as plain SVG with tap-to-inspect and a data table |
| ` ```mermaid ` | Mermaid source | diagram (Mermaid 12, `securityLevel: strict`, lazy loaded) with source toggle, copy, zoom and SVG download |
| ` ````file name="x.md" description="…" ` | file text | file card that saves through the existing export bridge |

Safety: model output is untrusted. Components and props are allowlisted; `__proto__`/`constructor` keys, unknown types, non-http(s) image and link URLs, nesting over 8, more than 200 nodes or 100 KB are rejected with a readable fallback. No model-provided HTML or JavaScript runs. Blocks can only copy, share, save a file, change local state, or put text in the composer (the user still presses Send) — each after a tap. Remote images in galleries load only after a tap, without a referrer.

Streaming: only the block still being written counts as live; an unfinished `ui`/`chart`/`mermaid` block shows a placeholder and renders when complete, so earlier interactive blocks keep their state. Tests: `tests/rich-content.test.cjs`.
