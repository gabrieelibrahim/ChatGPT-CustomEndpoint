import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ entryPoints: ['src/agent/mainClient.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { streamMainChat, answerAgent, canAnswerAgent, consumeAgentEvents } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };
const stream = events => new Response(events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join(''), { headers: { 'Content-Type': 'text/event-stream' } });
function setup(t) {
  const previous = Object.fromEntries(['location', 'localStorage', 'sessionStorage', 'fetch', 'window'].map(key => [key, global[key]]));
  global.location = { origin: 'http://127.0.0.1:1420', href: 'http://127.0.0.1:1420/?mobile=1' };
  global.localStorage = storage(); global.sessionStorage = storage(); global.window = new EventTarget();
  localStorage.setItem('supergpt-main-ai-v1', JSON.stringify({ enabled: true, server: location.origin, web: true, mcp: true }));
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } });
}
const profile = { id: 'fixture', name: 'Fixture', baseUrl: 'http://localhost:19092/v1', model: 'fixture-model', models: ['fixture-model'], auth: 'none' };

test('main client resumes approved tool in the same message, merges text and verified sources, and closes session', async t => {
  setup(t); const calls = [], states = []; let text = '', usage;
  fetch = async (input, init) => {
    const request = new Request(input, init), body = await request.text(); calls.push({ url: request.url, method: request.method, body });
    if (request.method === 'DELETE') return Response.json({});
    if (request.url.endsWith('/session')) return Response.json({ token: 'opaque-fixture' });
    const payload = JSON.parse(body);
    if (!payload.resume) return stream([
      { type: 'main.run', id: 'run_1' },
      { type: 'thread.item.added', item: { id: 'msg_1', type: 'assistant_message', content: [] } },
      { type: 'thread.item.updated', item_id: 'msg_1', update: { type: 'assistant_message.content_part.text_delta', delta: 'Memeriksa. ' } },
      { type: 'thread.item.done', item: { id: 'widget_1', type: 'widget', widget: { type: 'Card', children: [{ type: 'Button', label: 'Izinkan sekali', onClickAction: { type: 'tool.approve', payload: { callId: 'tool_1', allow: true } } }] } } },
      { type: 'client_effect', name: 'sdk.usage', data: { input: 4, output: 2 } },
      { type: 'main.paused', id: 'run_1' },
    ]);
    assert.deepEqual(payload.decision, { kind: 'approval', itemId: 'widget_1', callId: 'tool_1', allow: true });
    return stream([
      { type: 'thread.item.replaced', item: { id: 'widget_1', type: 'widget', widget: { type: 'Card', children: [{ type: 'Text', value: 'Disetujui sekali' }] } } },
      { type: 'main.sources', sources: [{ title: 'Real result fixture', url: 'https://example.org/source' }, { title: 'Unsafe', url: 'javascript:alert(1)' }] },
      { type: 'thread.item.done', item: { id: 'msg_2', type: 'assistant_message', content: [{ text: 'Hasil dengan [sumber](https://example.org/source).' }] } },
      { type: 'client_effect', name: 'sdk.usage', data: { input: 7, output: 3 } },
      { type: 'main.done', id: 'run_1' },
    ]);
  };
  await streamMainChat(profile, '', profile.model, [{ role: 'user', text: 'Task fixture' }], new AbortController().signal, value => text = value, 'low', value => usage = value, state => {
    states.push(state);
    if (state.pending) { assert.equal(canAnswerAgent(state.runId), true); assert.equal(answerAgent(state.runId, { kind: 'approval', itemId: 'widget_1', callId: 'tool_1', allow: true }), true); assert.equal(answerAgent(state.runId, { kind: 'approval', itemId: 'widget_1', callId: 'tool_1', allow: true }), false); }
  });
  assert.equal(text, 'Memeriksa. \n\nHasil dengan [sumber](https://example.org/source).');
  assert.deepEqual(usage, { input: 11, output: 5 });
  assert.deepEqual(states.at(-1).sources, [{ title: 'Real result fixture', url: 'https://example.org/source' }]);
  assert.equal(states.at(-1).active, false); assert.equal(canAnswerAgent('run_1'), false);
  assert.equal(calls.filter(call => call.url.endsWith('/main')).length, 2);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(JSON.parse(calls[0].body).provider.model, profile.model);
});

test('stop while waiting for approval cancels without executing or resuming the tool', async t => {
  setup(t); const controller = new AbortController(), requests = []; let final;
  fetch = async (input, init) => {
    const request = new Request(input, init); requests.push(request);
    if (request.method === 'DELETE') return Response.json({});
    return request.url.endsWith('/session') ? Response.json({ token: 'fixture' }) : stream([{ type: 'main.run', id: 'cancel_me' }, { type: 'main.paused' }]);
  };
  await assert.rejects(streamMainChat(profile, '', profile.model, [{ role: 'user', text: 'fixture' }], controller.signal, () => {}, 'low', undefined, state => { final = state; if (state.pending) controller.abort(); }));
  assert.equal(canAnswerAgent('cancel_me'), false); assert.equal(final.active, false); assert.equal(final.pending, false);
  assert.equal(requests.filter(request => request.url.endsWith('/main')).length, 1);
});

test('malformed and truncated event streams fail visibly rather than pretending completion', async () => {
  await assert.rejects(consumeAgentEvents(new Response('data: not-json\n\n'), new AbortController().signal, () => {}));
  await assert.rejects(consumeAgentEvents(stream([{ type: 'error', message: 'Provider unavailable' }]), new AbortController().signal, () => {}), /Provider unavailable/);
});
