import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SdkService, sdkHandler, readBody } from '../server/sdk/service.mjs';
import { calculate } from '../server/sdk/agents.mjs';

const owner = 'sdk_test_owner_123456789012345';
const input = text => ({ content: [{ type: 'input_text', text }], attachments: [], inference_options: {} });
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
const stop = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });

async function fixture(t, opts = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'supergpt-sdk-test-')), requests = [];
  const provider = createServer(async (req, res) => {
    const rawBody = req.method === 'POST' ? await readBody(req, opts.providerBodyLimit) : Buffer.alloc(0);
    const body = req.headers['content-type']?.startsWith('multipart/form-data') ? {} : JSON.parse(rawBody.toString() || '{}');
    requests.push({ path: req.url, body, authorization: req.headers.authorization });
    if (req.url === '/v1/audio/transcriptions') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ text: 'Transkripsi fixture' })); return; }
    if (req.url === '/v1/realtime/client_secrets') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ value: 'ek_local_fixture_not_real' })); return; }
    if (req.url === '/v1/responses') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' }); let sequence = 0;
      const emit = event => res.write('data: ' + JSON.stringify({ ...event, sequence_number: sequence++ }) + '\n\n');
      const annotation = { type: 'url_citation', start_index: 0, end_index: 7, title: 'Fixture source', url: 'https://example.org/reference' };
      const message = { type: 'message', id: 'msg_fixture', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'Sources fixture', annotations: [annotation] }] };
      const image = { type: 'image_generation_call', id: 'image_fixture', status: 'completed', result: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
      const response = { id: 'resp_fixture', object: 'response', created_at: 1, model: body.model, output: [], status: 'in_progress', usage: null };
      emit({ type: 'response.created', response });
      emit({ type: 'response.output_item.added', output_index: 0, item: { ...message, status: 'in_progress', content: [] } });
      emit({ type: 'response.content_part.added', item_id: message.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } });
      emit({ type: 'response.output_text.delta', item_id: message.id, output_index: 0, content_index: 0, delta: 'Sources fixture' });
      emit({ type: 'response.content_part.done', item_id: message.id, output_index: 0, content_index: 0, part: message.content[0] });
      emit({ type: 'response.output_item.done', output_index: 0, item: message });
      emit({ type: 'response.output_item.done', output_index: 1, item: image });
      emit({ type: 'response.completed', response: { ...response, status: 'completed', output: [message, image], usage: { input_tokens: 12, output_tokens: 7, total_tokens: 19, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } } }); res.end(); return;
    }
    const toolResult = [...(body.messages || [])].reverse().find(item => item.role === 'tool');
    const user = [...(body.messages || [])].reverse().find(item => item.role === 'user');
    const text = typeof user?.content === 'string' ? user.content : user?.content?.map(part => part.text || '').join('') || '';
    if (text === 'error fixture') { res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { message: 'secret-test-key' } })); return; }
    let name, args;
    if (!toolResult && text.includes('calculate fixture')) { name = 'calculate'; args = { expression: '6 * 7' }; }
    if (!toolResult && text.includes('save fixture')) { name = 'save_note'; args = { text: 'Catatan fixture' }; }
    if (!toolResult && text.includes('handoff fixture') && body.tools?.some(tool => tool.function.name.toLowerCase().includes('analis'))) { name = body.tools.find(tool => tool.function.name.toLowerCase().includes('analis')).function.name; args = {}; }
    if (!toolResult && text.includes('card fixture')) { name = 'show_checklist'; args = { title: 'Rencana fixture', items: ['Satu', 'Dua'] }; }
    if (!toolResult && text.includes('question fixture')) { name = 'ask_user'; args = { question: 'Pilih format?', options: ['Singkat', 'Rinci'] }; }
    if (!toolResult && text.includes('mcp fixture')) { name = body.tools.find(tool => tool.function.name.includes('echo')).function.name; args = { text: 'MCP fixture' }; }
    if (!toolResult && text.includes('web fixture')) { name = 'web_search'; args = { query: 'Public SDK documentation fixture' }; }
    const chunk = (delta, finish_reason = null) => 'data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] }) + '\n\n';
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (name) {
      res.write(chunk({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_fixture_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] })); res.write(chunk({}, 'tool_calls'));
    } else {
      res.write(chunk({ role: 'assistant', content: toolResult ? 'Hasil tool: ' + toolResult.content : 'Jawaban fixture. ' })); res.write(chunk({ content: 'Selesai.' })); res.write(chunk({}, 'stop'));
    }
    res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 } }) + '\n\n'); res.end('data: [DONE]\n\n');
  });
  const providerUrl = await listen(provider), service = new SdkService({ directory, ...opts }), server = createServer(sdkHandler(service)), url = await listen(server);
  t.after(async () => { service.close(); await stop(server); await stop(provider); await rm(directory, { recursive: true, force: true }); });
  let token;
  const call = async (path, body, headers = {}) => fetch(url + '/__sdk' + path, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: JSON.stringify(body) });
  const payload = { owner, provider: { baseUrl: providerUrl + '/v1', model: 'fixture-model', models: ['fixture-model', 'second-model'], key: 'secret-test-key' }, options: { tools: true } };
  const sessionResponse = await call('/session', payload); assert.equal(sessionResponse.status, 200); token = (await sessionResponse.json()).token;
  const stream = async request => { const response = await call('/chatkit', request); const text = await response.text(); return { response, text, events: text.split('\n\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))) }; };
  return { directory, service, server, url, providerUrl, requests, call, stream, payload, get token() { return token; } };
}

test('arithmetic has no evaluation or non-finite escape', () => {
  assert.equal(calculate('(2 + 5) * -3'), -21);
  for (const value of ['process.exit()', '1/0', '2 3', '1..2', '(()', '1e3']) assert.throws(() => calculate(value));
});

test('real Agents SDK streams, calls a function, retains tool history and provider usage', async t => {
  const f = await fixture(t), result = await f.stream({ type: 'threads.create', params: { input: input('calculate fixture') } });
  assert.equal(result.response.status, 200); assert.ok(!result.events.some(event => event.type === 'error'), result.text);
  assert.ok(result.events.some(event => event.update?.delta?.includes('42')), result.text);
  assert.equal(f.requests.length, 2); assert.equal(f.requests[0].body.model, 'fixture-model');
  assert.equal(f.requests[0].authorization, 'Bearer secret-test-key'); assert.equal(f.requests[0].body.store, false);
  assert.ok(f.requests[1].body.messages.some(message => message.role === 'tool' && message.content.includes('42')));
  const threadId = result.events.find(event => event.type === 'thread.created').thread.id;
  const stored = f.service.store.thread(owner, threadId); assert.ok(stored.sdkHistory.length >= 4); assert.ok(stored.usage.input > 0);
  const persisted = await readFile(join(f.service.store.directory(owner), 'store.json'), 'utf8'); assert.ok(!persisted.includes('secret-test-key'));
  const reloaded = new SdkService({ directory: f.directory }); assert.equal(reloaded.store.thread(owner, threadId).items.length, stored.items.length); reloaded.close();
  const next = await f.stream({ type: 'threads.add_user_message', params: { thread_id: threadId, input: { ...input('next fixture'), inference_options: { model: 'second-model' } } } });
  assert.ok(!next.events.some(event => event.type === 'error'), next.text); assert.equal(f.requests.at(-1).body.model, 'second-model');
});

test('exact approval pauses before a note write, resumes once and rejects duplicate action', async t => {
  const f = await fixture(t), first = await f.stream({ type: 'threads.create', params: { input: input('save fixture') } });
  assert.ok(!first.events.some(event => event.type === 'error'), first.text);
  assert.equal(f.service.store.load(owner).notes.length, 0);
  const threadId = first.events.find(event => event.type === 'thread.created').thread.id, widget = first.events.find(event => event.item?.type === 'widget').item;
  const approve = widget.widget.children.find(child => child.type === 'Button').onClickAction;
  const result = await f.stream({ type: 'threads.custom_action', params: { thread_id: threadId, item_id: widget.id, action: approve } });
  assert.ok(!result.events.some(event => event.type === 'error'), result.text); assert.equal(f.service.store.load(owner).notes.length, 1);
  await f.stream({ type: 'threads.custom_action', params: { thread_id: threadId, item_id: widget.id, action: approve } });
  assert.equal(f.service.store.load(owner).notes.length, 1);
});

test('real SDK handoff and checklist widget actions are emitted', async t => {
  const f = await fixture(t), result = await f.stream({ type: 'threads.create', params: { input: input('handoff fixture') } });
  assert.ok(!result.events.some(event => event.type === 'error'), result.text);
  assert.ok(result.events.some(event => event.text?.includes('spesialis')), result.text);
  const card = await f.stream({ type: 'threads.create', params: { input: input('card fixture') } });
  assert.ok(!card.events.some(event => event.type === 'error'), card.text);
  assert.ok(card.events.some(event => event.item?.widget?.children.some(child => child.onClickAction?.type === 'checklist.copy')), card.text);
});

test('history rename, pagination, feedback, retry and delete persist through the protocol', async t => {
  const f = await fixture(t), first = await f.stream({ type: 'threads.create', params: { input: input('history fixture') } });
  const threadId = first.events.find(event => event.type === 'thread.created').thread.id, assistant = first.events.find(event => event.type === 'thread.item.done' && event.item.type === 'assistant_message').item;
  assert.equal((await f.call('/chatkit', { type: 'threads.update', params: { thread_id: threadId, title: 'Changed' } })).status, 200);
  const list = await (await f.call('/chatkit', { type: 'threads.list', params: { limit: 1 } })).json(); assert.equal(list.data[0].title, 'Changed');
  await f.call('/chatkit', { type: 'items.feedback', params: { thread_id: threadId, item_ids: [assistant.id], kind: 'positive' } }); assert.equal(f.service.store.load(owner).feedback[0].kind, 'positive');
  const retry = await f.stream({ type: 'threads.retry_after_item', params: { thread_id: threadId, item_id: assistant.id } });
  assert.ok(!retry.events.some(event => event.type === 'error'), retry.text); assert.ok(retry.events.some(event => event.type === 'thread.item.removed'));
  assert.equal(f.service.store.thread(owner, threadId).sdkHistory.filter(item => item.role === 'user').length, 1);
  await f.call('/chatkit', { type: 'threads.delete', params: { thread_id: threadId } }); assert.equal(f.service.store.load(owner).threads.length, 0);
});

test('two-phase text uploads bind to a thread; foreign files and unsupported formats are rejected', async t => {
  const f = await fixture(t), bytes = Buffer.from('Real fixture text');
  const file = await (await f.call('/chatkit', { type: 'attachments.create', params: { name: 'fixture.txt', size: bytes.length, mime_type: 'text/plain' } })).json();
  const upload = await fetch(file.upload_descriptor.url, { method: 'PUT', headers: { ...file.upload_descriptor.headers, Origin: f.url }, body: bytes }); assert.equal(upload.status, 200);
  const message = input('read fixture'); message.attachments = [file.id];
  const first = await f.stream({ type: 'threads.create', params: { input: message } }); assert.ok(!first.events.some(event => event.type === 'error'), first.text);
  assert.ok(JSON.stringify(f.requests.at(-1).body).includes('Real fixture text'));
  assert.equal((await f.call('/chatkit', { type: 'attachments.create', params: { name: 'bad.exe', size: 1, mime_type: 'application/octet-stream' } })).status, 400);
  assert.equal((await f.stream({ type: 'threads.create', params: { input: message } })).response.status, 400);
});

test('SDK accepts large uploads and multiple attachments while preserving ownership and size consistency', async t => {
  const f = await fixture(t);
  const data = f.service.store.load(owner);
  data.files = Array.from({ length: 200 }, (_, n) => ({ id: 'existing_' + n, name: 'old.txt', size: 1, mime_type: 'text/plain', uploaded: false }));
  f.service.store.save(owner, data);
  const bytes = Buffer.alloc(11 * 1024 * 1024, 'x'); bytes.write('end-marker', bytes.length - 10);
  const refs = [];
  for (let n = 0; n < 6; n++) {
    const contents = n === 0 ? bytes : Buffer.from('attachment-' + n);
    const created = await f.call('/chatkit', { type: 'attachments.create', params: { name: 'large-' + n + '.txt', size: contents.length, mime_type: 'text/plain' } });
    assert.equal(created.status, 200);
    const file = await created.json(); refs.push(file.id);
    const send = (body, headers = file.upload_descriptor.headers) => fetch(file.upload_descriptor.url, { method: 'PUT', headers: { ...headers, Origin: f.url }, body });
    if (n === 0) {
      assert.equal((await send(contents, { ...file.upload_descriptor.headers, Authorization: 'Bearer foreign-session' })).status, 401);
      assert.equal((await send(Buffer.from('short'))).status, 400);
    }
    if (n === 1) assert.equal((await send(Buffer.concat([contents, Buffer.from('extra')]))).status, 400);
    assert.equal((await send(contents)).status, 200);
  }
  assert.equal(f.service.store.load(owner).files.length, 206);
  const message = { ...input('read attached files'), attachments: refs };
  const result = await f.stream({ type: 'threads.create', params: { input: message } });
  assert.equal(result.response.status, 200); assert.ok(!result.events.some(e => e.type === 'error'), result.text);
  const sent = f.requests.at(-1).body.messages.find(m => m.role === 'user').content;
  const text = typeof sent === 'string' ? sent : sent.map(p => p.text || '').join('');
  assert.ok(text.includes(bytes.toString())); assert.ok(text.includes('attachment-5'));
});

test('loopback origin, opaque session isolation, validation and error redaction', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/session', f.payload, { Origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await f.call('/chatkit', { type: 'threads.list' }, { Authorization: 'Bearer bad' })).status, 401);
  assert.equal((await f.call('/session', { ...f.payload, provider: { ...f.payload.provider, baseUrl: 'https://user:password@example.test' } })).status, 400);
  const result = await f.stream({ type: 'threads.create', params: { input: input('error fixture') } });
  assert.ok(!result.text.includes('secret-test-key')); assert.ok(result.events.some(event => event.type === 'error'), result.text);
  const other = f.service.createSession({ ...f.payload, owner: 'other_owner_1234567890123456789' });
  const threadId = result.events.find(event => event.type === 'thread.created').thread.id;
  assert.equal((await f.call('/chatkit', { type: 'threads.get_by_id', params: { thread_id: threadId } }, { Authorization: 'Bearer ' + other.token })).status, 400);
});

test('client tool completion and import are persistent and idempotent', async t => {
  const f = await fixture(t), imported = { chats: [{ title: 'Old fixture', messages: [{ role: 'user', text: 'Older question' }, { role: 'assistant', text: 'Older answer' }] }] };
  assert.equal((await (await f.call('/import', imported)).json()).count, 1); assert.equal((await (await f.call('/import', imported)).json()).count, 0);
  const threadId = f.service.store.load(owner).threads[0].id;
  const call = await f.stream({ type: 'threads.custom_action', params: { thread_id: threadId, action: { type: 'app.preferences' } } }); assert.ok(call.events.some(event => event.item?.name === 'get_display_preferences'));
  const completed = await f.stream({ type: 'threads.add_client_tool_output', params: { thread_id: threadId, result: { theme: 'dark', ignored: 'not persisted' } } }); assert.ok(completed.events.some(event => event.item?.content?.[0].text.includes('dark')));
  assert.ok(!JSON.stringify(f.service.store.load(owner)).includes('not persisted'));
});

test('transcription and Realtime contracts require explicitly configured models', async t => {
  const f = await fixture(t); assert.equal((await f.call('/realtime', {})).status, 400);
  const authorized = f.service.createSession({ ...f.payload, options: { transcriptionModel: 'transcription-fixture', realtimeModel: 'realtime-fixture' } });
  const response = await f.call('/realtime', {}, { Authorization: 'Bearer ' + authorized.token }); const value = await response.json();
  assert.equal(response.status, 200); assert.equal(value.value, 'ek_local_fixture_not_real'); assert.equal(value.callsUrl, f.providerUrl + '/v1/realtime/calls');
  assert.equal(f.requests.at(-1).body.session.model, 'realtime-fixture');
  const transcript = await f.call('/chatkit', { type: 'input.transcribe', params: { audio_base64: Buffer.from('synthetic fixture bytes only').toString('base64'), mime_type: 'audio/webm;codecs=opus' } }, { Authorization: 'Bearer ' + authorized.token });
  assert.equal(transcript.status, 200); assert.equal((await transcript.json()).text, 'Transkripsi fixture');
});

test('structured questions pause and resume with the actual submitted answer', async t => {
  const f = await fixture(t), first = await f.stream({ type: 'threads.create', params: { input: input('question fixture') } });
  assert.ok(!first.events.some(event => event.type === 'error'), first.text);
  const question = first.events.find(event => event.item?.type === 'structured_input').item, callId = question.inputs[0].id;
  const answer = await f.stream({ type: 'threads.add_structured_input', params: { thread_id: question.thread_id, item_id: question.id, input: { status: 'answered', answers: { [callId]: { values: ['Singkat'] } } } } });
  assert.ok(!answer.events.some(event => event.type === 'error'), answer.text);
  assert.ok(f.requests.at(-1).body.messages.some(message => message.role === 'tool' && message.content.includes('Singkat')));
});

test('MCP HTTP tool uses the real SDK transport and executes only after approval', async t => {
  let called = 0;
  const server = createServer(async (req, res) => {
    if (req.method === 'DELETE') { res.writeHead(200).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const request = JSON.parse((await readBody(req)).toString());
    if (request.id === undefined) { res.writeHead(202).end(); return; }
    let result = {};
    if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } };
    if (request.method === 'tools/list') result = { tools: [{ name: 'echo', description: 'Read-only fixture echo.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }] };
    if (request.method === 'tools/call') { called++; result = { content: [{ type: 'text', text: request.params.arguments.text }] }; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  const url = await listen(server); t.after(() => stop(server));
  const f = await fixture(t, { mcpProfiles: [{ name: 'fixture', url }] });
  const token = f.service.createSession({ ...f.payload, options: { tools: true, mcp: true } }).token;
  const execute = async body => { const response = await f.call('/chatkit', body, { Authorization: 'Bearer ' + token }); return (await response.text()).split('\n\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))); };
  const first = await execute({ type: 'threads.create', params: { input: input('mcp fixture') } }); assert.ok(!first.some(event => event.type === 'error'), JSON.stringify(first)); assert.equal(called, 0);
  const widget = first.find(event => event.item?.type === 'widget').item, action = widget.widget.children.find(child => child.type === 'Button').onClickAction;
  const resumed = await execute({ type: 'threads.custom_action', params: { thread_id: widget.thread_id, item_id: widget.id, action } }); assert.ok(!resumed.some(event => event.type === 'error'), JSON.stringify(resumed)); assert.equal(called, 1);
});

test('Responses hosted capabilities, citations and generated images flow through the real SDK', async t => {
  const f = await fixture(t), token = f.service.createSession({ ...f.payload, options: { api: 'responses', web: true, code: true, images: true, vectorStores: ['vs_fixture'] } }).token;
  const response = await f.call('/chatkit', { type: 'threads.create', params: { input: input('responses fixture') } }, { Authorization: 'Bearer ' + token });
  const text = await response.text(), events = text.split('\n\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  assert.ok(!events.some(event => event.type === 'error'), text);
  assert.equal(f.requests.at(-1).path, '/v1/responses');
  const types = f.requests.at(-1).body.tools.map(tool => tool.type);
  for (const type of ['web_search', 'code_interpreter', 'image_generation', 'file_search']) assert.ok(types.some(value => value.startsWith(type)), JSON.stringify(types));
  assert.ok(events.some(event => event.item?.content?.[0]?.annotations?.some(value => value.source.url === 'https://example.org/reference')), text);
  const image = events.find(event => event.item?.type === 'generated_image')?.item;
  assert.ok(image?.image.url, text); assert.equal((await fetch(image.image.url)).status, 200);
});

const mainStream = async (f, payload, token = f.token) => {
  const response = await f.call('/main', payload, { Authorization: 'Bearer ' + token });
  const text = await response.text();
  const events = text.split('\n\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  return { response, text, events };
};
const mainInput = text => ({ messages: [{ role: 'user', text }] });

test('main chat forwards inline media above the old 32 MB envelope and large hydrated document text', async t => {
  const f = await fixture(t, { providerBodyLimit: Infinity });
  const image = 'data:image/png;base64,' + 'A'.repeat(33 * 1024 * 1024);
  const text = 'document-data '.repeat(20000) + 'end-marker';
  const result = await mainStream(f, { messages: [{ role: 'user', text, images: [image] }] });
  assert.equal(result.response.status, 200); assert.ok(result.events.some(e => e.type === 'main.done'), result.text);
  const sent = f.requests.at(-1).body.messages.find(m => m.role === 'user').content;
  assert.equal(sent.find(p => p.type === 'image_url').image_url.url, image);
  assert.ok(sent.some(p => p.text === text));
});

test('main chat uses current device history, function calls, and never creates a second server history', async t => {
  const f = await fixture(t), messages = [{ role: 'user', text: 'Previous question' }, { role: 'assistant', text: 'Previous answer' }, { role: 'user', text: 'calculate fixture' }];
  const result = await mainStream(f, { messages });
  assert.equal(result.response.status, 200); assert.ok(result.events.some(e => e.type === 'main.done'), result.text);
  assert.ok(result.events.some(e => e.update?.delta?.includes('42')), result.text);
  assert.ok(f.requests[0].body.messages.some(m => m.content === 'Previous answer'));
  assert.equal(f.service.store.load(owner).threads.length, 0);
  assert.equal(f.service.main.runs.size, 0);
});

test('main chat approval is inline, owner-bound, exactly once, and temporary notes never persist', async t => {
  const f = await fixture(t), first = await mainStream(f, { ...mainInput('save fixture'), temporary: true });
  assert.ok(first.events.some(e => e.type === 'main.paused'), first.text);
  assert.equal(f.service.store.load(owner).notes.length, 0);
  const run = first.events.find(e => e.type === 'main.run').id, item = first.events.find(e => e.item?.type === 'widget').item;
  const action = item.widget.children.find(e => e.type === 'Button').onClickAction;
  const decision = { kind: 'approval', itemId: item.id, ...action.payload };
  const foreign = f.service.createSession({ ...f.payload, owner: 'foreign_owner_1234567890123456' }).token;
  assert.equal((await mainStream(f, { resume: run, decision }, foreign)).response.status, 400);
  assert.equal((await mainStream(f, { resume: run, decision: { ...decision, callId: 'wrong' } })).response.status, 400);
  const final = await mainStream(f, { resume: run, decision });
  assert.ok(final.events.some(e => e.type === 'main.done'), final.text);
  assert.equal(f.service.store.load(owner).notes.length, 0);
  assert.equal((await mainStream(f, { resume: run, decision })).response.status, 400);
});

test('main chat structured input and checklist remain message items in the same run', async t => {
  const f = await fixture(t), first = await mainStream(f, mainInput('question fixture'));
  const run = first.events.find(e => e.type === 'main.run').id, item = first.events.find(e => e.item?.type === 'structured_input').item;
  const final = await mainStream(f, { resume: run, decision: { kind: 'answer', itemId: item.id, text: 'Rinci' } });
  assert.ok(final.events.some(e => e.type === 'main.done'), final.text);
  assert.ok(f.requests.at(-1).body.messages.some(m => m.role === 'tool' && m.content.includes('Rinci')));
  const checklist = await mainStream(f, mainInput('card fixture'));
  assert.ok(checklist.events.some(e => e.item?.widget?.children.some(child => child.onClickAction?.type === 'checklist.copy')), checklist.text);
});

async function mainMcpFixture(t, quota = false) {
  const calls = [], server = createServer(async (req, res) => {
    if (req.method === 'DELETE') { res.writeHead(200).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const request = JSON.parse((await readBody(req)).toString());
    if (request.id === undefined) { res.writeHead(202).end(); return; }
    let result = {};
    if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'main-fixture', version: '1' } };
    if (request.method === 'tools/list') result = { tools: [{ name: 'echo', description: 'Synthetic echo only.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }] };
    if (request.method === 'tools/call') {
      calls.push(request.params);
      result = { content: [{ type: 'text', text: quota ? "You've hit Exa's free MCP rate limit." : request.params.name === 'web_search_exa' ? 'Title: Fixture public reference\nURL: https://example.org/main-source\nText: Synthetic search evidence.' : request.params.arguments.text }] };
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  const url = await listen(server); t.after(() => stop(server)); return { url, calls };
}

test('main chat discovers HTTP MCP profiles from the existing Plugin menu and waits for approval', async t => {
  const mcp = await mainMcpFixture(t), f = await fixture(t);
  const token = f.service.createSession({ ...f.payload, options: { tools: true, mcp: true }, mcp: [{ name: 'Menu Plugin', url: mcp.url }] }).token;
  const first = await mainStream(f, mainInput('mcp fixture'), token);
  assert.ok(first.events.some(e => e.type === 'main.paused'), first.text); assert.equal(mcp.calls.length, 0);
  const run = first.events.find(e => e.type === 'main.run').id, widget = first.events.find(e => e.item?.type === 'widget').item;
  const action = widget.widget.children.find(child => child.type === 'Button').onClickAction;
  const final = await mainStream(f, { resume: run, decision: { kind: 'approval', itemId: widget.id, ...action.payload } }, token);
  assert.ok(final.events.some(e => e.type === 'main.done'), final.text); assert.equal(mcp.calls.length, 1);
  assert.equal(mcp.calls[0].arguments.text, 'MCP fixture');
});

test('main web tool calls real MCP transport and emits only returned source URLs', async t => {
  const mcp = await mainMcpFixture(t), previous = process.env.SUPERGPT_WEB_MCP_URL;
  process.env.SUPERGPT_WEB_MCP_URL = mcp.url;
  t.after(() => { if (previous === undefined) delete process.env.SUPERGPT_WEB_MCP_URL; else process.env.SUPERGPT_WEB_MCP_URL = previous; });
  const f = await fixture(t), token = f.service.createSession({ ...f.payload, options: { tools: true, web: true, webSearch: 'exa' } }).token;
  const result = await mainStream(f, mainInput('web fixture'), token);
  assert.ok(result.events.some(e => e.type === 'main.done'), result.text);
  assert.equal(mcp.calls[0].name, 'web_search_exa');
  assert.deepEqual(result.events.find(e => e.type === 'main.sources').sources, [{ title: 'Fixture public reference', url: 'https://example.org/main-source' }]);
  assert.ok(f.requests.at(-1).body.messages.some(m => m.role === 'tool' && m.content.includes('Synthetic search evidence')));
});

test('web quota failure is shown explicitly, returns no fake sources, and does not leak server configuration', async t => {
  const mcp = await mainMcpFixture(t, true), previous = process.env.SUPERGPT_WEB_MCP_URL;
  process.env.SUPERGPT_WEB_MCP_URL = mcp.url;
  t.after(() => { if (previous === undefined) delete process.env.SUPERGPT_WEB_MCP_URL; else process.env.SUPERGPT_WEB_MCP_URL = previous; });
  const f = await fixture(t), token = f.service.createSession({ ...f.payload, options: { tools: true, web: true, webSearch: 'exa' } }).token;
  const result = await mainStream(f, mainInput('web fixture'), token);
  assert.ok(result.events.some(e => e.type === 'main.notice' && e.text.includes('Kuota pencarian Exa tercapai')), result.text);
  assert.ok(!result.events.some(e => e.type === 'main.sources'));
  assert.ok(f.requests.at(-1).body.messages.some(m => m.role === 'tool' && m.content.includes('web_search_unavailable')));
  assert.ok(!result.text.includes(mcp.url));
});
