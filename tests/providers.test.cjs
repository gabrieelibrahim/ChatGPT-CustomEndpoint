const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => load(path.resolve(path.dirname(file), name + '.ts')), module, module.exports);
  return module.exports;
}
const { streamEndpointChat } = load('src/lib/endpointChat.ts');
const { discoverEndpointModels } = load('src/lib/endpointProfiles.ts');
const profile = { id: 'test', name: 'Custom', baseUrl: 'https://provider.example/v1', model: 'vendor/model', models: [], auth: 'bearer', protocol: 'openai-compatible' };
const realFetch = global.fetch;
test.afterEach(() => { global.fetch = realFetch; delete global.__LOCAL_PROVIDER_RELAY__; delete global.location; });

test('streams fragmented UTF-8 / CRLF events and sends configured model/history only', async () => {
  let sent;
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Halo 🌏"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"!"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
  global.fetch = async (url, options) => { sent = { url, options }; return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } }); };
  const updates = [];
  await streamEndpointChat(profile, 'fake-secret', 'vendor/selected', [{ role: 'user', text: 'Hi' }], new AbortController().signal, text => updates.push(text), 'high');
  assert.equal(updates.at(-1), 'Halo 🌏!');
  assert.equal(sent.url, 'https://provider.example/v1/chat/completions');
  assert.equal(sent.options.headers.Authorization, 'Bearer fake-secret');
  assert.equal(sent.options.redirect, 'error'); assert.equal(sent.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(sent.options.body), { model: 'vendor/selected', stream: true, messages: [{ role: 'user', content: 'Hi' }] });
});
test('supports JSON responses and sends effort only when explicitly enabled', async () => {
  let body;
  global.fetch = async (_, options) => { body = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: 'Ready' } }] }); };
  let answer;
  await streamEndpointChat({ ...profile, sendReasoning: true }, 'fake', profile.model, [], new AbortController().signal, value => { answer = value; }, 'high');
  assert.equal(answer, 'Ready'); assert.equal(body.reasoning_effort, 'high');
});

test('vision attachments produce OpenAI-compatible image content and preserve plain text history', async () => {
  let body;
  global.fetch = async (_, options) => { body = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: 'Image received' } }] }); };
  const image = 'data:image/png;base64,aGVsbG8=';
  await streamEndpointChat(profile, 'fake', profile.model, [{ role: 'assistant', text: 'Earlier' }, { role: 'user', text: 'Describe', images: [image] }], new AbortController().signal, () => {});
  assert.deepEqual(body.messages, [{ role: 'assistant', content: 'Earlier' }, { role: 'user', content: [{ type: 'text', text: 'Describe' }, { type: 'image_url', image_url: { url: image } }] }]);
});
test('does not call network without required session credential', async () => {
  global.fetch = () => { throw Error('Unexpected network'); };
  await assert.rejects(streamEndpointChat(profile, '', profile.model, [], new AbortController().signal, () => {}), /API key sesi/);
});
test('safe errors exclude provider error body and credentials', async () => {
  global.fetch = async () => Response.json({ error: { message: 'leaked fake-secret' } }, { status: 401 });
  await assert.rejects(streamEndpointChat(profile, 'fake-secret', profile.model, [], new AbortController().signal, () => {}), error => /Akses ditolak/.test(error.message) && !error.message.includes('fake-secret'));
});
test('rejects empty / malformed streams instead of showing a demo reply', async () => {
  for (const body of ['data: [DONE]\n\n', 'data: invalid-json\n\n']) {
    global.fetch = async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    await assert.rejects(streamEndpointChat(profile, 'fake', profile.model, [], new AbortController().signal, () => {}));
  }
});
test('discovery deduplicates model IDs and local relay carries secrets in body, not URL', async () => {
  global.__LOCAL_PROVIDER_RELAY__ = true; global.location = { hostname: '127.0.0.1' };
  let sent;
  global.fetch = async (url, options) => { sent = { url, options }; return Response.json({ data: [{ id: 'one' }, { id: 'one' }, { id: 'two' }] }); };
  assert.deepEqual(await discoverEndpointModels(profile.baseUrl, 'fake-secret', new AbortController().signal), ['one', 'two']);
  assert.equal(sent.url, '/__client/provider'); assert.equal(sent.options.method, 'POST');
  assert.deepEqual(JSON.parse(sent.options.body), { url: profile.baseUrl + '/models', key: 'fake-secret' });
});
test('development relay enforces loopback/same-origin and forwards models and streaming safely', async () => {
  const { localProviderRelay } = await import('../scripts/localProviderRelay.mjs');
  const received = [];
  const upstream = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({ path: req.url, key: req.headers.authorization, body });
    if (req.url === '/v1/redirect/models') { res.writeHead(302, { Location: '/v1/models' }); res.end(); return; }
    if (req.url === '/v1/chat/completions') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'); res.end('data: [DONE]\n\n'); return; }
    if (req.url === '/v1/denied/models') { res.writeHead(401); res.end('secret-body-must-not-be-forwarded'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"data":[{"id":"local-model"}]}');
  });
  let middleware;
  localProviderRelay().configureServer({ middlewares: { use(route, handler) { assert.equal(route, '/__client/provider'); middleware = handler; } } });
  const relay = http.createServer((req, res) => middleware(req, res));
  await Promise.all([new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve)), new Promise(resolve => relay.listen(0, '127.0.0.1', resolve))]);
  const origin = 'http://127.0.0.1:' + relay.address().port, target = 'http://127.0.0.1:' + upstream.address().port;
  const call = (url, extra = {}, originHeader = origin) => realFetch(origin + '/__client/provider', { method: 'POST', headers: { Origin: originHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ url, key: 'fake-key', ...extra }) });
  try {
    assert.equal((await call(target + '/v1/models', {}, 'https://untrusted.example')).status, 403);
    assert.equal((await call(target + '/unrelated')).status, 400);
    assert.equal((await call('http://remote.example/v1/models')).status, 400);
    const models = await call(target + '/v1/models'); assert.deepEqual(await models.json(), { data: [{ id: 'local-model' }] });
    assert.equal(received[0].key, 'Bearer fake-key'); assert.equal(models.headers.get('cache-control'), 'no-store');
    const stream = await call(target + '/v1/chat/completions', { body: { model: 'local-model', messages: [], stream: true } }); assert.match(await stream.text(), /\[DONE\]/);
    const denied = await call(target + '/v1/denied/models'); assert.equal(denied.status, 401); assert.ok(!(await denied.text()).includes('secret-body'));
    assert.equal((await call(target + '/v1/redirect/models')).status, 502);
  } finally { await Promise.all([new Promise(resolve => relay.close(resolve)), new Promise(resolve => upstream.close(resolve))]); }
});
