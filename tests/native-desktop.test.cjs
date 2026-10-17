const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const built = buildSync({ absWorkingDir: root, stdin: { contents: "export * from './src/lib/nativeDesktop'; export * from './src/lib/providerTransport'; export * from './src/lib/endpointChat';", resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'cjs' });
const mod = new Module(__filename + '.fixture', module);
mod.filename = __filename + '.fixture'; mod.paths = module.paths;
mod._compile(built.outputFiles[0].text, mod.filename);
const client = mod.exports;
const originalWindow = global.window, originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });

function nativeTransport(body, contentType = 'application/json') {
  const calls = []; let read = false;
  global.window = { __TAURI_INTERNALS__: { invoke: async (command, payload) => {
    calls.push({ command, payload });
    if (command === 'plugin:http|fetch') return 1;
    if (command === 'plugin:http|fetch_send') return { status: 200, statusText: 'OK', url: 'https://provider.example/v1/chat/completions', headers: [['content-type', contentType]], rid: 2 };
    if (command === 'plugin:http|fetch_read_body') { if (read) return [1]; read = true; return [...new TextEncoder().encode(body), 0]; }
    if (command === 'plugin:http|fetch_cancel' || command === 'plugin:http|fetch_cancel_body') return;
    throw Error('Unexpected native command: ' + command);
  } } };
  global.fetch = () => { throw Error('Native provider must not use browser fetch or development relay'); };
  return calls;
}

test('native provider uses Rust HTTP with session credential and redirects disabled', async () => {
  const calls = nativeTransport('{"data":[{"id":"configured-model"}]}');
  assert.equal(client.isNativeDesktop(), true);
  assert.equal(client.usesLocalProviderRelay(), false);
  const response = await client.providerFetch('https://provider.example/v1/models', 'fake-test-key', new AbortController().signal);
  assert.equal((await response.json()).data[0].id, 'configured-model');
  const config = calls[0].payload.clientConfig;
  assert.equal(config.method, 'GET');
  assert.equal(config.maxRedirections, 0);
  assert.deepEqual(config.headers.find(([name]) => name === 'authorization'), ['authorization', 'Bearer fake-test-key']);
});

test('native response stream reaches existing reasoning and answer parser', async () => {
  nativeTransport('data: {"choices":[{"delta":{"reasoning_content":"Checking"}}]}\n\ndata: {"choices":[{"delta":{"content":"Native reply"}}]}\n\ndata: [DONE]\n\n', 'text/event-stream');
  const updates = [];
  const profile = { id: 'test', name: 'Test', baseUrl: 'https://provider.example/v1', model: 'configured-model', models: [], auth: 'bearer', protocol: 'openai-compatible' };
  await client.streamEndpointChat(profile, 'fake-test-key', 'configured-model', [{ role: 'user', text: 'Hello' }], new AbortController().signal, (...update) => updates.push(update));
  assert.ok(updates.some(update => update[0] === 'Native reply'));
  assert.ok(updates.some(update => update[1] === 'Checking'));
});

test('cancelled native request does not create an IPC request', async () => {
  const calls = nativeTransport('{}'), controller = new AbortController(); controller.abort();
  await assert.rejects(client.providerFetch('https://provider.example/v1/models', '', controller.signal));
  assert.equal(calls.length, 0);
});

test('native transport rejects insecure or credential-bearing destinations before IPC', async () => {
  const calls = nativeTransport('{}');
  for (const url of ['http://provider.example/v1/models', 'https://user:secret@provider.example/v1/models', 'https://provider.example/v1/models?key=secret', 'file:///private']) {
    await assert.rejects(client.nativeProviderFetch(url, {}), /endpoint HTTPS/);
  }
  assert.equal(calls.length, 0);
});

test('native agent channel exposes streamed Unicode output as an ordinary Response', async () => {
  global.window = { __TAURI_INTERNALS__: { transformCallback: () => 1, invoke: async (command, payload) => {
    assert.equal(command, 'native_agent_request'); assert.equal(payload.payload.action, 'status');
    queueMicrotask(() => {
      payload.onEvent.onmessage({ type: 'headers', status: 200, headers: [['content-type', 'application/x-ndjson']] });
      payload.onEvent.onmessage({ type: 'chunk', data: Buffer.from('{"text":"selesai ✓"}\n').toString('base64') });
      payload.onEvent.onmessage({ type: 'end' });
    });
  } } };
  const response = await client.nativeAgentRequest({ action: 'status' });
  assert.equal(response.headers.get('content-type'), 'application/x-ndjson');
  assert.equal(await response.text(), '{"text":"selesai ✓"}\n');
});

test('native agent abort cancels the matching Rust request and errors its stream', async () => {
  const calls = [], controller = new AbortController();
  global.window = { __TAURI_INTERNALS__: { transformCallback: () => 1, invoke: async (command, payload) => {
    calls.push({ command, payload });
    if (command === 'native_agent_request') queueMicrotask(() => payload.onEvent.onmessage({ type: 'headers', status: 200, headers: [] }));
  } } };
  const response = await client.nativeAgentRequest({ action: 'turn' }, controller.signal);
  const body = response.text(); controller.abort(); await assert.rejects(body, /abort/i);
  assert.equal(calls[1].command, 'native_agent_cancel');
  assert.equal(calls[0].payload.requestId, calls[1].payload.requestId);
});
