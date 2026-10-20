// Development-only, same-origin/loopback-only transport. No credentials or payloads are logged or saved.
export function localProviderRelay() {
  return {
    name: 'local-provider-relay',
    configureServer(server) {
      server.middlewares.use('/__client/provider', async (req, res) => {
        const fail = status => { if (!res.headersSent) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end('{"error":"Provider request failed"}'); } else res.end(); };
        res.setHeader('Cache-Control', 'no-store');
        const host = req.headers.host || '';
        const origin = req.headers.origin;
        if (req.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || origin !== 'http://' + host || req.headers['content-type'] !== 'application/json') { fail(403); return; }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120000);
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) { fail(413); return; } chunks.push(chunk); }
          const raw = Buffer.concat(chunks).toString('utf8');
          let payload, url;
          try { payload = JSON.parse(raw); url = new URL(payload.url); } catch { fail(400); return; }
          const httpAllowedHost = url.hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === '[::1]' || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(url.hostname);
          if ((url.protocol !== 'https:' && !(httpAllowedHost && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || typeof payload.key !== 'string' || payload.key.length > 4096 || /[\r\n]/.test(payload.key)) { fail(400); return; }
          const chat = url.pathname.endsWith('/chat/completions');
          const audio = url.pathname.endsWith('/audio/transcriptions');
          let form;
          if (audio) {
            const a = payload.audio;
            if (!a || typeof a.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.data) || a.data.length > 7 * 1024 * 1024 || !['audio/mp4', 'audio/webm', 'audio/ogg'].includes(a.type) || typeof a.model !== 'string' || !a.model.trim() || a.model.length > 160 || typeof a.language !== 'string' || !/^(?:[a-z]{2,3})?$/.test(a.language) || payload.body) { fail(400); return; }
            const bytes = Buffer.from(a.data, 'base64'); if (!bytes.length || bytes.length > 5 * 1024 * 1024) { fail(413); return; }
            form = new FormData(); form.append('file', new Blob([bytes], { type: a.type }), a.type === 'audio/webm' ? 'dictation.webm' : a.type === 'audio/ogg' ? 'dictation.ogg' : 'dictation.m4a'); form.append('model', a.model); form.append('response_format', 'json'); if (a.language) form.append(a.model === 'gpt-transcribe' ? 'languages[]' : 'language', a.language);
          }
          if ((!chat && !audio && !url.pathname.endsWith('/models')) || (chat && (!payload.body || typeof payload.body !== 'object')) || (!chat && !audio && (payload.body || payload.audio)) || (chat && payload.audio)) { fail(400); return; }
          const upstream = await fetch(url, { method: chat || audio ? 'POST' : 'GET', signal: controller.signal, redirect: 'error', headers: {
            Accept: chat ? 'text/event-stream, application/json' : 'application/json', ...(payload.key ? { Authorization: 'Bearer ' + payload.key } : {}), ...(chat ? { 'Content-Type': 'application/json' } : {}),
          }, ...(chat ? { body: JSON.stringify(payload.body) } : audio ? { body: form } : {}) });
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (!upstream.ok) { await upstream.body?.cancel(); fail(upstream.status); return; }
          if (!upstream.body) { res.end(); return; }
          res.flushHeaders();
          for await (const chunk of upstream.body) {
            if (res.destroyed) break;
            if (!res.write(chunk)) await new Promise(resolve => { const finish = () => { res.off('drain', finish); res.off('close', finish); resolve(); }; res.once('drain', finish); res.once('close', finish); });
            if (controller.signal.aborted) break;
          }
          res.end();
        } catch { fail(controller.signal.aborted ? 504 : 502); }
        finally { clearTimeout(timer); }
      });
    },
  };
}
