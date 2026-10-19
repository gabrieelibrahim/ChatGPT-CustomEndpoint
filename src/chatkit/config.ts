export type SdkOptions = {
  api: 'chat' | 'responses'; tools: boolean; vision: boolean; pdf: boolean; web: boolean; code: boolean; images: boolean; mcp: boolean;
  vectorStores: string[]; transcriptionModel: string; realtimeModel: string; webSearch?: 'exa' | 'provider';
};
export type SdkConfig = { server: string; domainKey: string; options: SdkOptions };
export const sdkConfigKey = 'supergpt-sdk-config-v1';
export const defaultSdkConfig = (): SdkConfig => ({ server: '', domainKey: 'domain_pk_localhost_dev', options: { api: 'chat', tools: true, vision: false, pdf: false, web: false, code: false, images: false, mcp: false, vectorStores: [], transcriptionModel: '', realtimeModel: '' } });
export function sdkServer(value: string) {
  if (!value.trim()) return location.origin;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw Error('Gunakan URL server HTTPS atau localhost.');
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Masukkan origin server, tanpa path, login, atau query.');
  return url.origin;
}
export function loadSdkConfig(): SdkConfig {
  const defaults = defaultSdkConfig();
  try {
    const raw = JSON.parse(localStorage.getItem(sdkConfigKey) || 'null'); if (!raw) return defaults;
    const options = raw.options || {};
    for (const key of ['tools', 'vision', 'pdf', 'web', 'code', 'images', 'mcp'] as const) defaults.options[key] = options[key] === true;
    defaults.options.api = options.api === 'responses' ? 'responses' : 'chat';
    defaults.options.vectorStores = Array.isArray(options.vectorStores) ? options.vectorStores.filter((value: unknown): value is string => typeof value === 'string' && /^vs_[a-zA-Z0-9_-]+$/.test(value)).slice(0, 5) : [];
    for (const key of ['transcriptionModel', 'realtimeModel'] as const) if (typeof options[key] === 'string') defaults.options[key] = options[key].slice(0, 160);
    if (typeof raw.server === 'string') { sdkServer(raw.server); defaults.server = raw.server; }
    if (typeof raw.domainKey === 'string') defaults.domainKey = raw.domainKey.slice(0, 300);
    return defaults;
  } catch { return defaults; }
}
export function sdkOwner() {
  const key = 'supergpt-sdk-owner-v1', stored = localStorage.getItem(key);
  if (stored && /^[a-zA-Z0-9_-]{24,100}$/.test(stored)) return stored;
  const owner = crypto.randomUUID().replaceAll('-', ''); localStorage.setItem(key, owner); return owner;
}
