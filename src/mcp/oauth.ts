import { mcpUrl } from './httpClient';
import { hasOAuthVault, oauthNativeRequest, prepareOAuthBrowser } from './oauthBrowser';
import { oauthFetch, oauthJson, oauthUrl } from './oauthTransport';

type Credential = { resource: string; issuer: string; tokenEndpoint: string; clientId: string; redirectUri: string; accessToken: string; refreshToken?: string; expiresAt?: number; scope?: string };
const storageKey = (id: string) => 'supergpt-mcp-oauth:' + id;
const locks = new Map<string, Promise<string>>();
let epoch = 0;
const versions = new Map<string, number>();
const revision = (id: string) => epoch + ':' + (versions.get(id) || 0);
let storageTail: Promise<unknown> = Promise.resolve();
function persist(operation: () => Promise<void>) {
  const next = storageTail.catch(() => {}).then(operation); storageTail = next; return next;
}
const random = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sameResource = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
function metadataUrl(value: string, resource: string) {
  const url = oauthUrl(value);
  if (resource.startsWith('https:') && !url.startsWith('https:')) throw Error('Layanan OAuth HTTPS tidak boleh dialihkan ke HTTP.');
  return url;
}
async function read(id: string): Promise<Credential | undefined> {
  await storageTail.catch(() => {});
  const raw = hasOAuthVault() ? (await oauthNativeRequest('load', { key: id })).value : sessionStorage.getItem(storageKey(id));
  if (!raw) return;
  const value = JSON.parse(raw);
  if (typeof value.resource !== 'string' || typeof value.clientId !== 'string' || typeof value.accessToken !== 'string' || typeof value.tokenEndpoint !== 'string') throw Error('Sesi OAuth rusak. Hubungkan ulang plugin.');
  return value;
}
async function write(id: string, value?: Credential) {
  await persist(async () => {
    if (hasOAuthVault()) await oauthNativeRequest('save', { key: id, value: value ? JSON.stringify(value) : '' });
    else if (value) sessionStorage.setItem(storageKey(id), JSON.stringify(value)); else sessionStorage.removeItem(storageKey(id));
  });
}
export async function clearMcpOAuth(id: string) { versions.set(id, (versions.get(id) || 0) + 1); await write(id); }
export async function clearAllMcpOAuth() {
  epoch++;
  await persist(async () => {
    if (hasOAuthVault()) await oauthNativeRequest('clear');
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('supergpt-mcp-oauth:') || key.startsWith('supergpt-mcp-token:')) sessionStorage.removeItem(key);
  });
}
function tokens(value: any, previous: Omit<Credential, 'accessToken'>): Credential {
  if (typeof value.access_token !== 'string' || !value.access_token || value.access_token.length > 4096 || /[\r\n]/.test(value.access_token) || String(value.token_type).toLowerCase() !== 'bearer') throw Error('Token OAuth tidak valid atau bukan bearer token.');
  if (value.refresh_token !== undefined && (typeof value.refresh_token !== 'string' || value.refresh_token.length > 8192)) throw Error('Refresh token tidak valid.');
  if (value.expires_in !== undefined && (!Number.isFinite(Number(value.expires_in)) || Number(value.expires_in) <= 0)) throw Error('Masa berlaku token OAuth tidak valid.');
  return { ...previous, accessToken: value.access_token, refreshToken: value.refresh_token ?? previous.refreshToken, expiresAt: value.expires_in === undefined ? undefined : Date.now() + Number(value.expires_in) * 1000, scope: typeof value.scope === 'string' ? value.scope : previous.scope };
}
export async function mcpOAuthToken(id: string, resource: string, signal: AbortSignal): Promise<string> {
  const version = revision(id);
  const lockKey = id + ':' + mcpUrl(resource) + ':' + version;
  if (locks.has(lockKey)) return locks.get(lockKey)!;
  const run = (async () => {
    const record = await read(id); if (!record) return '';
    if (revision(id) !== version) throw Error('Sesi plugin sudah dihapus.');
    if (!sameResource(record.resource, mcpUrl(resource))) throw Error('URL plugin berubah. Login ulang untuk URL baru.');
    if (!record.expiresAt || record.expiresAt > Date.now() + 60000) return record.accessToken;
    if (!record.refreshToken) throw Error('Login plugin kedaluwarsa. Hubungkan ulang plugin.');
    const response = await oauthFetch(record.tokenEndpoint, signal, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: record.refreshToken, client_id: record.clientId, resource: record.resource }));
    if ([400, 401, 403].includes(response.status)) { await response.body?.cancel(); await write(id); throw Error('Login plugin kedaluwarsa atau dicabut. Hubungkan ulang plugin.'); }
    const next = tokens(await oauthJson(response), record); signal.throwIfAborted(); if (revision(id) !== version) throw Error('Sesi plugin sudah dihapus.'); await write(id, next); return next.accessToken;
  })();
  locks.set(lockKey, run); try { return await run; } finally { if (locks.get(lockKey) === run) locks.delete(lockKey); }
}
export async function discoverMcpOAuth(resource: string, signal: AbortSignal) {
  resource = mcpUrl(resource); const base = new URL(resource);
  // A credential-free initialization obtains the server's resource/scope challenge.
  const probe = await oauthFetch(resource, signal, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'SuperGPT', version: '1.0' } } });
  const challenge = probe.headers.get('WWW-Authenticate') || ''; await probe.body?.cancel();
  const hint = /\bresource_metadata="([^"\r\n]+)"/i.exec(challenge)?.[1];
  const scope = /\bscope="([^"\r\n]*)"/i.exec(challenge)?.[1];
  const candidates = hint ? [hint] : [...new Set([base.origin + '/.well-known/oauth-protected-resource' + (base.pathname === '/' ? '' : base.pathname), base.origin + '/.well-known/oauth-protected-resource'])];
  let metadata: any;
  for (const url of candidates) {
    const response = await oauthFetch(metadataUrl(url, resource), signal);
    if ([404, 405].includes(response.status) && !hint) { await response.body?.cancel(); continue; }
    metadata = await oauthJson(response); break;
  }
  if (!metadata || typeof metadata.resource !== 'string' || !sameResource(oauthUrl(metadata.resource), resource) || !Array.isArray(metadata.authorization_servers) || !metadata.authorization_servers.length) throw Error('Server belum menyediakan metadata OAuth MCP yang cocok. Gunakan koneksi publik/token jika itu metode server ini.');
  const issuer = metadataUrl(metadata.authorization_servers[0], resource); const authority = new URL(issuer), path = authority.pathname.replace(/\/$/, '');
  if (authority.search) throw Error('Issuer OAuth tidak boleh memuat query.');
  const locations = [...new Set([authority.origin + '/.well-known/oauth-authorization-server' + path, authority.origin + '/.well-known/openid-configuration' + path, authority.origin + path + '/.well-known/openid-configuration'])];
  let auth: any;
  for (const url of locations) {
    const response = await oauthFetch(url, signal); if ([404, 405].includes(response.status)) { await response.body?.cancel(); continue; } auth = await oauthJson(response); break;
  }
  if (!auth || typeof auth.issuer !== 'string' || !sameResource(oauthUrl(auth.issuer), issuer) || !auth.code_challenge_methods_supported?.includes('S256')) throw Error('Penyedia OAuth belum menyediakan metadata atau PKCE S256 yang diperlukan.');
  if (auth.token_endpoint_auth_methods_supported && !auth.token_endpoint_auth_methods_supported.includes('none')) throw Error('Penyedia memerlukan server rahasia aplikasi; OAuth langsung dari APK tidak didukung layanan ini.');
  return { resource, issuer, authorizationEndpoint: metadataUrl(auth.authorization_endpoint, resource), tokenEndpoint: metadataUrl(auth.token_endpoint, resource), registrationEndpoint: auth.registration_endpoint ? metadataUrl(auth.registration_endpoint, resource) : '', scope: scope ?? (Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported.join(' ') : '') };
}
export async function loginMcpOAuth(id: string, resource: string, signal: AbortSignal, clientId = '', progress: (value: string) => void = () => {}) {
  const version = revision(id);
  const browser = await prepareOAuthBrowser(signal);
  try {
    progress('Memeriksa layanan login…');
    const metadata = await discoverMcpOAuth(resource, signal);
    if (!clientId.trim()) {
      if (!metadata.registrationEndpoint) throw Error('Penyedia memerlukan pendaftaran SuperGPT. Isi Client ID milik aplikasi yang sudah disetujui penyedia.');
      const registration = await oauthJson(await oauthFetch(metadata.registrationEndpoint, signal, { client_name: 'SuperGPT', redirect_uris: [browser.redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }));
      if (registration.token_endpoint_auth_method && registration.token_endpoint_auth_method !== 'none') throw Error('Penyedia mewajibkan client secret. Gunakan server OAuth milik aplikasi.');
      clientId = registration.client_id;
    }
    if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 2048) throw Error('Client ID OAuth tidak valid.');
    const verifier = random(), state = random(); const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = new URL(metadata.authorizationEndpoint);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: clientId, redirect_uri: browser.redirectUri, code_challenge: challenge, code_challenge_method: 'S256', state, resource: metadata.resource, ...(metadata.scope ? { scope: metadata.scope } : {}) })) url.searchParams.set(key, value);
    progress('Selesaikan login di browser…');
    const callback = new URL(await browser.authorize(url.href, state)); const expected = new URL(browser.redirectUri);
    if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.hash || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== state) throw Error('Callback OAuth tidak cocok. Login dibatalkan.');
    if (callback.searchParams.has('error')) throw Error('Login dibatalkan atau izin ditolak oleh penyedia.');
    const code = callback.searchParams.get('code'); if (!code || code.length > 8192 || callback.searchParams.getAll('code').length !== 1) throw Error('Kode login OAuth tidak tersedia.');
    progress('Menyelesaikan login…');
    const response = await oauthFetch(metadata.tokenEndpoint, signal, new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: browser.redirectUri, code_verifier: verifier, resource: metadata.resource }));
    const record = tokens(await oauthJson(response), { resource: metadata.resource, issuer: metadata.issuer, tokenEndpoint: metadata.tokenEndpoint, clientId, redirectUri: browser.redirectUri, scope: metadata.scope });
    signal.throwIfAborted(); if (revision(id) !== version) throw Error('Sesi plugin sudah dihapus.'); await write(id, record); return record.accessToken;
  } finally { browser.close(); }
}
