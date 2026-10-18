# Audit mobile: typography, sidebar, search

Date: 2026-10-18. Scope: mobile source and browser preview; desktop layout unchanged.

## Evidence and limits

- User search/sidebar captures: 614 × 1280. Compare at 390 × 813 CSS px using a uniform 390/614 ratio. This is image normalization, **not** a measurement of Android density or font scaling.
- APK inspected statically through REA/JADX: `com.openai.chatgpt`, version `1.2026.279`, SHA-256 `a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`.
- Package evidence: `ev_e227ce1457a57a5caa6419926ee070891e39e162af78c0f4d096fddaa0855730`.
- `GlobalSearchFilter` static initializer confirms Top, Chats, Images, Documents, Projects and their order: `ev_df266aad3fbf3c96ed5bbd34f531a83389aa2fe5bee05d9d2956a8d11b0fa955`.
- `GlobalSearchResultKind` confirms Conversation, Image, Document, Project, Folder: `ev_b97da387c08969a5efee99c1612091ffeaf8b526b314ab74cf2d7cee63c8a61c`.
- These enums establish categories, not exact rendering or interactions. APK signatures were not verified; the APK was not executed. No native typography value was recovered by this pass.

## Typography inventory

All sizes below are CSS px, with normal text at weight 400. Home, sidebar, search, Settings root and Custom Endpoint were inspected through computed styles in the browser. Other entries were reviewed in mobile CSS. The font family resolves to bundled **SuperGPT Roboto**, independent of the Windows desktop font stack.

| Area | Size / line height | Weight | Status |
| --- | --- | --- | --- |
| Home Chat / Work | 14 / 20 | 400 | Existing capture-based geometry retained |
| Home suggestions | 18 / 25 | 400 | Browser measured |
| Composer | 18 / 28 | 400 | Browser measured; first-focus behavior unchanged |
| Sidebar brand | 22 / 28 | 600 | Browser measured; SuperGPT branding retained |
| Sidebar menu, section headings | 18 / 24 | 600 | Browser measured |
| Sidebar chat titles | 18 / 24 | 400 | Browser measured; 49 px rows, truncation preserved |
| Sidebar Obrolan | 18 / 24 | 500 | Browser measured; 49 px button |
| Search section heading | 18 / 24 | 500 | Browser measured |
| Search result title | 18 / 24 | 400 | Browser measured; 73.5 px rows |
| Search result file type | 14 / 18 | 400 | Browser measured |
| Search field | 18 / 24 | 400 | Browser measured; 49 px field |
| Search category chips | 14 / 20 | 400 | CSS reviewed; horizontally scrollable |
| Settings header | 18 / 24 | 600 | Browser measured |
| Settings groups and rows | 18 / 24 | 400 | Browser measured; 55 px minimum row |
| Settings detail / editor | 16 / 22–24 | 400 | CSS reviewed |
| Settings captions | 14 / 21 | 400 | CSS reviewed |
| Library cards | 17 / 24 title; 13 / 20 detail | 500 / 400 | Source reviewed; no matching current APK capture |
| Custom Endpoint title | 24 / 32 | 500 | Browser measured; app-specific screen |
| Custom Endpoint inputs / SDK buttons | 16 / 22; 14 / 14 | 400 / 500 | Browser measured; SDK styling retained |
| Chat body | 16 / 26.4 | 400 | Source reviewed; no matching current APK capture |
| General dialog heading / copy | 23 / 32.2; 15 / 24 | 600 / 400 | Source reviewed; needs per-dialog native reference |
| Temporary chat title / copy | 22 / 28; 14 / 20 | 500 / 400 | Existing capture-based styles retained |

No global font enlargement or heavier body text was introduced. Exact native font rasterization, Android accessibility font scaling, every Settings subpage, dialogs and chat body parity remain unverified. This audit does **not** certify full-app pixel parity.

## Corrections

- Replaced inline sidebar title filtering with a full-screen search surface.
- Empty query shows recent local files/notes, newest first. It shows an honest empty state when there are none.
- File rows show actual names plus type: Dokumen, Video, HTML, Gambar or Audio; MIME and extension fallbacks cover unnamed MIME types.
- Non-empty queries expose the APK category model and group matching chats, files and projects. Search covers saved chat text and note text; archived chats are excluded. Files/projects remain local, without fabricated cloud results.
- A chat opens its saved conversation. A project opens its local project. Text/HTML files render as inert text, and stored files can be downloaded; HTML is never executed as preview content.
- Closing search restores sidebar focus. Sidebar history remains classified as Disematkan and Terkini; empty classes are omitted.
- Search layout from the capture: 16 px list edge, 41 px icon tile, 16 px tile/text gap, 73.5 px row, 34 px footer edge, 12 px footer gap, 49 px input/close button. Measurements are normalized estimates.

## Verification

- Unit tests cover file classification/order, category filtering, title/content search, Unicode normalization, archived exclusion, malformed storage and pinned/recent sidebar sections.
- Browser checked search entry, query results, document-filter empty state, close/focus restoration, home/Settings/endpoint typography and narrow-screen overflow.
- The current preview has no saved files. Live row geometry was measured using real saved chat results; file-type mapping was tested with isolated fixtures rather than inserting fake library data.
- All 101 automated tests passed. Production build, TypeScript and SDK stylesheet layer-order check passed. Browser search at 320 px width had no document overflow; 390 × 813 preview was restored afterward.
