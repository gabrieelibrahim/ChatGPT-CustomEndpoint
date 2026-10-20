import { isNativeDesktop, nativeProviderFetch } from '../lib/nativeDesktop';
import { usesLocalProviderRelay } from '../lib/providerTransport';

export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> };
export type McpConnection = { tools: McpTool[]; call: (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>; close: () => Promise<void> };
const LIMIT = 2 * 1024 * 1024;
export function mcpUrl(value: string): string {
  const url = new URL(value);
  const local = ['localhost', '[::1]'].includes(url.hostname) || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw Error('Gunakan URL MCP HTTPS atau localhost/Tailscale tanpa token di URL.');
  return url.href;
}
export function mcpToken(id: string, value?: string): string {
  const key = 'supergpt-mcp-token:' + id;
  if (value !== undefined) { if (value.length > 4096 || /[\r\n]/.test(value)) throw Error('Token MCP tidak valid.'); if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); }
  return sessionStorage.getItem(key) || '';
}
async function rpcResult(response: Response, id: number, signal: AbortSignal): Promise<any> {
  if (!response.body) throw Error('Server MCP mengirim respons kosong.');
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', size = 0;
  const sse = response.headers.get('content-type')?.includes('text/event-stream');
  const match = (raw: string) => { const value = JSON.parse(raw); return value?.jsonrpc === '2.0' && value.id === id ? value : undefined; };
  try {
    for (;;) {
      signal.throwIfAborted(); const part = await reader.read(); size += part.value?.byteLength || 0;
      if (size > LIMIT) throw Error('Respons MCP melebihi 2 MB.');
      buffer += decoder.decode(part.value, { stream: !part.done }); buffer = buffer.replace(/\r\n/g, '\n');
      if (sse) {
        let at; while ((at = buffer.indexOf('\n\n')) >= 0) { const block = buffer.slice(0, at); buffer = buffer.slice(at + 2); const raw = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (raw) { const value = match(raw); if (value) return value; } }
      }
      if (part.done) { if (!sse) { const value = match(buffer); if (value) return value; } else if (buffer.trim()) { const raw = buffer.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (raw) { const value = match(raw); if (value) return value; } } break; }
    }
    throw Error('Server MCP tidak menjawab ID permintaan ini.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function connectMcp(profile: { url: string; token?: string }, signal: AbortSignal): Promise<McpConnection> {
  const url = mcpUrl(profile.url), token = profile.token || '';
  if (token.length > 4096 || /[\r\n]/.test(token)) throw Error('Token MCP tidak valid.');
  let session = '', protocol = '2025-03-26', nextId = 0;
  async function send(method: 'POST' | 'DELETE', body: unknown, parent: AbortSignal, deadline = 30000) {
    const controller = new AbortController(), cancel = () => controller.abort(parent.reason);
    parent.throwIfAborted(); parent.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(Error('Server MCP melewati batas waktu.')), deadline);
    const headers = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': protocol, ...(session ? { 'Mcp-Session-Id': session } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    try {
      const response = usesLocalProviderRelay() ? await fetch('/__client/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, session, protocol, method, body }), signal: controller.signal, credentials: 'omit', redirect: 'error' }) : await (isNativeDesktop() ? nativeProviderFetch : fetch)(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (method === 'DELETE' && [404, 405].includes(response.status)) { await response.body?.cancel(); return undefined; }
      if (!response.ok) { await response.body?.cancel(); throw Error(response.status === 401 || response.status === 403 ? 'MCP meminta login atau bearer token yang valid.' : response.status === 429 ? 'Batas permintaan MCP tercapai. Coba lagi nanti.' : 'Server MCP gagal (HTTP ' + response.status + ').'); }
      if ((body as any)?.method === 'initialize') { const value = response.headers.get('Mcp-Session-Id'); if (value) { if (!/^[\x21-\x7e]{1,512}$/.test(value)) throw Error('ID sesi MCP tidak valid.'); session = value; } }
      if (!(body as any)?.id) { await response.body?.cancel(); return undefined; }
      const result = await rpcResult(response, (body as any).id, controller.signal);
      if (result.error) throw Error('Server MCP menolak permintaan (kode ' + Number(result.error.code) + ').');
      if (!('result' in result)) throw Error('Format hasil MCP tidak valid.');
      return result.result;
    } catch (error) { if (controller.signal.aborted) throw controller.signal.reason || Error('Koneksi MCP dibatalkan.'); throw error; }
    finally { clearTimeout(timer); parent.removeEventListener('abort', cancel); }
  }
  const rpc = (method: string, params: unknown, parent = signal, deadline?: number) => send('POST', { jsonrpc: '2.0', id: ++nextId, method, params }, parent, deadline);
  const close = async () => { if (session) { try { await send('DELETE', undefined, new AbortController().signal, 2000); } catch { /* Best effort session cleanup; never replay tool calls. */ } session = ''; } };
  try {
    const init = await rpc('initialize', { protocolVersion: protocol, capabilities: {}, clientInfo: { name: 'SuperGPT', version: '1.0' } });
    if (!['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(init?.protocolVersion)) throw Error('Versi protokol MCP belum didukung.');
    protocol = init.protocolVersion;
    await send('POST', { jsonrpc: '2.0', method: 'notifications/initialized' }, signal);
    if (!init.capabilities?.tools) throw Error('Server MCP ini tidak menyediakan tools.');
    const tools: McpTool[] = []; const cursors = new Set<string>(); let cursor: string | undefined;
    do {
      const result = await rpc('tools/list', cursor ? { cursor } : {});
      if (!Array.isArray(result.tools)) throw Error('Daftar tool MCP tidak valid.');
      for (const tool of result.tools) { if (typeof tool?.name !== 'string' || !tool.name || tool.name.length > 160 || !tool.inputSchema || tool.inputSchema.type !== 'object') throw Error('Skema tool MCP tidak valid.'); if (!tools.some(value => value.name === tool.name)) tools.push({ name: tool.name, description: typeof tool.description === 'string' ? tool.description.slice(0, 4000) : '', inputSchema: tool.inputSchema }); }
      if (tools.length > 128) throw Error('Server MCP menyediakan lebih dari 128 tools.');
      cursor = typeof result.nextCursor === 'string' && result.nextCursor ? result.nextCursor : undefined;
      if (cursor) { if (cursors.has(cursor) || cursors.size >= 16) throw Error('Paginasi MCP tidak valid.'); cursors.add(cursor); }
    } while (cursor);
    if (!tools.length) throw Error('Server MCP belum menyediakan tool yang dapat digunakan.');
    return { tools, close, call: async (name, args, parent) => { if (!tools.some(tool => tool.name === name)) throw Error('Tool MCP tidak ditemukan.'); if (!args || typeof args !== 'object' || Array.isArray(args) || JSON.stringify(args).length > 64000) throw Error('Argumen tool MCP tidak valid.'); return rpc('tools/call', { name, arguments: args }, parent, 3600000); } };
  } catch (error) { await close(); throw error; }
}
