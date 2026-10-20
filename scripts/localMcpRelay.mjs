// Development only. The selected MCP receives only explicitly allowed protocol headers.
export function localMcpRelay() {
  return { name: 'local-mcp-relay', configureServer(server) {
    server.middlewares.use('/__client/mcp', async (req, res) => {
      const fail = status => { if (!res.headersSent) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end('{"error":"MCP request failed"}'); } else res.end(); };
      res.setHeader('Cache-Control', 'no-store');
      const host = req.headers.host || '';
      if (req.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || req.headers.origin !== 'http://' + host || req.headers['content-type'] !== 'application/json') { fail(403); return; }
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 3600000);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 256000) { fail(413); return; } chunks.push(chunk); }
        const p = JSON.parse(Buffer.concat(chunks).toString('utf8')), url = new URL(p.url);
        const local = ['localhost', '[::1]'].includes(url.hostname) || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(url.hostname);
        if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || typeof p.token !== 'string' || p.token.length > 4096 || /[\r\n]/.test(p.token) || typeof p.session !== 'string' || (p.session && !/^[\x21-\x7e]{1,512}$/.test(p.session)) || !['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(p.protocol) || !['POST', 'DELETE'].includes(p.method)) { fail(400); return; }
        if (p.method === 'POST' && (p.body?.jsonrpc !== '2.0' || !['initialize', 'notifications/initialized', 'tools/list', 'tools/call'].includes(p.body.method))) { fail(400); return; }
        const upstream = await fetch(url, { method: p.method, signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': p.protocol, ...(p.session ? { 'Mcp-Session-Id': p.session } : {}), ...(p.token ? { Authorization: 'Bearer ' + p.token } : {}) }, ...(p.method === 'POST' ? { body: JSON.stringify(p.body) } : {}) });
        res.statusCode = upstream.status; res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
        const session = upstream.headers.get('Mcp-Session-Id'); if (session && /^[\x21-\x7e]{1,512}$/.test(session)) res.setHeader('Mcp-Session-Id', session);
        if (!upstream.ok) { await upstream.body?.cancel(); fail(upstream.status); return; }
        if (!upstream.body) { res.end(); return; } res.flushHeaders(); let bytes = 0;
        for await (const chunk of upstream.body) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) { controller.abort(); break; } if (res.destroyed) break; if (!res.write(chunk)) await new Promise(resolve => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); }); }
        res.end();
      } catch { fail(controller.signal.aborted ? 504 : 502); } finally { clearTimeout(timer); }
    });
  } };
}
