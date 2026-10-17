import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { codexAgentBridge } from './codexAgentBridge.mjs';

// Private inherited pipes only: no listening port and no bearer token exposed to the webview.
export function startDesktopAgentHost(input = process.stdin, output = process.stdout, options = {}) {
  const lifecycle = new EventEmitter(), active = new Map();
  let handle, closing = false;
  const plugin = codexAgentBridge(options);
  plugin.configureServer({ httpServer: lifecycle, middlewares: { use(path, handler) { if (path === '/__client/agent') handle = handler; } } });
  const send = value => { if (!output.destroyed) output.write(JSON.stringify(value) + '\n'); };
  const lines = createInterface({ input, crlfDelay: Infinity });
  async function shutdown() {
    if (closing) return;
    closing = true;
    for (const response of active.values()) response.destroy();
    active.clear();
    await plugin.close();
    lines.close();
    if (options.onShutdown) options.onShutdown();
  }
  lines.on('line', line => {
    if (closing) return;
    let message;
    try { if (Buffer.byteLength(line) > 9 * 1024 * 1024) throw Error(); message = JSON.parse(line); }
    catch { return; }
    if (message.shutdown === true) { void shutdown(); return; }
    if (typeof message.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(message.id)) return;
    const id = message.id;
    if (message.cancel === true) { active.get(id)?.destroy(); return; }
    if (active.has(id) || active.size >= 16 || !message.payload || typeof message.payload !== 'object') {
      send({ id, type: 'error', error: 'Permintaan desktop tidak valid atau terlalu banyak.' }); return;
    }
    const headers = new Map(); let headersSent = false;
    const response = new Writable({
      write(chunk, encoding, callback) { flushHeaders(); send({ id, type: 'chunk', data: Buffer.from(chunk).toString('base64') }); callback(); },
      final(callback) { flushHeaders(); send({ id, type: 'end' }); callback(); },
    });
    function flushHeaders() { if (!headersSent) { headersSent = true; send({ id, type: 'headers', status: response.statusCode, headers: [...headers] }); } }
    response.statusCode = 200;
    Object.defineProperty(response, 'headersSent', { get: () => headersSent });
    response.setHeader = (name, value) => { headers.set(name.toLowerCase(), String(value)); };
    response.flushHeaders = flushHeaders;
    response.on('close', () => { active.delete(id); if (!response.writableFinished) send({ id, type: 'end' }); });
    response.on('error', () => { send({ id, type: 'error', error: 'Koneksi runtime desktop terputus.' }); });
    active.set(id, response);
    const request = Readable.from([Buffer.from(JSON.stringify(message.payload))]);
    // Adapt the existing validated bridge in-process, never from an external request.
    request.method = 'POST'; request.socket = { remoteAddress: '127.0.0.1' };
    request.headers = { host: '127.0.0.1', origin: 'http://127.0.0.1', 'content-type': 'application/json' };
    void handle(request, response).catch(() => { if (!response.destroyed) response.destroy(Error('Host request failed')); });
  });
  lines.on('close', () => { void shutdown(); });
  input.on('error', () => { void shutdown(); });
  return { shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDesktopAgentHost(process.stdin, process.stdout, { onShutdown: () => process.exit(0) });
}
