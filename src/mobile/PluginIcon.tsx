import { UIIcon } from '../components/UIIcon';
const assets = new Set(['dropbox', 'hubspot', 'stripe', 'notion', 'supabase', 'render', 'posthog', 'typeform', 'brevo', 'trivago', 'shopify', 'upwork', 'figma', 'gitlab', 'sentry', 'vercel', 'cloudflare', 'huggingface', 'linear', 'atlassian', 'asana', 'googledocs', 'googlesheets', 'googleslides', 'malwarebytes']);
const colors: Record<string, string> = { magnific: '#eee', higgsfield: '#d6ff00', tripo: '#e1d42d', 'common-room': '#fff', granola: '#b8cb42', klaviyo: '#f57667', canva: '#00c4cc', data: '#7eaeff', 'codex-security': '#4b86ef', consensus: '#19b7bc', tamarind: '#9bdcb9', fitness: '#5ee3ba', skyscanner: '#1687ff', flightpoints: '#509bfa', 'flight-network': '#4e56ff', templates: '#67d6f6', management: '#58e0c6', 'plugin-management': '#58e0c6' };
export function PluginIcon({ id, name, icon }: { id: string; name: string; icon?: string }) {
  const symbol = icon || id;
  let content;
  if (assets.has(symbol)) content = <img src={'/plugin-icons/' + symbol + '.svg'} alt="" loading="lazy" draggable={false}/>;
  else if (['gmail', 'drive', 'github', 'globe', 'spaces', 'book', 'shield', 'mail', 'comment'].includes(symbol)) content = <UIIcon name={symbol}/>;
  else if (symbol === 'flame') content = <svg viewBox="0 0 24 24" fill="none" stroke="#ff9250" strokeWidth="1.7"><path d="M13 2c2 6-3 7-1 11 2-1 3-3 3-5 5 4 6 8 3 11-4 4-12 2-12-4 0-4 5-6 7-13Z"/></svg>;
  else if (symbol === 'templates') content = <svg viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="12" height="28" rx="4" fill="#25c7f3"/><path d="m9 20 10-15a5 5 0 0 1 7 0l4 4a5 5 0 0 1 0 7L16 30H9Z" fill="#f56b88"/><path d="M17 21h11a3 3 0 0 1 3 3v6H15Z" fill="#fbd22e"/></svg>;
  else if (symbol === 'microsoft') content = <svg viewBox="0 0 24 24"><path fill="#f35325" d="M1 1h10v10H1Z"/><path fill="#81bc06" d="M13 1h10v10H13Z"/><path fill="#05a6f0" d="M1 13h10v10H1Z"/><path fill="#ffba08" d="M13 13h10v10H13Z"/></svg>;
  else if (symbol === 'slack') content = <svg viewBox="0 0 24 24" fill="none" strokeWidth="3.8" strokeLinecap="round"><path stroke="#36c5f0" d="M3 9h6M9 3v2"/><path stroke="#2eb67d" d="M15 3v6M21 9h-2"/><path stroke="#ecb22e" d="M21 15h-6M15 21v-2"/><path stroke="#e01e5a" d="M9 21v-6M3 15h2"/></svg>;
  else if (symbol === 'management') content = <span className="m-plugin-flower">✣</span>;
  else content = <span className="m-plugin-monogram" style={{ color: colors[id] || 'var(--m-text)' }}>{id === 'remote-desktop' ? 'D↗' : name.slice(0, 2).trim()}</span>;
  return <span className={'m-plugin-icon m-plugin-icon-' + symbol} data-plugin-icon={id} aria-hidden="true">{content}</span>;
}
