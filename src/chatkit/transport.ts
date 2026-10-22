import type { EndpointProfile } from '../lib/endpointProfiles';
import type { ClientSettings } from '../lib/clientSettings';
import { sdkOwner, sdkServer, type SdkConfig } from './config';

export type SdkConnection = { apiUrl: string; fetch: typeof fetch; request: <T>(path: string, body?: unknown) => Promise<T>; close: () => Promise<void> };
export async function connectSdk(config: SdkConfig, endpoint: EndpointProfile, key: string, serverToken: string, settings: ClientSettings, extra: { signal?: AbortSignal; mcp?: { name: string; url: string; token?: string; googleWrite?: boolean }[]; reasoningEffort?: string } = {}): Promise<SdkConnection> {
  const origin = sdkServer(config.server), base = origin + '/__sdk';
  let token = '', renewing: Promise<void> | null = null, closed = false;
  const authorize = async () => {
    if (closed) throw Error('Sesi SDK sudah ditutup.');
    const response = await fetch(base + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(serverToken ? { Authorization: 'Bearer ' + serverToken } : {}) }, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      signal: extra.signal, body: JSON.stringify({ owner: sdkOwner(), mcp: extra.mcp, provider: { baseUrl: endpoint.baseUrl, model: endpoint.model, models: endpoint.models, key: endpoint.auth === 'none' ? '' : key, sendReasoning: endpoint.sendReasoning }, options: { ...config.options, timeoutSeconds: settings.timeoutSeconds, reasoningEffort: extra.reasoningEffort, instructions: [settings.instructions, settings.writingStyle === 'concise' ? 'Prefer concise answers.' : settings.writingStyle === 'detailed' ? 'Prefer detailed answers.' : '', settings.memoriesEnabled ? 'User-saved context:\n' + settings.memories.join('\n') : ''].filter(Boolean).join('\n\n') } }) });
    if (!response.ok) throw Error(response.status === 403 ? 'Server menolak akses. Periksa origin yang diizinkan dan token server.' : 'Server Agents belum tersedia. Jalankan server SDK atau periksa URL server.');
    const result = await response.json(); if (typeof result.token !== 'string') throw Error('Respons sesi server tidak valid.'); token = result.token;
  };
  await authorize();
  const sdkFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== origin || !url.pathname.startsWith('/__sdk/')) throw Error('Permintaan di luar server SDK diblokir.');
    if (closed) throw Error('Sesi SDK sudah ditutup.');
    const original = new Request(input instanceof Request ? input : url, init);
    const send = () => { const headers = new Headers(original.headers); headers.set('Authorization', 'Bearer ' + token); return fetch(original.clone(), { headers, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' }); };
    let response = await send();
    // A 401 is returned before the server admits any operation: safe to renew
    // and resend once. Never replay an interrupted/failed model stream.
    if (response.status === 401) { renewing ||= authorize().finally(() => { renewing = null; }); await renewing; response = await send(); }
    return response;
  };
  return { apiUrl: base + '/chatkit', fetch: sdkFetch,
    request: async <T,>(path: string, body?: unknown) => { const response = await sdkFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); if (!response.ok) throw Error('Permintaan server gagal (HTTP ' + response.status + ').'); return response.json() as Promise<T>; },
    close: async () => { if (closed) return; closed = true; try { await fetch(base + '/session', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }, credentials: 'omit', redirect: 'error', keepalive: true }); } finally { token = ''; } },
  };
}
