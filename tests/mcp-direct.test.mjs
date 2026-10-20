import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { localMcpRelay } from '../scripts/localMcpRelay.mjs';
import { validateSession } from '../server/sdk/config.mjs';
const built = await build({ entryPoints: ['src/mcp/httpClient.ts', 'src/agent/mainClient.ts', 'src/lib/clientSettings.ts'], bundle: true, write: false, platform: 'node', format: 'esm', outdir: 'out' });
const imported = await Promise.all(built.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))));
const { connectMcp, mcpToken, mcpUrl } = imported[0], { streamMainChat, answerAgent, canAnswerAgent } = imported[1], { normalizeSettings } = imported[2];
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
function environment(t) { const previous = Object.fromEntries(['fetch', 'window', 'location', 'localStorage', 'sessionStorage'].map(key => [key, global[key]])); global.window = new EventTarget(); global.localStorage = storage(); global.sessionStorage = storage(); global.location = { origin: 'http://localhost:1420', href: 'http://localhost:1420/' }; t.after(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete global[key]; else global[key] = value; }); }
const tool = { name: 'lookup', description: 'Lookup documentation', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } };
function fixture() { const calls = []; const server = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk; const p = raw ? JSON.parse(raw) : {};
  calls.push({ method: req.method, rpc: p.method, params: p.params, session: req.headers['mcp-session-id'], auth: req.headers.authorization, cookie: req.headers.cookie, arbitrary: req.headers['x-arbitrary'] });
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'DELETE') { res.end('{}'); return; }
  if (p.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
  if (p.method !== 'initialize' && req.headers['mcp-session-id'] !== 'fixture-session') { res.writeHead(400); res.end('{}'); return; }
  let result;
  if (p.method === 'initialize') { res.setHeader('Mcp-Session-Id', 'fixture-session'); result = { protocolVersion: '2025-03-26', capabilities: { tools: {} } }; }
  if (p.method === 'tools/list') { result = p.params.cursor ? { tools: [] } : { tools: [tool], nextCursor: 'page2' }; }
  if (p.method === 'tools/call') { res.setHeader('Content-Type', 'text/event-stream'); res.end('data: ' + JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: {} }) + '\n\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: p.id, result: { content: [{ type: 'text', text: 'Found https://example.org/docs' }] } }) + '\n\n'); return; }
  res.end(JSON.stringify({ jsonrpc: '2.0', id: p.id, result }));
}); return { server, calls }; }

test('MCP initializes, lists all pages, matches SSE IDs, propagates session/token and closes', async t => {
  environment(t); const f = fixture(), url = await listen(f.server); let connection;
  try { connection = await connectMcp({ url, token: 'test-secret' }, new AbortController().signal); assert.equal(connection.tools.length, 1); const result = await connection.call('lookup', { query: 'Docs' }, new AbortController().signal); assert.match(result.content[0].text, /example.org/); await connection.close();
    assert.deepEqual(f.calls.map(call => call.rpc || call.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/list', 'tools/call', 'DELETE']); assert.ok(f.calls.every(call => call.auth === 'Bearer test-secret')); assert.ok(f.calls.slice(1).every(call => call.session === 'fixture-session'));
  } finally { await connection?.close(); await close(f.server); }
});

test('MCP refuses unsafe destinations, invalid headers, wrong RPC ID, and expired auth', async t => {
  environment(t); for (const value of ['http://public.example/mcp', 'https://a:b@example.org/mcp', 'https://example.org/mcp?token=x']) assert.throws(() => mcpUrl(value));
  assert.throws(() => mcpToken('x', 'test\r\ninjected')); mcpToken('x', 'session-only'); assert.equal(mcpToken('x'), 'session-only'); assert.equal(localStorage.getItem('supergpt-mcp-token:x'), null);
  let count = 0; global.fetch = async () => { count++; return Response.json({ jsonrpc: '2.0', id: 999, result: {} }); };
  await assert.rejects(connectMcp({ url: 'https://example.org/mcp' }, new AbortController().signal), /ID permintaan/); assert.equal(count, 1);
  global.fetch = async () => new Response('', { status: 401 }); await assert.rejects(connectMcp({ url: 'https://example.org/mcp' }, new AbortController().signal), /login atau bearer/);
});

test('failed MCP tool call is not automatically replayed', async t => {
  environment(t); let called = 0;
  global.fetch = async (_, init) => { const p = JSON.parse(init.body); if (p.method === 'initialize') return Response.json({ jsonrpc: '2.0', id: p.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } } }); if (p.method === 'notifications/initialized') return new Response(null, { status: 202 }); if (p.method === 'tools/list') return Response.json({ jsonrpc: '2.0', id: p.id, result: { tools: [tool] } }); called++; throw Error('Connection lost'); };
  const connection = await connectMcp({ url: 'https://example.org/mcp' }, new AbortController().signal); await assert.rejects(connection.call('lookup', {}, new AbortController().signal), /Connection lost/); assert.equal(called, 1); await connection.close();
});

test('loopback MCP relay rejects foreign origins, methods and redirects, forwards only protocol headers', async () => {
  const f = fixture(); let handler; localMcpRelay().configureServer({ middlewares: { use(_, fn) { handler = fn; } } }); const relay = http.createServer(handler), url = await listen(f.server), origin = await listen(relay);
  const payload = { url, token: 'fixture-token', session: '', protocol: '2025-03-26', method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} } };
  const request = (data, source = origin) => fetch(origin, { method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json', Cookie: 'do-not-forward=1', 'X-Arbitrary': 'no' }, body: JSON.stringify(data) });
  const redirect = http.createServer((_, res) => { res.writeHead(302, { Location: url }); res.end(); }), redirectUrl = await listen(redirect);
  try { assert.equal((await request(payload, 'https://foreign.example')).status, 403); assert.equal((await request({ ...payload, body: { ...payload.body, method: 'admin/delete' } })).status, 400); const r = await request(payload); assert.equal(r.status, 200); assert.equal(r.headers.get('Mcp-Session-Id'), 'fixture-session'); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].auth, 'Bearer fixture-token'); assert.equal(f.calls[0].cookie, undefined); assert.equal(f.calls[0].arbitrary, undefined); await r.json(); assert.equal((await request({ ...payload, url: redirectUrl })).status, 502); assert.equal(f.calls.length, 1); } finally { await close(redirect); await close(relay); await close(f.server); }
});

async function directCase(t, action) {
  environment(t); const f = fixture(), url = await listen(f.server), realFetch = global.fetch; let modelCalls = 0, answer = '', finalState;
  localStorage.setItem('supergpt-main-ai-v1', JSON.stringify({ enabled: true, runtime: 'device', api: 'chat', web: false, mcp: true })); localStorage.setItem('client-local-features-v1', JSON.stringify({ mcp: [{ id: 'docs', name: 'Fixture docs', kind: 'http', enabled: true, url }] }));
  const controller = new AbortController();
  global.fetch = async (target, init) => { if (String(target).includes('/chat/completions')) { modelCalls++; const body = JSON.parse(init.body); assert.equal(body.tools[0].function.name, 'mcp_0_0'); if (modelCalls === 1) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'mcp_0_0', arguments: '{"query":' } }] } }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"docs"}' } }] }, finish_reason: 'tool_calls' }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    assert.equal(body.messages.at(-1).role, 'tool'); assert.match(body.messages.at(-1).content, action === 'allow' ? /example.org/ : /denied/); return Response.json({ choices: [{ message: { content: action === 'allow' ? 'Answer with source.' : 'Operation cancelled.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 2 } }); }
    return realFetch(target, init);
  };
  const profile = { id: 'test', name: 'Test', baseUrl: 'https://model.example/v1', auth: 'none', model: 'function-model', models: [] };
  const run = streamMainChat(profile, '', profile.model, [{ role: 'user', text: 'Find docs' }], controller.signal, text => answer = text, undefined, undefined, state => { finalState = state; if (state.pending) { assert.equal(canAnswerAgent(state.runId), true); if (action === 'cancel') controller.abort(Error('User stopped')); else { const item = state.items.at(-1); answerAgent(state.runId, { kind: 'approval', itemId: item.id, callId: 'call_1', allow: action === 'allow' }); } } });
  try { if (action === 'cancel') await assert.rejects(run, /User stopped/); else await run; assert.equal(finalState.active, false); assert.equal(finalState.pending, false); assert.equal(canAnswerAgent(finalState.runId), false); assert.equal(f.calls.filter(call => call.rpc === 'tools/call').length, action === 'allow' ? 1 : 0); if (action === 'allow') { assert.equal(answer, 'Answer with source.'); assert.equal(finalState.sources[0].url, 'https://example.org/docs'); } else assert.equal(finalState.sources.length, 0); } finally { await close(f.server); }
}
test('direct main chat streams tool arguments, waits for exact approval, executes MCP then answers', t => directCase(t, 'allow'));
test('denied MCP tool never executes and the model receives an explicit denial', t => directCase(t, 'deny'));
test('stopping while approval is pending cancels the run and does not call MCP', t => directCase(t, 'cancel'));

test('partial tool stream cannot request approval or execute a remote operation', async t => {
  environment(t); const f = fixture(), url = await listen(f.server), realFetch = global.fetch;
  localStorage.setItem('supergpt-main-ai-v1', JSON.stringify({ enabled: true, runtime: 'device', api: 'chat', web: false, mcp: true }));
  localStorage.setItem('client-local-features-v1', JSON.stringify({ mcp: [{ id: 'docs', name: 'Docs', kind: 'http', enabled: true, url }] }));
  global.fetch = (target, init) => String(target).includes('/chat/completions') ? Promise.resolve(new Response('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'partial', function: { name: 'mcp_0_0', arguments: '{}' } }] } }] }) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } })) : realFetch(target, init);
  const profile = { baseUrl: 'https://model.example/v1', auth: 'none', model: 'fixture' }; let pending = false;
  try { await assert.rejects(streamMainChat(profile, '', 'fixture', [{ role: 'user', text: 'Test' }], new AbortController().signal, () => {}, undefined, undefined, state => { pending ||= state.pending; }), /belum lengkap/); assert.equal(pending, false); assert.equal(f.calls.filter(call => call.rpc === 'tools/call').length, 0); } finally { await close(f.server); }
});

test('custom timeout persists from one second to an hour and reaches validated SDK options', () => {
  assert.equal(normalizeSettings({ timeoutSeconds: 900 }).timeoutSeconds, 900); assert.equal(normalizeSettings({ timeoutSeconds: 99999 }).timeoutSeconds, 3600); assert.equal(normalizeSettings({ timeoutSeconds: .1 }).timeoutSeconds, 1);
  const input = { owner: 'a'.repeat(24), provider: { model: 'fixture', key: '', baseUrl: 'https://model.example/v1' }, options: { timeoutSeconds: 900 }, mcp: [{ name: 'docs', url: 'https://example.org/mcp', token: 'session-fixture' }] };
  const result = validateSession(input); assert.equal(result.options.timeoutSeconds, 900); assert.deepEqual(result.mcpProfiles[0].headers, { Authorization: 'Bearer session-fixture' }); assert.throws(() => validateSession({ ...input, mcp: [{ ...input.mcp[0], token: 'bad\r\nheader' }] }));
});
