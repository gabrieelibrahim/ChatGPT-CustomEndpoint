const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const built = buildSync({ absWorkingDir: root, entryPoints: ['src/lib/useMobileConversation.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'] }).outputFiles[0].text;
function storage(seed = {}) { const entries = new Map(Object.entries(seed)); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }; }
function fixture() {
  const originals = Object.fromEntries(['window', 'localStorage', 'sessionStorage', 'fetch'].map(key => [key, global[key]]));
  const endpoint = { id: 'mock', name: 'Local mock', baseUrl: 'http://127.0.0.1:19092/v1', model: 'test', models: ['test'], auth: 'none', protocol: 'openai-compatible' };
  global.window = new EventTarget();
  global.localStorage = storage({ 'client-endpoint-profiles-v1': JSON.stringify({ version: 1, profiles: [endpoint], selectedId: 'mock' }) });
  // These tests isolate plain provider transport; function calling is covered by mcp-direct.test.mjs.
  localStorage.setItem('supergpt-main-ai-v1', JSON.stringify({ enabled: false }));
  global.sessionStorage = storage();
  let cursor = 0; const cells = [], cleanups = [];
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }]; },
    useRef(value) { const index = cursor++; return cells[index] ||= { current: value }; },
    useEffect(run) { const index = cursor++; if (!(index in cells)) { cells[index] = true; cleanups.push(run()); } },
  };
  const mod = new Module(__filename + '.fixture', module); mod.filename = __filename + '.fixture'; mod.paths = module.paths;
  mod.require = name => name === 'react' ? hooks : require(name); mod._compile(built, mod.filename);
  return {
    render() { cursor = 0; return mod.exports.useMobileConversation(); },
    restore() { for (const cleanup of cleanups) cleanup?.(); for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete global[key]; else global[key] = value; } },
  };
}
function answer() { return new Response(JSON.stringify({ choices: [{ message: { content: 'Halo mobile', reasoning_content: 'Provider reasoning' } }] }), { headers: { 'content-type': 'application/json' } }); }

test('completion notification is emitted only for a successful response with reminders enabled', async () => {
  const app = fixture();
  try {
    const notices = [];
    window.SuperGPTNotifications = { postMessage: raw => notices.push(JSON.parse(raw)) };
    localStorage.setItem('client-settings-v1', JSON.stringify({ notifications: true }));
    global.fetch = async () => answer();
    await app.render().send('Finished task');
    assert.equal(app.render().messages.at(-1).generationId, app.render().completedGeneration);
    assert.ok(app.render().completedGeneration);
    assert.equal(notices.length, 1); assert.equal(notices[0].op, 'notify'); assert.equal(notices[0].title, 'Finished task');
    global.fetch = async () => new Response('', { status: 500 });
    await app.render().send('Failed task'); assert.equal(notices.length, 1); assert.equal(app.render().completedGeneration, '');
    localStorage.setItem('client-settings-v1', JSON.stringify({ notifications: false }));
    global.fetch = async () => answer();
    await app.render().send('Muted task'); assert.equal(notices.length, 1);
    app.render().open('Finished task'); assert.equal(app.render().completedGeneration, '');
  } finally { app.restore(); }
});

test('renaming and deleting other chats while streaming does not resurrect old history titles', async () => {
  const app = fixture();
  try {
    localStorage.setItem('desktop-titles', JSON.stringify(['Rename me', 'Delete me']));
    localStorage.setItem('desktop-chat-content', JSON.stringify({ 'Rename me': [{ role: 'user', text: 'Saved' }], 'Delete me': [] }));
    let respond; global.fetch = () => new Promise(resolve => { respond = resolve; });
    const waiting = app.render().send('Active');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.render().rename('Rename me', 'New name'),undefined);
    assert.equal(app.render().remove('Delete me'),undefined);
    assert.match(app.render().rename('Active','Unsafe rename'),/Tunggu/);
    respond(answer()); await waiting;
    assert.deepEqual(JSON.parse(localStorage.getItem('desktop-titles')),['Active','New name']);
    assert.equal(JSON.parse(localStorage.getItem('desktop-chat-content'))['Rename me'],undefined);
    app.render().open('New name');
    assert.equal(app.render().title,'New name');
    assert.equal(app.render().messages[0].text,'Saved');
  } finally { app.restore(); }
});

test('native request background lifetime ends after successful and canceled requests', async () => {
  const app = fixture();
  try {
    const calls = [];
    window.SuperGPTTask = { postMessage: value => calls.push(JSON.parse(value)) };
    global.fetch = async () => answer();
    await app.render().send('Finished');
    assert.deepEqual(calls.map(value => value.op), ['start', 'finish']);
    assert.equal(calls[0].id, calls[1].id);
    let respond;
    global.fetch = () => new Promise(resolve => { respond = resolve; });
    const waiting = app.render().send('Canceled');
    await new Promise(resolve => setImmediate(resolve));
    app.render().reset(); respond(answer()); await waiting;
    assert.deepEqual(calls.slice(2).map(value => value.op), ['start', 'finish']);
    assert.equal(calls[2].id, calls[3].id);
  } finally { app.restore(); }
});

test('mobile think harder overrides only the current request and respects endpoint reasoning opt-in', async () => {
  for (const enabled of [true, false]) {
    const app = fixture();
    try {
      const store = JSON.parse(localStorage.getItem('client-endpoint-profiles-v1'));
      store.profiles[0].sendReasoning = enabled;
      localStorage.setItem('client-endpoint-profiles-v1', JSON.stringify(store));
      const savedSettings = localStorage.getItem('client-settings-v1');
      let payload;
      global.fetch = async (_, init) => { payload = JSON.parse(init.body); return answer(); };
      await app.render().send('Think harder', [], false, { memories: false, instructions: true, reasoningEffort: 'high' });
      assert.equal(payload.reasoning_effort, enabled ? 'high' : undefined);
      assert.equal(localStorage.getItem('client-settings-v1'), savedSettings);
    } finally { app.restore(); }
  }
});

test('mobile sends via shared provider transport and preserves desktop history and reasoning metadata', async () => {
  const app = fixture();
  try {
    localStorage.setItem('desktop-chat-content', JSON.stringify({ Existing: [{ role: 'user', text: 'Earlier' }] }));
    localStorage.setItem('desktop-titles', JSON.stringify(['Existing']));
    let payload;
    global.fetch = async (_, init) => { payload = JSON.parse(init.body); return answer(); };
    let spokenReply;
    assert.equal(await app.render().send('Halo', [], false, { memories: false, instructions: true }, reply => { spokenReply = reply; }), true);
    assert.equal(spokenReply, 'Halo mobile');
    const view = app.render();
    assert.equal(payload.model, 'test'); assert.match(payload.messages[0].content, /Answer formatting \(SuperGPT renders this\)/); assert.match(payload.messages[0].content, /Current request:\nHalo$/);
    assert.equal(view.busy, false); assert.equal(view.answerText(view.messages.at(-1)), 'Halo mobile');
    const saved = JSON.parse(localStorage.getItem('desktop-chat-content'));
    assert.equal(saved.Existing[0].text, 'Earlier'); assert.equal(saved.Halo.at(-1).reasoning, 'Provider reasoning');
  } finally { app.restore(); }
});

test('temporary mobile requests complete without entering persistent chat history', async () => {
  const app = fixture();
  try {
    global.fetch = async () => answer();
    app.render().reset(true);
    await app.render().send('Temporary secret');
    assert.equal(app.render().messages.at(-1).text, 'Halo mobile');
    assert.equal(localStorage.getItem('desktop-chat-content'), null);
    assert.equal(localStorage.getItem('desktop-titles'), null);
  } finally { app.restore(); }
});

test('starting a new mobile chat aborts the previous request and rejects its late result', async () => {
  const app = fixture();
  try {
    let resolveResponse, signal;
    global.fetch = (_, init) => { signal = init.signal; return new Promise(resolve => { resolveResponse = resolve; }); };
    const running = app.render().send('Old request');
    // Hydration is asynchronous, so allow the request to reach fetch before resetting.
    await new Promise(resolve => setImmediate(resolve));
    app.render().reset();
    assert.equal(signal.aborted, true);
    resolveResponse(answer()); await running;
    const view = app.render();
    assert.equal(view.messages.length, 0); assert.equal(view.busy, false); assert.equal(view.title, '');
    assert.equal(JSON.parse(localStorage.getItem('desktop-chat-content'))['Old request'].length, 1);
  } finally { app.restore(); }
});

test('temporary personalization applies only the selected local context and never persists the chat', async () => {
  const app = fixture();
  try {
    localStorage.setItem('client-settings-v1', JSON.stringify({ instructions: 'Use Indonesian', memoriesEnabled: true, memories: ['Local saved note'] }));
    let payload;
    global.fetch = async (_, init) => { payload = JSON.parse(init.body); return answer(); };
    app.render().reset(true);
    await app.render().send('Hello', [], false, { memories: false, instructions: false });
    // Rendering guidance is not personal context, so it stays; saved notes and custom instructions do not.
    assert.match(payload.messages[0].content, /Current request:\nHello$/); assert.doesNotMatch(payload.messages[0].content, /Local saved note|Use Indonesian/);
    app.render().reset(true);
    await app.render().send('Hello', [], false, { memories: true, instructions: false });
    assert.match(payload.messages[0].content, /Local saved note/);
    assert.doesNotMatch(payload.messages[0].content, /Use Indonesian/);
    app.render().reset(true);
    await app.render().send('Hello');
    assert.match(payload.messages[0].content, /Use Indonesian/);
    assert.doesNotMatch(payload.messages[0].content, /Local saved note/);
    assert.equal(localStorage.getItem('desktop-chat-content'), null);
    assert.equal(localStorage.getItem('desktop-titles'), null);
    assert.equal(JSON.parse(localStorage.getItem('client-settings-v1')).memoriesEnabled, true);
  } finally { app.restore(); }
});
