import { isNativeDesktop } from '../lib/nativeDesktop';
type Bridge = { postMessage(value: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void };
const native = () => typeof window === 'undefined' ? undefined : (window as Window & { SuperGPTMcpOAuth?: Bridge }).SuperGPTMcpOAuth;
let attached: Bridge | undefined;
const pending = new Map<string, { resolve: (value: any) => void; reject: (value: Error) => void }>();
export async function oauthNativeRequest(op: string, data: object = {}, signal?: AbortSignal): Promise<any> {
  const bridge = native(); if (!bridge) throw Error('Login OAuth native belum tersedia pada versi aplikasi ini.');
  if (attached !== bridge) {
    attached = bridge; bridge.addEventListener('message', event => {
      try {
        const reply = JSON.parse(String(event.data)), request = pending.get(reply.id);
        if (!request) { if (typeof reply.handle === 'string') bridge.postMessage(JSON.stringify({ id: crypto.randomUUID(), op: 'cancel', handle: reply.handle })); return; }
        pending.delete(reply.id); if (reply.ok) request.resolve(reply); else request.reject(Error('Login atau penyimpanan OAuth Android gagal. Silakan ulangi.'));
      } catch { /* Unrelated reply. */ }
    });
  }
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const abort = () => { pending.delete(id); try { bridge.postMessage(JSON.stringify({ id: crypto.randomUUID(), op: 'cancel', handle: (data as { handle?: string }).handle })); } finally { finish(Error('Login OAuth dibatalkan.')); } };
    const timer = setTimeout(() => { pending.delete(id); abort(); }, op === 'authorize' ? 300000 : 10000);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const finish = (error: Error) => { cleanup(); reject(error); };
    pending.set(id, { resolve: value => { cleanup(); resolve(value); }, reject: finish });
    signal?.addEventListener('abort', abort, { once: true });
    try { bridge.postMessage(JSON.stringify({ id, op, ...data })); } catch { pending.delete(id); finish(Error('Jembatan OAuth tidak tersedia.')); }
  });
}
export const hasOAuthVault = () => !!native();
export type OAuthBrowser = { redirectUri: string; authorize: (url: string, state: string) => Promise<string>; close: () => void };
export async function prepareOAuthBrowser(signal: AbortSignal): Promise<OAuthBrowser> {
  if (native()) {
    const { redirectUri, handle } = await oauthNativeRequest('prepare', {}, signal);
    return { redirectUri, authorize: async (url, state) => (await oauthNativeRequest('authorize', { url, state, handle }, signal)).callback, close: () => { void oauthNativeRequest('cancel', { handle }).catch(() => {}); } };
  }
  if (isNativeDesktop()) throw Error('Login OAuth ini tersedia di Android dan browser. Gunakan bearer token untuk desktop ini.');
  // Open before asynchronous discovery, while the user click still permits a popup.
  const popup = window.open('about:blank', 'supergpt-mcp-login', 'popup,width=520,height=720');
  if (!popup) throw Error('Izinkan jendela login di browser, lalu coba lagi.');
  const redirectUri = new URL('/oauth-callback.html', location.origin).href;
  return { redirectUri, close: () => popup.close(), authorize: (url, state) => new Promise((resolve, reject) => {
    const finish = (error?: Error, callback?: string) => { clearInterval(timer); window.removeEventListener('message', receive); signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(callback!); };
    const receive = (event: MessageEvent) => {
      if (event.source !== popup || event.origin !== location.origin || event.data?.type !== 'supergpt-oauth' || typeof event.data.url !== 'string') return;
      try { const callback = new URL(event.data.url); if (callback.origin !== location.origin || callback.pathname !== '/oauth-callback.html' || callback.searchParams.get('state') !== state) return; finish(undefined, callback.href); } catch { /* Ignore malformed callbacks. */ }
    };
    const abort = () => finish(Error('Login OAuth dibatalkan.'));
    const timer = setInterval(() => { if (popup.closed) finish(Error('Jendela login ditutup.')); }, 500);
    window.addEventListener('message', receive); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; } popup.location.href = url;
  }) };
}
