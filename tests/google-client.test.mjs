import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
const built = await build({ entryPoints: ['src/mcp/googleAuth.ts', 'src/agent/settings.ts', 'src/mcp/googleWorkspace.ts'], bundle: true, write: false, platform: 'node', format: 'esm', outdir: 'out' });
const [google, settings, workspace] = await Promise.all(built.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))));
function storage() { const values = {}; Object.defineProperties(values, { getItem: { value: key => values[key] || null }, setItem: { value: (key, value) => values[key] = value }, removeItem: { value: key => delete values[key] } }); return values; }
function environment(t) {
  const before = Object.fromEntries(['window', 'localStorage', 'sessionStorage', 'location', 'fetch'].map(key => [key, global[key]]));
  global.window = new EventTarget(); global.localStorage = storage(); global.sessionStorage = storage(); global.location = { origin: 'http://localhost:1420', href: 'http://localhost:1420/', hostname: 'localhost' };
  t.after(() => { for (const [key, value] of Object.entries(before)) if (value === undefined) delete global[key]; else global[key] = value; });
}
function nativeFixture(t, config = {}) {
  environment(t); const calls = [], vault = new Map(), listeners = [], vaultListeners = [];
  window.SuperGPTMcpOAuth = { addEventListener(_, listener) { vaultListeners.push(listener); }, postMessage(raw) {
    const request = JSON.parse(raw), response = { id: request.id, ok: true };
    if (request.op === 'load') response.value = vault.get(request.key) || '';
    if (request.op === 'save') { if (request.value) vault.set(request.key, request.value); else vault.delete(request.key); }
    queueMicrotask(() => vaultListeners.forEach(listener => listener({ data: JSON.stringify(response) })));
  } };
  window.SuperGPTGoogleAuth = { addEventListener(_, listener) { listeners.push(listener); }, postMessage(raw) {
    const request = JSON.parse(raw); calls.push(request);
    if (request.op === 'cancel') return;
    if (config.pending) { config.pending(request, listeners); return; }
    const response = request.op === 'authorize' ? { id: request.id, ok: !config.fail, error: config.fail ? 'reconnect-required' : undefined, accessToken: 'native-google-fixture', account: config.account || 'fixture@example.test', grantedScopes: config.partial ? [] : request.scopes } : { id: request.id, ok: true };
    queueMicrotask(() => listeners.forEach(listener => listener({ data: JSON.stringify(response) })));
  } };
  return { calls, vault, config };
}
test('all nine official Google services have OAuth endpoints and request only their selected scopes', () => {
  assert.equal(workspace.googleWorkspace.length, 9); assert.equal(new Set(workspace.googleWorkspace.map(item => item.id)).size, 9);
  for (const service of workspace.googleWorkspace) { assert.ok(service.url.endsWith('.googleapis.com/mcp/v1')); const read = workspace.googleScopes(service), write = workspace.googleScopes(service, true); assert.ok(read.includes(workspace.googleIdentityScope)); assert.ok(write.length >= read.length); assert.ok(!read.includes('https://mail.google.com/')); }
});
test('native Google login stores account binding in encrypted vault, no token or identity in configuration', async t => {
  const f = nativeFixture(t), controller = new AbortController();
  assert.equal(await google.loginGoogleConnection('google-fixture', 'gmail', {}, controller.signal), 'native-google-fixture');
  const record = JSON.parse(f.vault.get('google:google-fixture')); assert.equal(record.mode, 'native'); assert.equal(record.account, 'fixture@example.test'); assert.equal(record.accessToken, undefined);
  assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:google:google-fixture'), null); assert.equal(Object.keys(localStorage).length, 0);
  assert.equal(f.calls[0].interactive, true); assert.equal(f.calls[0].scopes.includes('https://www.googleapis.com/auth/gmail.compose'), false);
  assert.equal(await google.googleAccessToken('google-fixture', workspace.googleService('gmail').url, controller.signal), 'native-google-fixture');
  assert.equal(f.calls[1].interactive, false); assert.equal(f.calls[1].account, 'fixture@example.test');
});
test('native Google write permission is requested only after explicit selection', async t => {
  const f = nativeFixture(t); await google.loginGoogleConnection('google-write', 'gmail', { write: true }, new AbortController().signal);
  assert.ok(f.calls[0].scopes.includes('https://www.googleapis.com/auth/gmail.compose')); assert.ok(f.calls[0].scopes.includes('https://www.googleapis.com/auth/gmail.modify'));
});
test('partial Google consent does not persist a usable connection', async t => {
  const f = nativeFixture(t, { partial: true }); await assert.rejects(google.loginGoogleConnection('partial', 'gmail', {}, new AbortController().signal), /izin Google/); assert.equal(f.vault.size, 0);
});
test('silent authorization cannot switch Google account or request another resource', async t => {
  const f = nativeFixture(t), signal = new AbortController().signal; await google.loginGoogleConnection('bound', 'gmail', {}, signal);
  const count = f.calls.length; await assert.rejects(google.googleAccessToken('bound', 'https://attacker.example/mcp', signal), /URL Google berubah/); assert.equal(f.calls.length, count);
  f.config.account = 'different@example.test'; await assert.rejects(google.googleAccessToken('bound', workspace.googleService('gmail').url, signal), /Akun Google berubah/);
});
test('Google silent authorization fails visibly when consent must be renewed', async t => {
  const f = nativeFixture(t), signal = new AbortController().signal; await google.loginGoogleConnection('renew', 'gmail', {}, signal); f.config.fail = true;
  await assert.rejects(google.googleAccessToken('renew', workspace.googleService('gmail').url, signal), /Hubungkan ulang/); assert.equal(f.calls.at(-1).interactive, false);
});
test('canceled native Google authorization cannot restore deleted credentials', async t => {
  let pending; const f = nativeFixture(t, { pending: (request, listeners) => pending = { request, listeners } }); const controller = new AbortController();
  const run = google.loginGoogleConnection('cancel', 'gmail', {}, controller.signal); const rejected = assert.rejects(run, /dibatalkan/); controller.abort(); await rejected;
  assert.equal(f.vault.size, 0); assert.equal(f.calls.at(-1).op, 'cancel');
  for (const listener of pending.listeners) listener({ data: JSON.stringify({ id: pending.request.id, ok: true, account: 'fixture@example.test', accessToken: 'late', grantedScopes: pending.request.scopes }) });
  assert.equal(f.vault.size, 0);
});
test('main chat resolves tokens for all nine Google profiles, beyond the previous eight-server cap', async t => {
  const f = nativeFixture(t), signal = new AbortController().signal, profiles = [];
  for (const service of workspace.googleWorkspace) { await google.loginGoogleConnection(service.id, service.id, {}, signal); profiles.push({ id: service.id, name: service.name, kind: 'http', url: service.url, enabled: true, auth: 'google' }); }
  localStorage.setItem('client-local-features-v1', JSON.stringify({ mcp: profiles }));
  const result = await settings.mainMcpProfiles(signal); assert.equal(result.length, 9); assert.ok(result.every(item => item.token === 'native-google-fixture')); assert.equal(JSON.stringify(profiles).includes('native-google-fixture'), false);
  await google.clearAllGoogleConnections(profiles.map(item => item.id)); assert.equal(f.vault.size, 0); assert.equal(f.calls.at(-1).op, 'clear');
});
function brokerFixture(t, config = {}) {
  environment(t); const calls = [], service = workspace.googleService('gmail'), scopes = workspace.googleScopes(service), record = { serviceId: service.id, resource: service.url, account: 'fixture@example.test', scopes, expiresAt: Date.now() + 3600000 };
  let proof, popupClosed = false, opened, resultClaimed = false;
  const popup = { location: {}, get closed() { return popupClosed; }, close() { popupClosed = true; } }; window.open = () => popup;
  Object.defineProperty(popup.location, 'href', { set(value) { opened = value; } });
  global.fetch = async (url, init) => {
    const path = new URL(url).pathname, body = init.body ? JSON.parse(init.body) : undefined; calls.push({ url, init, body });
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    if (path === '/__google/config') return Response.json({ ready: !config.notReady, redirectUri: 'https://broker.example/__google/callback' });
    if (path === '/__google/start') {
      proof = body.challenge; assert.equal(body.serviceId, 'gmail'); assert.equal(body.write, false); assert.equal(init.headers.Authorization, 'Bearer fixture-admin');
      const target = new URL('https://accounts.google.com/o/oauth2/v2/auth'); for (const [key, value] of Object.entries({ response_type: 'code', client_id: 'fixture.apps.googleusercontent.com', state: 'state', code_challenge_method: 'S256', code_challenge: 'server-pkce', access_type: 'offline', redirect_uri: 'https://broker.example/__google/callback', scope: scopes.join(' ') })) target.searchParams.set(key, value);
      return Response.json({ flowId: 'fixture_flow_id_123456789', authorizationUrl: config.badUrl ? 'https://attacker.example/login' : target.href });
    }
    if (path === '/__google/result') { assert.equal(createHash('sha256').update(body.verifier).digest('base64url'), proof); resultClaimed = true; return Response.json({ ...record, connectionToken: 'opaque-fixture-capability' }); }
    if (path === '/__google/access') { assert.equal(init.headers.Authorization, 'Bearer opaque-fixture-capability'); return Response.json({ ...record, accessToken: 'broker-access-fixture' }); }
    if (path === '/__google/connection') return new Response(null, { status: config.deleteFailure ? 500 : 204 });
    if (path === '/__google/cancel') return new Response(null, { status: 204 });
    throw Error('Unexpected fixture request');
  };
  return { calls, get opened() { return opened; }, get resultClaimed() { return resultClaimed; }, get popupClosed() { return popupClosed; } };
}
test('broker Google login uses client proof, keeps only opaque capability in session, and disconnects server', async t => {
  const f = brokerFixture(t), signal = new AbortController().signal;
  assert.equal(await google.loginGoogleConnection('broker', 'gmail', { server: 'https://broker.example', serverToken: 'fixture-admin' }, signal), 'broker-access-fixture');
  assert.match(f.opened, /^https:\/\/accounts.google.com\//); assert.equal(f.resultClaimed, true); assert.equal(f.popupClosed, true);
  const raw = sessionStorage.getItem('supergpt-mcp-oauth:google:broker'); assert.ok(raw.includes('opaque-fixture-capability')); assert.equal(raw.includes('fixture-admin'), false); assert.equal(raw.includes('broker-access-fixture'), false); assert.equal(Object.keys(localStorage).length, 0);
  assert.equal(await google.googleAccessToken('broker', workspace.googleService('gmail').url, signal), 'broker-access-fixture'); await google.clearGoogleConnection('broker'); assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:google:broker'), null);
  assert.equal(f.calls.at(-1).init.method, 'DELETE'); assert.ok(f.calls.every(call => !JSON.stringify(call.body || {}).includes('client_secret')));
});
test('broker login rejects unconfigured service and forged authorization URL before storing a connection', async t => {
  for (const config of [{ notReady: true }, { badUrl: true }]) { const f = brokerFixture(t, config); await assert.rejects(google.loginGoogleConnection('unready', 'gmail', { server: 'https://broker.example', serverToken: 'fixture-admin' }, new AbortController().signal), /belum dikonfigurasi|tidak cocok/); assert.equal(f.resultClaimed, false); assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:google:unready'), null); }
});
test('local Google credentials are cleared even if remote disconnect fails', async t => {
  brokerFixture(t, { deleteFailure: true }); await google.loginGoogleConnection('delete', 'gmail', { server: 'https://broker.example', serverToken: 'fixture-admin' }, new AbortController().signal);
  await assert.rejects(google.clearGoogleConnection('delete'), /pembersihan server/); assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:google:delete'), null);
});
