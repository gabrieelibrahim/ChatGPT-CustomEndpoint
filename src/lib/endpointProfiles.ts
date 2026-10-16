export type EndpointProfile = {
  id: string; name: string; baseUrl: string; protocol: 'openai-compatible';
  model: string; models: string[]; auth: 'bearer' | 'none';
};
export type EndpointStore = { version: 1; profiles: EndpointProfile[]; selectedId: string | null };
export const endpointStorageKey = 'client-endpoint-profiles-v1';
export const endpointSecretsKey = 'client-endpoint-keys-v1';

export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw Error('Masukkan Base URL yang valid.'); }
  const loopback = url.hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw Error('Gunakan HTTPS, atau HTTP untuk server localhost.');
  if (url.username || url.password || url.search || url.hash) throw Error('Base URL tidak boleh berisi login, query, atau fragmen. Masukkan kunci pada kolom API key.');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|models)$/, '');
  return url.toString().replace(/\/+$/, '');
}

export function loadEndpointStore(): EndpointStore {
  const empty: EndpointStore = { version: 1, profiles: [], selectedId: null };
  try {
    const data = JSON.parse(localStorage.getItem(endpointStorageKey) || 'null');
    if (data?.version !== 1 || !Array.isArray(data.profiles)) return empty;
    const profiles: EndpointProfile[] = [];
    for (const value of data.profiles.slice(0, 50)) {
      if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 100 || Object.hasOwn(Object.prototype, value.id) || profiles.some(profile => profile.id === value.id) || typeof value.name !== 'string' || !value.name.trim() || typeof value.model !== 'string' || !value.model.trim() || typeof value.baseUrl !== 'string' || value.protocol !== 'openai-compatible') continue;
      try {
        const models = Array.isArray(value.models) ? value.models.filter((model: unknown): model is string => typeof model === 'string' && model.length <= 160).slice(0, 500) : [];
        profiles.push({ id: value.id, name: value.name.slice(0, 80), baseUrl: normalizeBaseUrl(value.baseUrl), protocol: 'openai-compatible', model: value.model.slice(0, 160), models, auth: value.auth === 'none' ? 'none' : 'bearer' });
      } catch { /* Ignore invalid stored profiles; never use them as request destinations. */ }
    }
    return { version: 1, profiles, selectedId: profiles.some(profile => profile.id === data.selectedId) ? data.selectedId : profiles[0]?.id || null };
  } catch { return empty; }
}

export function loadEndpointKeys(profiles: EndpointProfile[]): Record<string, string> {
  try {
    const data = JSON.parse(sessionStorage.getItem(endpointSecretsKey) || '{}');
    return Object.fromEntries(profiles.filter(profile => typeof data?.[profile.id] === 'string' && data[profile.id].length <= 4096).map(profile => [profile.id, data[profile.id]]));
  } catch { return {}; }
}

// Serialize explicit fields so credentials never enter persistent profile storage.
export function saveEndpointStore(store: EndpointStore, keys: Record<string, string>) {
  const profiles = store.profiles.map(({ id, name, baseUrl, protocol, model, models, auth }) => ({ id, name, baseUrl, protocol, model, models, auth }));
  const previousKeys = sessionStorage.getItem(endpointSecretsKey);
  sessionStorage.setItem(endpointSecretsKey, JSON.stringify(Object.fromEntries(profiles.filter(profile => profile.auth === 'bearer' && keys[profile.id]).map(profile => [profile.id, keys[profile.id]]))));
  try { localStorage.setItem(endpointStorageKey, JSON.stringify({ version: 1, profiles, selectedId: store.selectedId })); }
  catch (error) {
    try { if (previousKeys === null) sessionStorage.removeItem(endpointSecretsKey); else sessionStorage.setItem(endpointSecretsKey, previousKeys); } catch { /* Preserve the original storage failure. */ }
    throw error;
  }
}

export async function discoverEndpointModels(baseUrl: string, apiKey: string, signal: AbortSignal): Promise<string[]> {
  const response = await fetch(normalizeBaseUrl(baseUrl) + '/models', {
    method: 'GET', headers: { Accept: 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}) },
    signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Error('Akses ditolak. Periksa API key dan izin penyedia.');
    if (response.status === 404 || response.status === 405) throw Error('Daftar model tidak tersedia di alamat ini. Periksa Base URL, atau isi ID model secara manual.');
    if (response.status === 429) throw Error('Batas permintaan tercapai. Coba lagi nanti.');
    throw Error('Penyedia mengembalikan HTTP ' + response.status + '. Coba lagi nanti.');
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw Error('Respons penyedia bukan JSON. Periksa Base URL.'); }
  const models = (data as { data?: unknown })?.data;
  if (!Array.isArray(models)) throw Error('Format daftar model tidak dikenali. Isi ID model secara manual.');
  return [...new Set(models.flatMap(value => typeof value?.id === 'string' && value.id.length <= 160 && value.id.trim() ? [value.id.trim()] : []))].slice(0, 500);
}
