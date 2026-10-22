import { isNativeDesktop } from '../lib/nativeDesktop';
import { hasOAuthVault, oauthNativeRequest } from './oauthBrowser';
import { oauthJson } from './oauthTransport';
import { googleScopes, googleService, googleScopeGranted, type GoogleWorkspaceService } from './googleWorkspace';

type NativeBridge = { postMessage(value: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void };
type CommonCredential = { serviceId: string; resource: string; account: string; scopes: string[]; write: boolean };
type GoogleCredential = CommonCredential & ({ mode: 'native' } | { mode: 'broker'; server: string; connectionToken: string });
export type GoogleLoginOptions = { write?: boolean; mode?: 'auto' | 'native' | 'broker'; server?: string; serverToken?: string };
const bridge = () => typeof window === 'undefined' ? undefined : (window as Window & { SuperGPTGoogleAuth?: NativeBridge }).SuperGPTGoogleAuth;
export const hasNativeGoogleAuth = () => !!bridge();
const key = (id: string) => 'supergpt-mcp-oauth:google:' + id;
let epoch = 0, connected: NativeBridge | undefined, storageTail: Promise<unknown> = Promise.resolve();
const versions = new Map<string, number>();
const revision = (id: string) => epoch + ':' + (versions.get(id) || 0);
const requests = new Map<string, { owner: string; resolve: (value: any) => void; reject: (reason: Error) => void }>();
const nativeError = (value: unknown) => new Error(value === 'cancelled' ? 'Login Google dibatalkan.' : value === 'reconnect-required' ? 'Izin Google perlu diperbarui. Hubungkan ulang plugin.' : 'Login Google belum tersedia. Periksa Google Play Services dan pendaftaran OAuth SuperGPT, atau gunakan server OAuth Google.');

function validateId(id: string) { if (!id || id.length > 90 || /[\r\n]/.test(id)) throw Error('Identitas koneksi Google tidak valid.'); }
function token(value: unknown): string { if (typeof value !== 'string' || !value || value.length > 4096 || /[\r\n]/.test(value)) throw Error('Token Google tidak valid.'); return value; }
function account(value: unknown): string { if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(value)) throw Error('Akun Google tidak dapat diverifikasi.'); return value.toLowerCase(); }
function scopes(value: unknown, service: GoogleWorkspaceService, write: boolean): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string' || item.length > 300)) throw Error('Izin Google tidak valid.');
  const granted = value as string[];
  if (!googleScopes(service, write).every(scope => googleScopeGranted(scope, granted))) throw Error('Sebagian izin Google belum diberikan. Hubungkan ulang dan tinjau izin layanan.');
  return [...new Set(granted)];
}
function persist(operation: () => Promise<void>) { const run = storageTail.catch(() => {}).then(operation); storageTail = run; return run; }
async function save(id: string, value?: GoogleCredential, expected?: string) {
  validateId(id);
  await persist(async () => {
    if (expected !== undefined && revision(id) !== expected) throw Error('Sesi Google sudah dihapus.');
    if (hasOAuthVault()) await oauthNativeRequest('save', { key: 'google:' + id, value: value ? JSON.stringify(value) : '' });
    else if (value) sessionStorage.setItem(key(id), JSON.stringify(value)); else sessionStorage.removeItem(key(id));
  });
}
async function load(id: string): Promise<GoogleCredential | undefined> {
  validateId(id); await storageTail.catch(() => {});
  const raw = hasOAuthVault() ? (await oauthNativeRequest('load', { key: 'google:' + id })).value : sessionStorage.getItem(key(id));
  if (!raw) return;
  const value = JSON.parse(raw), service = googleService(value?.serviceId);
  if (!service || value.resource !== service.url || !['native', 'broker'].includes(value.mode) || typeof value.write !== 'boolean') throw Error('Sesi Google tidak valid. Hubungkan ulang plugin.');
  account(value.account); scopes(value.scopes, service, value.write);
  if (value.mode === 'broker') { brokerOrigin(value.server); token(value.connectionToken); }
  return value;
}
function nativeRequest(owner: string, op: 'authorize' | 'clear', data: object, signal: AbortSignal): Promise<any> {
  signal.throwIfAborted(); const native = bridge(); if (!native) return Promise.reject(nativeError('unavailable'));
  if (connected !== native) {
    connected = native;
    native.addEventListener('message', event => {
      try { const value = JSON.parse(String(event.data)), pending = requests.get(value.id); if (!pending) return; requests.delete(value.id); if (value.ok === true) pending.resolve(value); else pending.reject(nativeError(value.error)); } catch { /* Ignore malformed/unrelated bridge replies. */ }
    });
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); };
    const fail = (error: Error) => { requests.delete(id); cleanup(); reject(error); };
    const cancel = () => { try { native.postMessage(JSON.stringify({ id: crypto.randomUUID(), op: 'cancel', requestId: id })); } catch { /* Best effort native cancellation. */ } fail(Error('Login Google dibatalkan.')); };
    const timer = setTimeout(cancel, op === 'authorize' ? 180000 : 10000);
    requests.set(id, { owner, resolve: value => { cleanup(); resolve(value); }, reject: fail });
    signal.addEventListener('abort', cancel, { once: true });
    try { native.postMessage(JSON.stringify({ id, op, ...data })); } catch { fail(nativeError('unavailable')); }
  });
}
function cancelOwner(id?: string) {
  for (const [requestId, request] of requests) if (id === undefined || request.owner === id) {
    try { bridge()?.postMessage(JSON.stringify({ id: crypto.randomUUID(), op: 'cancel', requestId })); } catch { /* Best effort. */ }
    request.reject(Error('Sesi Google sudah dihapus.'));
  }
}
function brokerOrigin(value?: string) {
  const url = new URL(value?.trim() || location.origin);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('Isi origin server OAuth Google HTTPS, tanpa path atau kredensial.');
  return url.origin;
}
async function brokerRequest(server: string, path: string, signal: AbortSignal, bearer = '', body?: object, method?: string) {
  const origin = brokerOrigin(server), authentication = bearer ? token(bearer) : '';
  const fetcher = isNativeDesktop() ? (await import('@tauri-apps/plugin-http')).fetch : fetch;
  return fetcher(origin + '/__google/' + path, { method: method || (body ? 'POST' : 'GET'), headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authentication ? { Authorization: 'Bearer ' + authentication } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', ...(isNativeDesktop() ? { maxRedirections: 0 } : {}) });
}
async function access(record: GoogleCredential, signal: AbortSignal, owner: string): Promise<string> {
  const service = googleService(record.serviceId)!;
  const result = record.mode === 'native'
    ? await nativeRequest(owner, 'authorize', { scopes: googleScopes(service, record.write), interactive: false, account: record.account }, signal)
    : await oauthJson(await brokerRequest(record.server, 'access', signal, record.connectionToken, { serviceId: record.serviceId, resource: record.resource }));
  if (account(result.account) !== record.account.toLowerCase()) throw Error('Akun Google berubah. Hubungkan ulang plugin untuk akun yang dipilih.');
  scopes(result.grantedScopes ?? result.scopes, service, record.write);
  return token(result.accessToken);
}
export async function googleAccessToken(id: string, resource: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted(); const version = revision(id), record = await load(id);
  if (!record) throw Error('Sesi Google tidak tersedia. Hubungkan ulang plugin.');
  if (resource.replace(/\/+$/, '') !== record.resource || !googleService(resource)) throw Error('URL Google berubah. Kredensial tidak dikirim ke server lain.');
  if (revision(id) !== version) throw Error('Sesi Google sudah dihapus.');
  const result = await access(record, signal, id); signal.throwIfAborted();
  if (revision(id) !== version) throw Error('Sesi Google sudah dihapus.');
  return result;
}
const random = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const challenge = async (value: string) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function delay(signal: AbortSignal, ms: number) { return new Promise<void>((resolve, reject) => { const abort = () => { clearTimeout(timer); reject(Error('Login Google dibatalkan.')); }; const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); }); }
function authorizeUrl(value: unknown, redirect: unknown, service: GoogleWorkspaceService, write: boolean) {
  if (typeof value !== 'string') throw Error('Alamat login Google tidak valid.');
  const url = new URL(value);
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth' || url.username || url.password || url.hash || url.searchParams.has('client_secret') || url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('client_id') || !url.searchParams.get('state') || url.searchParams.get('code_challenge_method') !== 'S256' || !url.searchParams.get('code_challenge') || url.searchParams.get('access_type') !== 'offline' || typeof redirect !== 'string' || url.searchParams.get('redirect_uri') !== redirect) throw Error('Server mengirim alamat login Google yang tidak cocok.');
  const requested = (url.searchParams.get('scope') || '').split(/\s+/).filter(Boolean), allowed = googleScopes(service, write);
  if (!allowed.every(scope => requested.includes(scope)) || requested.some(scope => !allowed.includes(scope))) throw Error('Server meminta izin Google yang berbeda dari pilihanmu.');
  return url.href;
}
async function deleteBroker(record: GoogleCredential) {
  if (record.mode !== 'broker') return;
  const response = await brokerRequest(record.server, 'connection', AbortSignal.timeout(5000), record.connectionToken, undefined, 'DELETE');
  if (![200, 204, 404, 401].includes(response.status)) { await response.body?.cancel(); throw Error('Sesi Google lokal dihapus, tetapi sesi server belum dapat dilepas.'); }
  await response.body?.cancel();
}
export async function loginGoogleConnection(id: string, serviceId: string, options: GoogleLoginOptions, signal: AbortSignal, progress: (text: string) => void = () => {}): Promise<string> {
  validateId(id); signal.throwIfAborted();
  const service = googleService(serviceId); if (!service) throw Error('Layanan Google ini belum didukung.');
  const write = options.write === true, version = revision(id), useNative = options.mode !== 'broker' && hasNativeGoogleAuth();
  if (options.mode === 'native' && !useNative) throw nativeError('unavailable');
  // Create a browser popup while still in the originating click, before any asynchronous work.
  const popup = !useNative && !isNativeDesktop() ? window.open('about:blank', '_blank', 'popup,width=520,height=720') : undefined;
  if (!useNative && !isNativeDesktop() && !popup) throw Error('Izinkan jendela login Google di browser, lalu coba lagi.');
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(300000)]);
  let record: GoogleCredential | undefined, completed = false, flowId = '', verifier = '', server = '';
  try {
    let accessToken: string;
    if (useNative) {
      progress('Pilih akun Google dan tinjau izin layanan…');
      const result = await nativeRequest(id, 'authorize', { scopes: googleScopes(service, write), interactive: true }, deadline);
      accessToken = token(result.accessToken);
      record = { mode: 'native', serviceId: service.id, resource: service.url, account: account(result.account), scopes: scopes(result.grantedScopes, service, write), write };
    } else {
      server = brokerOrigin(options.server); progress('Memeriksa layanan login Google…');
      const configuration = await oauthJson(await brokerRequest(server, 'config', deadline));
      if (configuration.ready !== true) throw Error('Server OAuth Google belum dikonfigurasi. Ikuti panduan pendaftaran SuperGPT.');
      verifier = random();
      const started = await oauthJson(await brokerRequest(server, 'start', deadline, options.serverToken, { serviceId: service.id, write, challenge: await challenge(verifier) }));
      if (typeof started.flowId !== 'string' || !/^[a-zA-Z0-9_-]{16,256}$/.test(started.flowId)) throw Error('Identitas login Google tidak valid.');
      flowId = started.flowId;
      const url = authorizeUrl(started.authorizationUrl, configuration.redirectUri, service, write);
      progress('Selesaikan login Google di browser…');
      if (popup) popup.location.href = url; else await (await import('@tauri-apps/plugin-opener')).openUrl(url);
      let result: any;
      for (;;) {
        deadline.throwIfAborted(); if (popup?.closed) throw Error('Jendela login Google ditutup.');
        const response = await brokerRequest(server, 'result', deadline, options.serverToken, { flowId, verifier });
        if (response.status !== 202) { result = await oauthJson(response); break; }
        await response.body?.cancel(); await delay(deadline, 1000);
      }
      if (result.serviceId !== service.id || result.resource !== service.url) throw Error('Hasil login tidak cocok dengan layanan Google yang dipilih.');
      record = { mode: 'broker', server, connectionToken: token(result.connectionToken), serviceId: service.id, resource: service.url, account: account(result.account), scopes: scopes(result.scopes, service, write), write };
      accessToken = await access(record, deadline, id);
    }
    deadline.throwIfAborted(); if (revision(id) !== version) throw Error('Sesi Google sudah dihapus.');
    await save(id, record, version); completed = true; progress('Login Google selesai. Memeriksa tools…'); return accessToken;
  } finally {
    popup?.close();
    if (!completed && record?.mode === 'broker') await deleteBroker(record).catch(() => {});
    if (!completed && flowId) await brokerRequest(server, 'cancel', AbortSignal.timeout(5000), options.serverToken, { flowId, verifier }).then(response => response.body?.cancel()).catch(() => {});
  }
}
export async function clearGoogleConnection(id: string): Promise<void> {
  validateId(id); versions.set(id, (versions.get(id) || 0) + 1); cancelOwner(id);
  let record: GoogleCredential | undefined, failure: unknown;
  try { record = await load(id); } catch (error) { failure = error; }
  try { if (record) await deleteBroker(record); } catch (error) { failure = error; }
  finally { await save(id); }
  if (failure) throw Error('Sesi Google lokal dihapus, tetapi pembersihan server belum selesai.');
}
export async function clearAllGoogleConnections(ids: string[]): Promise<void> {
  epoch++; cancelOwner();
  const results = await Promise.allSettled([...new Set(ids)].map(clearGoogleConnection));
  if (hasNativeGoogleAuth()) await nativeRequest('', 'clear', {}, AbortSignal.timeout(10000));
  if (results.some(result => result.status === 'rejected')) throw Error('Sesi Google lokal dihapus, tetapi sebagian sesi server belum dapat dilepas.');
}
