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
