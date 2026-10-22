import { readFileSync } from 'node:fs';

export const MAX_BODY = 32 * 1024 * 1024;
export class SdkInputError extends Error {}
export const inputError = message => new SdkInputError(message);
export function loadMcpProfiles() {
  if (!process.env.SUPERGPT_MCP_CONFIG) return [];
  const profiles = JSON.parse(readFileSync(process.env.SUPERGPT_MCP_CONFIG, 'utf8'));
  if (!Array.isArray(profiles) || profiles.length > 16) throw inputError('Konfigurasi MCP harus daftar maksimal 16 server.');
  const names = new Set();
  return profiles.map(profile => {
    if (!profile || !/^[a-zA-Z0-9_-]{1,64}$/.test(profile.name) || names.has(profile.name)) throw inputError('Nama server MCP tidak valid atau duplikat.');
    names.add(profile.name); const headers = profile.headers || {};
    if (!headers || typeof headers !== 'object' || Array.isArray(headers) || Object.entries(headers).some(([key, value]) => !/^[a-zA-Z0-9-]+$/.test(key) || typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value))) throw inputError('Header MCP tidak valid.');
    return { name: profile.name, url: safeUrl(profile.url), googleWrite: profile.googleWrite === true, headers };
  });
}
export function safeUrl(value) {
  const url = new URL(value);
  const local = ['localhost', '[::1]'].includes(url.hostname) || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.hash || url.search) throw inputError('URL SDK harus HTTPS atau localhost/Tailscale tanpa kredensial.');
  return url.toString().replace(/\/+$/, '');
}
export function validateSession(input) {
  const p = input?.provider, o = input?.options || {};
  if (!p || typeof p.model !== 'string' || !p.model.trim() || p.model.length > 160 || typeof p.key !== 'string' || p.key.length > 4096 || /[\r\n]/.test(p.key)) throw inputError('Model dan kredensial endpoint tidak valid.');
  if (!/^[a-zA-Z0-9_-]{24,100}$/.test(input.owner)) throw inputError('Identitas penyimpanan tidak valid.');
  const models = [...new Set([p.model, ...(Array.isArray(p.models) ? p.models : [])])].filter(value => typeof value === 'string' && value.length <= 160).slice(0, 100);
  const responses = o.api === 'responses';
  const options = { api: responses ? 'responses' : 'chat', tools: o.tools === true, vision: o.vision === true, pdf: responses && o.pdf === true, web: o.web === true && (responses || o.webSearch === 'exa'), webSearch: o.webSearch === 'exa' ? 'exa' : 'provider', code: responses && o.code === true, images: responses && o.images === true,
    vectorStores: responses && Array.isArray(o.vectorStores) ? o.vectorStores.filter(value => /^vs_[a-zA-Z0-9_-]{1,120}$/.test(value)).slice(0, 5) : [],
    mcp: o.mcp === true, timeoutSeconds: typeof o.timeoutSeconds === 'number' && Number.isFinite(o.timeoutSeconds) ? Math.max(1, Math.min(3600, Math.round(o.timeoutSeconds))) : 120, transcriptionModel: typeof o.transcriptionModel === 'string' ? o.transcriptionModel.slice(0, 160) : '', realtimeModel: typeof o.realtimeModel === 'string' ? o.realtimeModel.slice(0, 160) : '',
    instructions: typeof o.instructions === 'string' ? o.instructions.slice(0, 20000) : '', sendReasoning: p.sendReasoning === true, reasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(o.reasoningEffort) ? o.reasoningEffort : 'medium' };
  const mcpProfiles = Array.isArray(input.mcp) ? input.mcp.slice(0, 16).map((profile, index) => {
    if (typeof profile?.name !== 'string' || !profile.name.trim() || profile.name.length > 80) throw inputError('Nama MCP tidak valid.');
    const token = profile.token || '';
    if (typeof token !== 'string' || token.length > 4096 || /[\r\n]/.test(token)) throw inputError('Token MCP tidak valid.');
    return { name: 'plugin_' + index + '_' + profile.name.replace(/[^a-zA-Z0-9_]/g, '_'), url: safeUrl(profile.url), googleWrite: profile.googleWrite === true, headers: token ? { Authorization: 'Bearer ' + token } : {} };
  }) : [];
  return { owner: input.owner, provider: { baseUrl: safeUrl(p.baseUrl), model: p.model, models, key: p.key }, options, mcpProfiles };
}
