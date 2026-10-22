import { isNativeDesktop } from '../lib/nativeDesktop';
import { usesLocalProviderRelay } from '../lib/providerTransport';

export function oauthUrl(value: string) {
  const url = new URL(value);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.hash) throw Error('Alamat OAuth tidak aman.');
  return url.href;
}
// No cookies, bearer headers or redirects. Tokens travel only in the explicit token request.
export async function oauthFetch(url: string, signal: AbortSignal, body?: URLSearchParams | object): Promise<Response> {
  url = oauthUrl(url);
  const form = body instanceof URLSearchParams;
  const headers = { Accept: 'application/json', ...(body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) };
  const content = body ? form ? body.toString() : JSON.stringify(body) : undefined;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  if (usesLocalProviderRelay()) return fetch('/__client/mcp-oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, content, form }), signal: deadline, credentials: 'omit', redirect: 'error', cache: 'no-store' });
  const fetcher = isNativeDesktop() ? (await import('@tauri-apps/plugin-http')).fetch : fetch;
  return fetcher(url, { method: body ? 'POST' : 'GET', headers, body: content, signal: deadline, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', ...(isNativeDesktop() ? { maxRedirections: 0 } : {}) });
}
export async function oauthJson(response: Response): Promise<any> {
  if (!response.ok) { await response.body?.cancel(); throw Error('Layanan OAuth menolak permintaan (HTTP ' + response.status + '). Periksa izin atau pendaftaran aplikasi.'); }
  if (!response.body) throw Error('Layanan OAuth mengirim respons kosong.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 256000) throw Error('Respons OAuth terlalu besar.'); chunks.push(part.value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
