// Explicit local UI fixture. No external requests, credentials, inference or billing.
import { createServer } from 'node:http';
const answer = '**Simulasi SDK lokal**\n\nChatKit resmi terhubung ke Agents SDK. Ini jawaban mock untuk menguji streaming, bukan hasil model AI.\n\n- Riwayat tersimpan di server lokal.\n- Tool dan persetujuan diuji terpisah.\n- Voice memerlukan endpoint audio yang mendukung.\n\n```typescript\nconst app = "SuperGPT by Sakelar";\n```';
createServer(async (req, res) => {
  if (req.url === '/v1/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'reasoning-test-model' }] })); return; }
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') { res.writeHead(404).end(); return; }
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1024 * 1024) { res.writeHead(413).end(); return; } }
  const body = JSON.parse(raw);
  res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.flushHeaders();
  const chunk = (delta, finish_reason = null) => res.write('data: ' + JSON.stringify({ id: 'mock-ui', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
  chunk({ role: 'assistant', content: '' });
  let offset = 0;
  const timer = setInterval(() => { chunk({ content: answer.slice(offset, offset + 8) }); offset += 8; if (offset >= answer.length) { clearInterval(timer); chunk({}, 'stop'); res.end('data: [DONE]\n\n'); } }, 25);
  res.once('close', () => clearInterval(timer));
}).listen(19092, '127.0.0.1', () => console.log('Synthetic SuperGPT mock: http://127.0.0.1:19092/v1 (no real AI)'));
