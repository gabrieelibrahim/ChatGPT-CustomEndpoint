# Plugin catalog marks

Each plugin shows its own brand mark, named by plugin id (`<id>.svg` or `<id>.png`) and mapped in `src/mobile/PluginIcon.tsx`. Retrieved 2026-10-22:

- Google products (`gmail`, `google-*`, `gsc`): Google's own product logo SVGs from `ssl.gstatic.com/images/branding/productlogos`.
- Full-colour marks from SVG Logos (gilbarbara/logos, CC0-1.0): dropbox, firecrawl, notion, github, supabase, exa, shopify, posthog, typeform, slack, codex-security (OpenAI), learn (Microsoft), cloudflare, huggingface, sentry, vercel; added 2026-10-23: linear, atlassian, airtable, intercom, paypal, netlify, neon, gitlab, amplitude.
- Simple Icons (CC0-1.0) with the brand's own colour: hubspot, stripe, canva, render, upwork, outlook, brevo, malwarebytes, qbo (QuickBooks), trivago; added 2026-10-23: zapier, webflow, wix, similarweb, square.
- Lobe Icons (MIT): tripo, runway.
- Brand website icons added 2026-10-23: ahrefs, fireflies, supermetrics. `cloudflare-workers` reuses the Cloudflare mark.
- The rest come from the brand's own website icon (favicon / apple-touch-icon), raster icons scaled to at most 96 px.

LICENSE.md covers the CC0 sets. Brand names and marks remain the property of their owners and only identify which service a plugin connects to. Plugins without a verified mark show their initials. No remote icon service is contacted at runtime.
