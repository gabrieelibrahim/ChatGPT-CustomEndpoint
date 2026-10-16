# Official Apps SDK UI icons

Source: https://github.com/openai/apps-sdk-ui
Revision: `0f00143c7a639906f1621fe58e1b6be7b5bea46d` (package version 0.2.2).
Upstream path: `src/components/Icon/svg/`.

The selected React SVG files are copied unchanged. `index.ts` maps the existing
application icon names to them; `UIIcon.tsx` preserves sizes, colors and accessibility.
The SVGs use filled paths, so the wrapper explicitly disables inherited strokes.
No Apps SDK UI global CSS, components or additional runtime dependencies are imported.

Licensed under MIT, copyright 2025 OpenAI. See LICENSE. The same license is shipped
in the production build at `/third-party/apps-sdk-ui-LICENSE.txt`.

Reference-specific symbols without a suitable match (including the approved round
Plugins symbol, approval shield, numbered panels, library, goal, cloud and native
window buttons) remain local. The upstream Plugin is a different puzzle symbol.
Third-party provider logos remain separate. This does not imply OpenAI affiliation.
