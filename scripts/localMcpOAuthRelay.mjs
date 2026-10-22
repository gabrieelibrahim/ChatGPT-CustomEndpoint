// Development-only OAuth transport. Never forwards ambient cookies or authorization headers.
export function localMcpOAuthRelay() {
  return { name: 'local-mcp-oauth-relay', configureServer(server) {
    server.middlewares.use('/__client/mcp-oauth', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
      const fail = status => { if (!res.headersSent) res.statusCode = status; res.end('{"error":"OAuth request failed"}'); };
      const host = req.headers.host || '';
      if (req.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || req.headers.origin !== 'http://' + host || req.headers['content-type'] !== 'application/json') return fail(403);
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 64000) return fail(413); chunks.push(chunk); }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8')), url = new URL(data.url);
        if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.hash || (data.content !== undefined && (typeof data.content !== 'string' || data.content.length > 50000))) return fail(400);
        const response = await fetch(url, { method: data.content === undefined ? 'GET' : 'POST', body: data.content, redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json', ...(data.content === undefined ? {} : { 'Content-Type': data.form ? 'application/x-www-form-urlencoded' : 'application/json' }) } });
        res.statusCode = response.status;
        const challenge = response.headers.get('WWW-Authenticate'); if (challenge) res.setHeader('WWW-Authenticate', challenge);
        // Buffer before writing, so malformed or oversized metadata never becomes a partial success.
        const parts = []; let bytes = 0;
        if (response.body) for await (const part of response.body) { bytes += part.length; if (bytes > 256000) { controller.abort(); return fail(502); } parts.push(part); }
        res.end(Buffer.concat(parts));
      } catch { fail(controller.signal.aborted ? 504 : 502); } finally { clearTimeout(timer); }
    });
  } };
}
