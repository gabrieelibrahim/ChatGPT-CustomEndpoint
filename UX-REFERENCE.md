# UX reference pass

Source: user-supplied `20261016-0429-39.0909069.mp4`, 1920 × 874, 30 fps, approximately 76.3 seconds. The browser toolbar is absent from this recording.

## Observations used

| Sample time | Visible state | Applied behavior |
| --- | --- | --- |
| 17 s | Images gallery with Trending/Templates, ten style thumbnails and bottom composer | Gallery, tabs, style selection and anchored image composer |
| 20 s | Scheduled input, Active filter and recommended rows | Matching page structure; recommendations fill the local input |
| 25 s | Library toolbar, category tabs and masonry loading cards | Toolbar, filtering, grid/list control and transient local loading state |
| 29 s | Plugins/Skills header, full-width search, Installed, Public/Personal, Popular | Catalog layout and local tab/search interactions |
| 39 s | Sidebar scrolled while New chat and Images remain visible | Two fixed navigation rows with independently scrollable remainder |
| 57 s | Collapsed sidebar, panel icon and shortcut tooltip on hover | Hover replacement of the logo, toggle shortcut, compact rail |
| 70 s | Expanded sidebar after collapse | Expand/collapse and centered main content |

Sidebar boundary dragging, row hover actions, Recents collapse and the Explore → Maps popover are also implemented. Pinning applies to local preview conversations only. Ctrl+Shift+S toggles the sidebar and Ctrl+Shift+O starts a new local chat. These shortcuts are available when the browser allows the page to receive them.

## Assets

`public/reference-images/style-*.webp` are still-frame excerpts from the supplied recording, including the visible card captions. They are reference tiles, not regenerated images or original editable source artwork. Gmail and Health thumbnails are likewise excerpts; GitHub uses the existing SVG and Drive uses a drawn SVG.

## Verification limits

TypeScript/production build and server rendering checks pass. Browser screenshot comparison remains unavailable in this session, so visual identity is not established. The 180 ms sidebar transition and 130 ms page fade are implementation estimates, not measured frame-exact timings. The observed Library network loading duration is not reproduced as an indefinite loading state; the preview resolves to its local data/empty state.

Real task scheduling, image generation, connector installation, browser-tab access and Maps data are not connected. The Work modal retains the requested unavailable message.

## Newer desktop recording — 2026-10-16 13:27:50

Reference: user-supplied `Screen Recording 2026-10-16 132750.mp4`, 1920 x 1008, 30 fps, 127.6 seconds. This is a separate reference from the classic video above. It was reviewed using 26 overview samples and targeted full-resolution frames; the video itself is not committed.

| Approximate time | Observed interaction | Implemented local behavior |
| --- | --- | --- |
| 0-15 s | Rail/titlebar tooltip labels | Root-anchored tooltip portals and shortcut hints |
| 15-24 s | More row hover and navigation pins | Row highlight and saved sidebar pin toggles |
| 37-50 s | Projects/Recents heading hover | Chevron, options, add/new-chat controls and collapse |
| 51-69 s | Chat hover card and pin/archive tooltips | Delayed hover preview, local pin/archive actions |
| 74-89 s | Turn markers with previews | User-turn markers, reply snippets and smooth jumps |
| 91-103 s | Message actions and conversation scroll | Copy, read aloud, feedback preview and latest-scroll control |
| 111-113 s | Full-width Add menu | Composer-anchored menu with files, commands, sketch and plugin selection |
| 121-124 s | User-message hover controls | Timestamp, copy and local editing |

The Add menu is measured against the actual composer position rather than a fixed screen coordinate. Hover delays and animation easing are estimates. Chrome access, plugin execution and agent functions remain unavailable or clearly local preview behavior. The patch is not a claim of pixel-identical native behavior.

Validation: TypeScript/production build and server-render smoke checks passed. Browser observation of the final patch was denied by the browser origin permission gate, so final browser screenshot/interaction QA remains outstanding.

## Main navigation recording — 2026-10-16 17:51:47

Reference: user-supplied `Screen Recording 2026-10-16 175147.mp4`, 1920 x 1008, 154 seconds. Reviewed in five-second overview samples, targeted full-resolution frames and denser samples around experience/mode switching. Frames and the video remain outside the repository.

| Approximate time | Observed behavior | Local implementation |
| --- | --- | --- |
| 5–19 s, 65–88 s | ChatGPT/Codex selector changes navigation while retaining the chat | Preserve conversation, draft and last view per experience; selected checkmark and keyboard menu focus |
| 23–35 s, 69–86 s | Sidebar closes and opens; collapsed header offers New chat | Preserve mounted sidebar, scroll and collapsed sections; hide from keyboard/accessibility tree while closed |
| 39–52 s | New chat and repeated Chat/Work switching | Distinct existing composers, sliding selection pill, Work tooltip and tab arrow navigation |
| 55–65 s, 90–108 s | Pinned visible in Codex and ChatGPT; sidebar headings/scroll | Pinned available and collapsible in both; existing Projects/Recents behaviors retained |
| 110–149 s | Search palette contains chats, actions, settings and navigation | Centered scrollable palette, local title/content filter, keyboard selection, local navigation and preview dialogs |

Back/Forward also restores local screens and conversation views. New chat clears the composer and focuses it; switching an experience does not silently start a new chat. The recording's changing greeting text and intermediate loading/reflow frames are not reproduced as random visual glitches. Existing static home suggestions and unrelated composer menus are preserved for a separate UI pass.

Validation: production build and DOM interaction checks passed for experience/draft restoration, separate homes, Chat/Work keyboard focus, sidebar node/scroll/collapse preservation, search filtering/Enter/Escape/empty results, local Back/Forward, palette navigation and temporary-chat shortcut. The DOM checks use a temporary test-only runtime outside the project and do not establish browser layout or exact native animation timing.
