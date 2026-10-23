import { googleWorkspace } from './googleWorkspace';
export type PluginTemplate = {
  id: string; name: string; description: string; categories: string[]; icon?: string;
  url?: string; auth: 'public' | 'token' | 'oauth' | 'custom' | 'builtin';
  website?: string; docs?: string; developer?: string; examples?: string[];
  provider?: 'google';
};
export const pluginCategories = ['Populer', 'Baru & Patut Dicoba', 'Usaha Kecil', 'Produktivitas', 'Kreativitas', 'Alat Pengembang', 'Bisnis & Operasional', 'Data & Analitika', 'Komunikasi', 'Pendidikan', 'Penelitian Ilmiah', 'Keamanan', 'Keuangan', 'Kesehatan', 'Perjalanan', 'Lainnya'];
const entry = (id: string, name: string, description: string, categories: string[], extra: Partial<PluginTemplate> = {}): PluginTemplate => ({ id, name, description, categories, auth: 'custom', ...extra });
function googleEntry(id: string): PluginTemplate {
  const service = googleWorkspace.find(item => item.id === id)!;
  return entry(service.id, service.name, service.description, service.categories, { icon: service.icon, provider: 'google', auth: 'oauth', url: service.url, developer: 'SuperGPT · Google API', website: 'https://developers.google.com/workspace', docs: 'https://developers.google.com/identity/protocols/oauth2', examples: service.id === 'gmail' ? ['Ringkas 5 email terbaru dan soroti keputusan serta pertanyaan terbuka.', 'Buat draf balasan untuk email yang saya pilih.'] : [`Cari informasi yang relevan melalui ${service.name} dan sertakan sumbernya.`, `Bantu saya memakai ${service.name} untuk tugas berikut.`] });
}
// Names/categories for custom-URL templates follow the supplied catalog recording.
// Only documented remote MCP endpoints are prefilled. A catalog entry is not an installed connection.
export const pluginCatalog: PluginTemplate[] = [
  googleEntry('gmail'),
  entry('remote-desktop', 'Remote Desktop Commander', 'Use your computer from chat', ['Populer'], { icon: 'remote' }),
  googleEntry('google-drive'),
  ...googleWorkspace.filter(item => !['gmail', 'google-drive'].includes(item.id)).map(item => googleEntry(item.id)),
  entry('flaim', 'Flaim Fantasy', 'Fantasy Sports Analysis', ['Populer'], { icon: 'flame' }),
  entry('magnific', 'Magnific', 'Create images, video, designs', ['Baru & Patut Dicoba']),
  entry('higgsfield', 'Higgsfield', 'Every image and video model', ['Baru & Patut Dicoba', 'Kreativitas']),
  entry('tripo', 'Tripo 3D', 'From Text/Image to 3D Models', ['Baru & Patut Dicoba']),
  entry('common-room', 'Common Room', 'Find contacts and accounts', ['Baru & Patut Dicoba']),
  entry('dropbox', 'Dropbox', 'Find, create, and take action', ['Usaha Kecil']),
  entry('hubspot', 'HubSpot', 'Insights to action in HubSpot', ['Usaha Kecil']),
  entry('stripe', 'Stripe', 'Accept payments. Grow revenue.', ['Usaha Kecil'], { auth: 'token', url: 'https://mcp.stripe.com', docs: 'https://docs.stripe.com/mcp', developer: 'Stripe' }),
  entry('canva', 'Canva', 'Create, review, edit designs', ['Usaha Kecil', 'Kreativitas'], { icon: 'canva', auth: 'oauth', url: 'https://mcp.canva.com/mcp', docs: 'https://www.canva.dev/docs/mcp/', developer: 'Canva' }),
  entry('firecrawl', 'Firecrawl', 'Search and extract web data', ['Produktivitas'], { icon: 'flame', website: 'https://www.firecrawl.dev/' }),
  entry('granola', 'Granola', 'Add your meeting context', ['Produktivitas'], { auth: 'oauth', url: 'https://mcp.granola.ai/mcp', docs: 'https://docs.granola.ai/help-center/sharing/integrations/mcp', developer: 'Granola' }),
  entry('klaviyo', 'Klaviyo', 'Get insights on your marketing', ['Produktivitas'], { auth: 'oauth', url: 'https://mcp.klaviyo.com/mcp', docs: 'https://developers.klaviyo.com/en/docs/klaviyo_mcp_server', developer: 'Klaviyo' }),
  entry('notion', 'Notion', 'Create docs, tasks, databases', ['Produktivitas'], { auth: 'oauth', url: 'https://mcp.notion.com/mcp', docs: 'https://developers.notion.com/guides/mcp/get-started-with-mcp', developer: 'Notion' }),
  entry('runway', 'Runway', 'Generate with every AI model', ['Kreativitas']),
  entry('mobbin', 'Mobbin', 'Find UI & UX design references', ['Kreativitas']),
  entry('github', 'GitHub', 'Triage PRs, issues, CI, and publish', ['Alat Pengembang'], { auth: 'token', url: 'https://api.githubcopilot.com/mcp/', docs: 'https://github.com/github/github-mcp-server', developer: 'GitHub', examples: ['Ringkas issue terbuka di repositori yang saya pilih.', 'Periksa hasil workflow CI terbaru.', 'Baca perubahan pull request dan jelaskan risikonya.'] }),
  entry('supabase', 'Supabase', 'Manage and query databases', ['Alat Pengembang'], { auth: 'oauth', url: 'https://mcp.supabase.com/mcp', docs: 'https://supabase.com/docs/guides/getting-started/mcp', developer: 'Supabase' }),
  entry('exa', 'Exa', 'Web search for AI agents', ['Alat Pengembang'], { auth: 'public', url: 'https://mcp.exa.ai/mcp', docs: 'https://docs.exa.ai/reference/exa-mcp', developer: 'Exa' }),
  entry('render', 'Render', 'Build and deploy apps & agents', ['Alat Pengembang'], { auth: 'token', url: 'https://mcp.render.com/mcp', docs: 'https://render.com/docs/mcp-server', developer: 'Render' }),
  entry('windsor', 'Windsor.ai', 'Connect 350+ data sources', ['Bisnis & Operasional']),
  entry('upwork', 'Upwork', 'Hire and find work on Upwork', ['Bisnis & Operasional']),
  entry('shopify', 'Shopify', 'Create and manage your store', ['Bisnis & Operasional']),
  entry('adspirer', 'Adspirer', 'Create, launch & analyze ads', ['Bisnis & Operasional']),
  entry('posthog', 'PostHog', 'Analyze your product data', ['Data & Analitika'], { auth: 'oauth', url: 'https://mcp.posthog.com/mcp', docs: 'https://posthog.com/docs/model-context-protocol', developer: 'PostHog' }),
  entry('data', 'Data', 'Answer questions with data', ['Data & Analitika']),
  entry('gsc', 'GSC SEO & Content Planner', 'Analyze Search Console SEO', ['Data & Analitika']),
  entry('typeform', 'Typeform', 'Build forms, analyze responses', ['Data & Analitika']),
  entry('outlook', 'Outlook Email', 'Triage Outlook inboxes', ['Komunikasi'], { icon: 'mail' }),
  entry('slack', 'Slack', 'Read and manage Slack', ['Komunikasi'], { icon: 'slack' }),
  entry('superhuman', 'Superhuman Mail', 'Best email-calendar assistant', ['Komunikasi'], { icon: 'mail' }),
  entry('brevo', 'Brevo', 'Access campaigns and contacts', ['Komunikasi']),
  entry('consensus', 'Consensus', 'Search peer-reviewed research', ['Pendidikan']),
  entry('courtlistener', 'CourtListener', 'Legal research for everyone', ['Pendidikan']),
  entry('acumen', 'Acumen by Talarion', 'Keep your AI up to date', ['Pendidikan']),
  entry('explain', 'Explain Video Generator', 'Free AI explainer video maker', ['Pendidikan']),
  entry('undermind', 'Undermind', 'Find and read research papers', ['Penelitian Ilmiah']),
  entry('tamarind', 'Tamarind Bio', 'The protein and molecular design copilot', ['Penelitian Ilmiah']),
  entry('ngs', 'NGS Analysis Workbench', 'Analyze sequencing data', ['Penelitian Ilmiah']),
  entry('proto', 'Proto', 'Biological AI models and tools', ['Penelitian Ilmiah']),
  entry('codex-security', 'Codex Security', 'Security scanning for your codebase', ['Keamanan'], { icon: 'shield' }),
  entry('malwarebytes', 'Malwarebytes', 'Verify links, domains, phones', ['Keamanan']),
  entry('privacyhawk', 'PrivacyHawk', 'Protect your personal data', ['Keamanan']),
  entry('ajaxx', 'AJAXX Data Scrubber', 'Remove exposed personal data', ['Keamanan']),
  entry('iol', 'IOL invertironline', 'Trade Argentine investments', ['Keuangan']),
  entry('ibkr', 'Interactive Brokers (IBKR)', 'Analyze global markets', ['Keuangan']),
  entry('qbo', 'QBO Connector by Meridian', 'Read and update QuickBooks', ['Keuangan']),
  entry('alpha-vantage', 'Alpha Vantage', 'Global stock market data', ['Keuangan']),
  entry('tredict', 'Tredict', 'Analyze workouts, create plans', ['Kesehatan']),
  entry('fitness', 'Fitness AI Connector', 'AI coach for your Garmin data', ['Kesehatan']),
  entry('coros', 'COROS', 'Training and health insights', ['Kesehatan']),
  entry('freddy', 'freddy', 'Ask about your health data', ['Kesehatan']),
  entry('skyscanner', 'Skyscanner', 'Find cheap flights', ['Perjalanan']),
  entry('flightpoints', 'FlightPoints', 'Find award flights', ['Perjalanan']),
  entry('flight-network', 'Flight Network', 'Search and book flights', ['Perjalanan']),
  entry('trivago', 'trivago', 'Find your ideal hotel, fast.', ['Perjalanan']),
  entry('destiny', 'Destiny AI Astrology', 'Birth Charts & Horoscopes', ['Lainnya']),
  entry('chessy', 'Chessy', 'Play Chess Against ChatGPT', ['Lainnya']),
  entry('pc-control', 'PC Toplama Araci', 'Sistem toplama ve PC parcalari', ['Lainnya']),
  entry('smart-chess', 'Smart Chess:Train+Learn to...', 'Smart gameplay and coaching', ['Lainnya']),
  // Remote MCP servers verified on 2026-10-23 to offer OAuth discovery, PKCE and dynamic client registration.
  entry('linear', 'Linear', 'Kelola issue, proyek, dan siklus tim', ['Populer', 'Produktivitas', 'Alat Pengembang'], { auth: 'oauth', url: 'https://mcp.linear.app/mcp', docs: 'https://linear.app/docs/mcp', developer: 'Linear' }),
  entry('atlassian', 'Atlassian', 'Jira dan Confluence: issue dan halaman', ['Populer', 'Produktivitas', 'Bisnis & Operasional'], { auth: 'oauth', url: 'https://mcp.atlassian.com/v1/mcp', docs: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/', developer: 'Atlassian' }),
  entry('airtable', 'Airtable', 'Baca dan ubah base serta record', ['Produktivitas', 'Data & Analitika'], { auth: 'oauth', url: 'https://mcp.airtable.com/mcp', docs: 'https://support.airtable.com/docs/using-the-airtable-mcp-server', developer: 'Airtable' }),
  entry('zapier', 'Zapier', 'Jalankan aksi di ribuan aplikasi', ['Populer', 'Produktivitas', 'Bisnis & Operasional'], { auth: 'oauth', url: 'https://mcp.zapier.com/api/mcp/mcp', docs: 'https://help.zapier.com/hc/en-us/articles/36265392843917', developer: 'Zapier' }),
  entry('intercom', 'Intercom', 'Cari percakapan dan data pelanggan', ['Komunikasi', 'Bisnis & Operasional'], { auth: 'oauth', url: 'https://mcp.intercom.com/mcp', docs: 'https://developers.intercom.com/docs/guides/mcp', developer: 'Intercom' }),
  entry('paypal', 'PayPal', 'Invoice, pesanan, dan transaksi', ['Usaha Kecil', 'Keuangan'], { auth: 'oauth', url: 'https://mcp.paypal.com/mcp', docs: 'https://developer.paypal.com/tools/mcp-server/', developer: 'PayPal' }),
  entry('square', 'Square', 'Pembayaran, katalog, dan pesanan toko', ['Usaha Kecil', 'Keuangan'], { auth: 'oauth', url: 'https://mcp.squareup.com/mcp', docs: 'https://developer.squareup.com/docs/mcp', developer: 'Square' }),
  entry('webflow', 'Webflow', 'Kelola situs, halaman, dan CMS', ['Kreativitas', 'Usaha Kecil'], { auth: 'oauth', url: 'https://mcp.webflow.com/mcp', docs: 'https://developers.webflow.com/mcp/reference/overview', developer: 'Webflow' }),
  entry('wix', 'Wix', 'Kelola situs dan bisnis Wix', ['Usaha Kecil', 'Kreativitas'], { auth: 'oauth', url: 'https://mcp.wix.com/mcp', docs: 'https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp', developer: 'Wix' }),
  entry('netlify', 'Netlify', 'Buat proyek dan deploy situs', ['Alat Pengembang'], { auth: 'oauth', url: 'https://netlify-mcp.netlify.app/mcp', docs: 'https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/', developer: 'Netlify' }),
  entry('neon', 'Neon', 'Database Postgres serverless', ['Alat Pengembang'], { auth: 'oauth', url: 'https://mcp.neon.tech/mcp', docs: 'https://neon.com/docs/ai/neon-mcp-server', developer: 'Neon' }),
  entry('gitlab', 'GitLab', 'Issue, merge request, dan pipeline', ['Alat Pengembang'], { auth: 'oauth', url: 'https://gitlab.com/api/v4/mcp', docs: 'https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/', developer: 'GitLab' }),
  entry('cloudflare-workers', 'Cloudflare Workers', 'Workers, KV, R2, dan D1 akunmu', ['Alat Pengembang'], { auth: 'oauth', url: 'https://bindings.mcp.cloudflare.com/mcp', docs: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/', developer: 'Cloudflare' }),
  entry('amplitude', 'Amplitude', 'Analisis produk dan perilaku pengguna', ['Data & Analitika'], { auth: 'oauth', url: 'https://mcp.amplitude.com/mcp', docs: 'https://amplitude.com/docs/amplitude-ai/amplitude-mcp', developer: 'Amplitude' }),
  entry('ahrefs', 'Ahrefs', 'Riset SEO, kata kunci, dan backlink', ['Data & Analitika'], { auth: 'oauth', url: 'https://api.ahrefs.com/mcp/mcp', docs: 'https://docs.ahrefs.com/docs/mcp/reference/introduction', developer: 'Ahrefs' }),
  entry('similarweb', 'Similarweb', 'Trafik dan pasar situs web', ['Data & Analitika'], { auth: 'oauth', url: 'https://mcp.similarweb.com', docs: 'https://developers.similarweb.com/docs/similarweb-mcp', developer: 'Similarweb' }),
  entry('supermetrics', 'Supermetrics', 'Data iklan dan pemasaran lintas kanal', ['Data & Analitika'], { auth: 'oauth', url: 'https://mcp.supermetrics.com/mcp', docs: 'https://docs.supermetrics.com/docs/mcp-server', developer: 'Supermetrics' }),
  entry('fireflies', 'Fireflies.ai', 'Transkrip dan ringkasan rapat', ['Produktivitas', 'Komunikasi'], { auth: 'oauth', url: 'https://api.fireflies.ai/mcp', docs: 'https://docs.fireflies.ai/getting-started/mcp-configuration', developer: 'Fireflies.ai' }),
  entry('learn', 'Microsoft Learn', 'Dokumentasi Microsoft dan Azure', ['Alat Pengembang'], { auth: 'public', icon: 'microsoft', url: 'https://learn.microsoft.com/api/mcp', docs: 'https://learn.microsoft.com/en-us/training/support/mcp-developer-reference', developer: 'Microsoft' }),
  entry('cloudflare', 'Cloudflare Docs', 'Dokumentasi Workers dan Cloudflare', ['Alat Pengembang'], { auth: 'public', url: 'https://docs.mcp.cloudflare.com/mcp', docs: 'https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/', developer: 'Cloudflare' }),
  entry('deepwiki', 'DeepWiki', 'Tanya dokumentasi repositori publik', ['Alat Pengembang'], { auth: 'public', icon: 'book', url: 'https://mcp.deepwiki.com/mcp', docs: 'https://docs.devin.ai/work-with-devin/deepwiki-mcp', developer: 'Cognition' }),
  entry('context7', 'Context7', 'Dokumentasi library untuk developer', ['Alat Pengembang'], { auth: 'token', icon: 'book', url: 'https://mcp.context7.com/mcp', docs: 'https://context7.com/docs/resources/all-clients', developer: 'Upstash' }),
  entry('huggingface', 'Hugging Face', 'Temukan model, dataset, dan paper', ['Alat Pengembang', 'Penelitian Ilmiah'], { auth: 'token', url: 'https://huggingface.co/mcp', docs: 'https://huggingface.co/docs/hub/en/agents-mcp', developer: 'Hugging Face' }),
  entry('sentry', 'Sentry', 'Cari dan telusuri error aplikasi', ['Alat Pengembang'], { auth: 'oauth', url: 'https://mcp.sentry.dev/mcp', docs: 'https://mcp.sentry.dev', developer: 'Sentry' }),
  entry('vercel', 'Vercel', 'Proyek, deployment, dan log', ['Alat Pengembang'], { auth: 'oauth', url: 'https://mcp.vercel.com', docs: 'https://vercel.com/docs/agent-resources/vercel-mcp', developer: 'Vercel' }),
];
export const builtinPlugins: PluginTemplate[] = [
  entry('browser', 'Browser', 'Cari web dari chat utama', [], { auth: 'builtin', icon: 'globe', examples: ['Cari sumber terbaru untuk topik yang saya pilih dan sertakan tautannya.'] }),
  entry('templates', 'Default templates', 'Contoh prompt untuk memulai obrolan', [], { auth: 'builtin', icon: 'templates', examples: ['Bantu susun rencana kerja dengan langkah dan prioritas yang jelas.', 'Ringkas teks berikut dengan keputusan, risiko, dan langkah berikutnya.', 'Tinjau kode berikut dan jelaskan kemungkinan bug.'] }),
  entry('pages', 'Pages', 'Catatan lokal yang bisa dipakai di chat', [], { auth: 'builtin', icon: 'spaces' }),
  entry('plugin-management', 'Plugin Management', 'Kelola koneksi dan jelajahi plugin', [], { auth: 'builtin', icon: 'management' }),
];
export const mcpTemplates = pluginCatalog.filter(item => item.url);
export function findPlugin(id: string) { return [...builtinPlugins, ...pluginCatalog].find(item => item.id === id); }
export function filterPlugins(query: string, category?: string) {
  const term = query.trim().toLocaleLowerCase('id-ID');
  return pluginCatalog.filter(item => (!category || item.categories.includes(category)) && (!term || [item.name, item.description, ...item.categories].join(' ').toLocaleLowerCase('id-ID').includes(term)));
}
