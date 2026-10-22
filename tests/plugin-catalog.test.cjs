const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');
const code = buildSync({ entryPoints: ['src/mobile/MobileMcpConnections.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react/jsx-runtime'], loader: { '.css': 'empty' } }).outputFiles[0].text;
const catalogCode = buildSync({ entryPoints: ['src/mcp/catalog.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const catalog = { exports: {} }; new Function('module', 'exports', catalogCode)(catalog, catalog.exports);
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
function nodes(tree, predicate) { if (!tree) return []; if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, predicate)); if (typeof tree !== 'object') return []; return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]; }
function text(tree) { if (Array.isArray(tree)) return tree.map(text).join(''); if (typeof tree === 'string' || typeof tree === 'number') return String(tree); return text(tree?.props?.children || []); }
function fixture(t, initial = [], backLabel = 'Back to chat') {
  const before = Object.fromEntries(['window', 'localStorage', 'sessionStorage', 'fetch', 'location'].map(key => [key, global[key]]));
  global.location = { origin: 'http://localhost:1420', href: 'http://localhost:1420/?mobile=1' }; global.window = new EventTarget(); global.localStorage = storage(); global.sessionStorage = storage();
  let cursor = 0; const cells = [], effects = [];
  const hooks = { ...React,
    useState(initial) { const at = cursor++; if (!(at in cells)) cells[at] = typeof initial === 'function' ? initial() : initial; return [cells[at], next => { cells[at] = typeof next === 'function' ? next(cells[at]) : next; }]; },
    useRef(initial) { const at = cursor++; return cells[at] ||= { current: initial }; },
    useEffect(run, deps) { const at = cursor++, previous = cells[at]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) { previous?.cleanup?.(); const record = { deps }; cells[at] = record; effects.push(() => { record.cleanup = run(); }); } },
  }; hooks.useLayoutEffect = hooks.useEffect;
  const mod = new Module(__filename + '.fixture', module); mod.paths = module.paths; mod.require = name => name === 'react' ? hooks : require(name); mod._compile(code, __filename);
  const notices = [], drafts = [], pages = []; let closed = 0;
  const store = { data: { documents: [{ id: 'keep-doc', title: 'Keep', text: 'Keep', updated: 1 }], mcp: initial, sites: [], skills: [], tasks: [], notifications: [] }, setData(update) { this.data = typeof update === 'function' ? update(this.data) : update; } };
  const props = { store, backLabel, onClose: () => closed++, onNotice: value => notices.push(value), onDraft: value => drafts.push(value), onLibrary: value => pages.push(value) };
  const app = { store, notices, drafts, pages, render() { cursor = 0; this.tree = mod.exports.MobileMcpConnections(props); while (effects.length) effects.shift()(); return this.tree; }, button(label) { const found = nodes(this.tree, item => item.type === 'button' && (item.props['aria-label'] === label || text(item) === label)); assert.equal(found.length, 1, 'Unique button: ' + label); return found[0]; }, field(label) { const found = nodes(this.tree, item => item.type === 'label' && text(item).startsWith(label)); assert.equal(found.length, 1, 'Unique label: ' + label); return nodes(found[0], item => item.type === 'input')[0]; }, get closed() { return closed; } };
  t.after(() => { for (const cell of cells) cell?.cleanup?.(); for (const [key, value] of Object.entries(before)) if (value === undefined) delete global[key]; else global[key] = value; }); app.render(); return app;
}
const saved = { id: 'saved', name: 'Existing private MCP', url: 'https://existing.example/mcp', kind: 'http', command: '', args: [], enabled: true };

test('catalog has the recorded categories, searchable templates and explicit authentication types', () => {
  const { pluginCatalog, pluginCategories, filterPlugins } = catalog.exports;
  assert.ok(pluginCatalog.length >= 60); assert.equal(new Set(pluginCatalog.map(item => item.id)).size, pluginCatalog.length);
  assert.deepEqual(filterPlugins('  NoTiOn ').map(item => item.id), ['notion']);
  assert.equal(filterPlugins('missing-unique-value').length, 0);
  assert.equal(pluginCategories.includes('Penelitian Ilmiah'), true);
  assert.equal(filterPlugins('', 'Alat Pengembang').some(item => item.id === 'learn'), true);
  assert.ok(pluginCatalog.filter(item => item.auth === 'custom').every(item => !item.url));
  assert.equal(pluginCatalog.find(item => item.id === 'github').auth, 'token');
  assert.equal(pluginCatalog.find(item => item.id === 'notion').auth, 'oauth');
});

test('sidebar opens catalog; installed list contains only builtins and real saved connections', t => {
  const app = fixture(t, [saved]); assert.equal(nodes(app.tree, item => item.type === 'input' && item.props['aria-label'] === 'Cari plugin').length, 1);
  app.button('Sudah Terinstal').props.onClick(); app.render();
  assert.ok(text(app.tree).includes('Existing private MCP')); assert.ok(!text(app.tree).includes('Gmail')); assert.ok(!text(app.tree).includes('Pets'));
  app.button('Jelajahi plugin').props.onClick(); app.render(); assert.ok(text(app.tree).includes('Gmail'));
});

test('settings opens installed page and Pages dispatches the existing local library action', t => {
  const app = fixture(t, [], 'Back to Settings'); app.button('Pages').props.onClick(); app.render(); app.button('Buka Pages').props.onClick(); assert.deepEqual(app.pages, ['spaces']);
});

test('detail back is consumed once before the outer settings/chat navigation', t => {
  const app = fixture(t); app.button('Populer').props.onClick(); app.render(); assert.ok(text(app.tree).includes('Gmail'));
  const back = new Event('client-settings-back', { cancelable: true }); assert.equal(window.dispatchEvent(back), false); app.render();
  assert.ok(app.button('Sudah Terinstal')); assert.equal(window.dispatchEvent(new Event('client-settings-back', { cancelable: true })), true); assert.equal(app.closed, 0);
});

test('failed login never adds a catalog entry or stores its token', async t => {
  const app = fixture(t, [saved]); app.button('Tambahkan GitHub').props.onClick(); app.render();
  app.field('Bearer token').props.onChange({ target: { value: 'test-token-only' } }); app.render();
  global.fetch = async () => new Response('', { status: 401 });
  nodes(app.tree, item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve)); app.render();
  assert.deepEqual(app.store.data.mcp, [saved]); assert.ok(text(app.tree).includes('login atau bearer'));
  assert.equal(localStorage.getItem('supergpt-main-ai-v1'), null); assert.equal(sessionStorage.getItem('supergpt-mcp-token:saved'), null);
});

test('adding a custom MCP never overwrites an unrelated legacy profile, and credentials stay out of configuration', async t => {
  const app = fixture(t, [saved]); app.button('Tambahkan MCP sendiri').props.onClick(); app.render();
  for (const [label, value] of [['Nama', 'New connection'], ['URL server MCP', 'https://new.example/mcp'], ['Bearer token', 'fixture-secret']]) app.field(label).props.onChange({ target: { value } }); app.render();
  const requests = [];
  global.fetch = async (url, init) => { requests.push({ url, init }); const p = JSON.parse(init.body); if (p.method === 'notifications/initialized') return new Response(null, { status: 202 }); return Response.json({ jsonrpc: '2.0', id: p.id, result: p.method === 'initialize' ? { protocolVersion: '2025-03-26', capabilities: { tools: {} } } : { tools: [{ name: 'lookup', inputSchema: { type: 'object' } }] } }); };
  nodes(app.tree, item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve)); app.render();
  assert.equal(app.store.data.mcp.length, 2, text(app.tree)); assert.deepEqual(app.store.data.mcp[0], saved); assert.equal(app.store.data.documents[0].id, 'keep-doc');
  const added = app.store.data.mcp[1]; assert.equal(added.name, 'New connection'); assert.deepEqual(added.toolNames, ['lookup']); assert.equal(added.enabled, true);
  assert.equal(sessionStorage.getItem('supergpt-mcp-token:' + added.id), 'fixture-secret'); assert.ok(!JSON.stringify(app.store.data).includes('fixture-secret'));
  assert.ok(requests.every(request => request.url === 'https://new.example/mcp')); assert.ok(app.notices[0].includes('Terhubung'));
});

test('OAuth plugin offers browser login and optional Client ID without requesting a bearer token', t => {
  const app = fixture(t); nodes(app.tree, item => item.type === 'input' && item.props['aria-label'] === 'Cari plugin')[0].props.onChange({ target: { value: 'Notion' } }); app.render(); app.button('Tambahkan Notion').props.onClick(); app.render();
  assert.ok(text(app.tree).includes('Masuk melalui browser resmi')); assert.ok(app.button('Masuk & sambungkan'));
  assert.equal(nodes(app.tree, item => item.type === 'label' && text(item).startsWith('Bearer token')).length, 0);
  assert.ok(app.field('Client ID')); assert.deepEqual(app.store.data.mcp, []);
});

test('all official Google Workspace services have OAuth catalog entries and no custom-server placeholder', () => {
  const google = catalog.exports.pluginCatalog.filter(item => item.provider === 'google'); assert.equal(google.length, 9);
  assert.ok(google.every(item => item.auth === 'oauth' && item.url.endsWith('.googleapis.com/mcp/v1') && item.developer === 'Google'));
});

test('Google plugin offers account login and explicit write permission without requesting a client secret', t => {
  const app = fixture(t); nodes(app.tree, item => item.type === 'input' && item.props['aria-label'] === 'Cari plugin')[0].props.onChange({ target: { value: 'Gmail' } }); app.render(); app.button('Tambahkan Gmail').props.onClick(); app.render();
  assert.ok(app.button('Lanjutkan dengan Google')); assert.ok(text(app.tree).includes('Developer Preview'));
  const selects = nodes(app.tree, item => item.type === 'select'); assert.equal(selects[0].props.value, 'read');
  assert.equal(nodes(app.tree, item => item.type === 'label' && (text(item).startsWith('Bearer token') || text(item).startsWith('Client ID'))).length, 0);
  assert.equal(app.field('URL server MCP').props.disabled, true); assert.equal(app.field('URL server MCP').props.value, 'https://gmailmcp.googleapis.com/mcp/v1');
});

test('Google plugin becomes active only after account authorization and real MCP tool discovery', async t => {
  const app = fixture(t, [saved]), vault = new Map(), authListeners = [], vaultListeners = [], requests = [];
  window.SuperGPTGoogleAuth = { addEventListener(_, listener) { authListeners.push(listener); }, postMessage(raw) {
    const request = JSON.parse(raw); assert.equal(request.interactive, true);
    queueMicrotask(() => authListeners.forEach(listener => listener({ data: JSON.stringify({ id: request.id, ok: true, account: 'fixture@example.test', accessToken: 'google-ui-fixture', grantedScopes: request.scopes }) })));
  } };
  window.SuperGPTMcpOAuth = { addEventListener(_, listener) { vaultListeners.push(listener); }, postMessage(raw) {
    const request = JSON.parse(raw); if (request.op === 'save') { if (request.value) vault.set(request.key, request.value); else vault.delete(request.key); }
    queueMicrotask(() => vaultListeners.forEach(listener => listener({ data: JSON.stringify({ id: request.id, ok: true, value: vault.get(request.key) || '' }) })));
  } };
  global.fetch = async (url, init) => {
    requests.push({ url, init }); assert.equal(url, 'https://gmailmcp.googleapis.com/mcp/v1'); assert.equal(init.headers.Authorization, 'Bearer google-ui-fixture');
    const request = JSON.parse(init.body); if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.equal(app.store.data.mcp.length, 1);
    return Response.json({ jsonrpc: '2.0', id: request.id, result: request.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} } } : { tools: [{ name: 'gmail.search_threads', inputSchema: { type: 'object' } }] } });
  };
  nodes(app.tree, item => item.type === 'input' && item.props['aria-label'] === 'Cari plugin')[0].props.onChange({ target: { value: 'Gmail' } }); app.render(); app.button('Tambahkan Gmail').props.onClick(); app.render();
  nodes(app.tree, item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve)); app.render();
  assert.equal(app.store.data.mcp.length, 2, text(app.tree)); const profile = app.store.data.mcp[1]; assert.equal(profile.auth, 'google'); assert.equal(profile.googleWrite, false); assert.deepEqual(profile.toolNames, ['gmail.search_threads']);
  assert.equal(vault.size, 1); assert.equal(JSON.stringify(app.store.data).includes('fixture@example.test'), false); assert.equal(JSON.stringify(app.store.data).includes('google-ui-fixture'), false); assert.ok(requests.length >= 3);
});
