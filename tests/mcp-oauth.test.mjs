import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { localMcpOAuthRelay } from '../scripts/localMcpOAuthRelay.mjs';
const built = await build({ entryPoints: ['src/mcp/oauth.ts', 'src/agent/settings.ts'], bundle: true, write: false, platform: 'node', format: 'esm', outdir: 'out' });
const [oauth, settings] = await Promise.all(built.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
function storage() { const values = {}; return { getItem: key => values[key] || null, setItem: (key, value) => values[key] = String(value), removeItem: key => delete values[key] }; }
async function fixture(t, config = {}) {
  const previous = Object.fromEntries(['window', 'location', 'localStorage', 'sessionStorage', 'fetch'].map(key => [key, global[key]]));
  global.window = new EventTarget(); global.location = { origin: 'http://localhost:1420', hostname: 'localhost', href: 'http://localhost:1420/' }; global.localStorage = storage(); global.sessionStorage = storage();
  const requests = [], vault = new Map(); let base, state, challenge, clientId, redirect, refreshes = 0, opens = 0, closed = 0;
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    requests.push({ path: req.url, auth: req.headers.authorization, cookie: req.headers.cookie, raw });
    res.setHeader('Content-Type', 'application/json');
    const reply = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    if (req.url === '/mcp') { res.setHeader('WWW-Authenticate', config.noPrm ? 'Bearer realm="fixture"' : 'Bearer resource_metadata="' + base + '/resource", scope="read"'); return reply(401, {}); }
    if (req.url === '/resource') return reply(200, { resource: config.wrongResource ? base + '/other' : config.parentResource ? base : base + '/mcp', authorization_servers: [base], scopes_supported: ['read', 'write'] });
    if (req.url?.startsWith('/.well-known/oauth-protected-resource')) return reply(404, {});
    if (req.url?.startsWith('/.well-known/')) return reply(200, { issuer: config.wrongIssuer ? base + '/other' : base, authorization_endpoint: base + '/authorize', token_endpoint: base + '/token', registration_endpoint: config.noDcr ? undefined : base + '/register', code_challenge_methods_supported: config.noPkce ? [] : ['S256'], token_endpoint_auth_methods_supported: config.secretOnly ? ['client_secret_basic'] : config.dcrSecret ? ['client_secret_basic', 'client_secret_post'] : ['none'] });
    if (req.url === '/register') { const data = JSON.parse(raw); assert.equal(data.token_endpoint_auth_method, config.dcrSecret ? 'client_secret_post' : 'none'); redirect = data.redirect_uris[0]; clientId = 'public-fixture-client'; return reply(201, { client_id: clientId, token_endpoint_auth_method: data.token_endpoint_auth_method, ...(config.dcrSecret ? { client_secret: 'installation-secret' } : {}) }); }
    if (req.url === '/token') {
      const form = new URLSearchParams(raw); assert.equal(form.get('resource'), audience()); assert.equal(form.get('client_id'), clientId || 'pre-registered'); assert.equal(form.get('client_secret'), config.dcrSecret ? 'installation-secret' : null);
      if (form.get('grant_type') === 'refresh_token') { refreshes++; if (config.badRefresh) return reply(400, { error: 'invalid_grant' }); if (config.refreshWait) await config.refreshWait(); return reply(200, { access_token: 'refreshed-fixture', refresh_token: 'rotated-fixture', token_type: 'Bearer', expires_in: 3600 }); }
      assert.equal(form.get('code'), 'fixture-code'); assert.equal(form.get('redirect_uri'), redirect);
      assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), challenge);
      return reply(200, { access_token: 'access-fixture', refresh_token: 'refresh-fixture', token_type: config.badType ? 'MAC' : 'Bearer', expires_in: 3600 });
    }
    reply(404, {});
  });
  base = await listen(server);
  const audience = () => config.parentResource ? base + '/' : base + '/mcp';
  function authorize(url) {
    opens++; const target = new URL(url); state = target.searchParams.get('state'); challenge = target.searchParams.get('code_challenge'); redirect = target.searchParams.get('redirect_uri');
    assert.equal(target.searchParams.get('code_challenge_method'), 'S256'); assert.equal(target.searchParams.get('resource'), audience()); assert.equal(target.searchParams.get('scope'), config.noPrm ? null : 'read');
    return redirect + '?state=' + (config.badState ? 'wrong-state' : state) + (config.denied ? '&error=access_denied' : '&code=fixture-code');
  }
  if (config.browser) {
    const popup = { closed: false, close() { closed++; this.closed = true; }, location: {} };
    Object.defineProperty(popup.location, 'href', { set(value) {
      if (config.cancel) { config.cancel.abort(); return; }
      const callback = authorize(value);
      // Spoofed window and origin are ignored before receiving the genuine callback.
      for (const [source, origin, url] of [[{}, location.origin, callback], [popup, 'https://foreign.example', callback], [popup, location.origin, callback]]) {
        const event = new Event('message'); Object.assign(event, { source, origin, data: { type: 'supergpt-oauth', url } }); window.dispatchEvent(event);
      }
    } });
    window.open = () => popup;
  } else {
    const listeners = [];
    window.SuperGPTMcpOAuth = { addEventListener(_, callback) { listeners.push(callback); }, postMessage(raw) {
      const request = JSON.parse(raw), response = { id: request.id, ok: true };
      if (request.op === 'prepare') Object.assign(response, { redirectUri: 'http://127.0.0.1:47777/oauth/fixture', handle: 'handle' });
      if (request.op === 'authorize') response.callback = authorize(request.url);
      if (request.op === 'load') response.value = vault.get(request.key) || '';
      if (request.op === 'save') { if (request.value) vault.set(request.key, request.value); else vault.delete(request.key); }
      if (request.op === 'clear') vault.clear();
      if (request.op === 'cancel') closed++;
      queueMicrotask(() => { for (const callback of listeners) callback({ data: JSON.stringify(response) }); });
    } };
  }
  t.after(async () => { await close(server); for (const [key, value] of Object.entries(previous)) if (value === undefined) delete global[key]; else global[key] = value; });
  return { base, vault, requests, login: (signal = new AbortController().signal, client = '') => oauth.loginMcpOAuth('fixture', base + '/mcp', signal, client), get refreshes() { return refreshes; }, get opens() { return opens; }, get closed() { return closed; } };
}

test('OAuth discovers resource/issuer, registers a public client, uses PKCE/resource/scope, and saves only in native vault', async t => {
  const f = await fixture(t); assert.equal(await f.login(), 'access-fixture');
  assert.equal(f.opens, 1); assert.ok(f.closed > 0);
  assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:fixture'), null); assert.equal(localStorage.getItem('supergpt-mcp-oauth:fixture'), null);
  assert.equal(JSON.parse(f.vault.get('fixture')).refreshToken, 'refresh-fixture'); assert.ok(f.requests.every(request => !request.auth && !request.cookie));
  assert.equal(await oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal), 'access-fixture');
});
for (const [label, config, message] of [['resource mismatch', { wrongResource: true }, /metadata OAuth MCP/], ['issuer mismatch', { wrongIssuer: true }, /metadata atau PKCE/], ['missing S256', { noPkce: true }, /metadata atau PKCE/], ['confidential-only client', { secretOnly: true }, /server rahasia/], ['missing client registration', { noDcr: true }, /pendaftaran SuperGPT/], ['wrong callback state', { badState: true }, /Callback OAuth/], ['denied consent', { denied: true }, /izin ditolak/], ['non-bearer token', { badType: true }, /bukan bearer/]]) {
  test('OAuth refuses ' + label + ' without saving a session', async t => { const f = await fixture(t, config); await assert.rejects(f.login(), message); assert.equal(f.vault.size, 0); assert.equal(f.requests.filter(request => request.path === '/token').length, config.badType ? 1 : 0); });
}
test('a parent resource on the same origin is accepted and becomes the token audience', async t => {
  const f = await fixture(t, { parentResource: true }); assert.equal(await f.login(), 'access-fixture');
  const record = JSON.parse(f.vault.get('fixture')); assert.equal(record.resource, f.base + '/mcp'); assert.equal(record.audience, f.base + '/');
  assert.equal(await oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal), 'access-fixture');
});
test('servers without resource metadata use the MCP origin as their authorization server', async t => {
  const f = await fixture(t, { noPrm: true }); assert.equal(await f.login(), 'access-fixture'); assert.equal(JSON.parse(f.vault.get('fixture')).audience, undefined);
});
test('a client secret issued by dynamic registration is kept in the vault and sent on token and refresh requests', async t => {
  const f = await fixture(t, { dcrSecret: true }); assert.equal(await f.login(), 'access-fixture');
  const record = JSON.parse(f.vault.get('fixture')); assert.equal(record.clientSecret, 'installation-secret'); record.expiresAt = 1; f.vault.set('fixture', JSON.stringify(record));
  assert.equal(await oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal), 'refreshed-fixture'); assert.equal(f.refreshes, 1);
  assert.equal(localStorage.getItem('supergpt-mcp-oauth:fixture'), null);
});
test('a pre-registered client id cannot be used with a confidential-only provider', async t => {
  const f = await fixture(t, { dcrSecret: true }); await assert.rejects(f.login(undefined, 'pre-registered'), /server rahasia/); assert.equal(f.vault.size, 0);
});
test('pre-registered public client skips dynamic registration', async t => { const f = await fixture(t, { noDcr: true }); assert.equal(await f.login(undefined, 'pre-registered'), 'access-fixture'); assert.equal(f.requests.some(request => request.path === '/register'), false); });
test('expired OAuth token refreshes once for concurrent chat requests and rotates refresh token', async t => {
  const f = await fixture(t); await f.login(); const record = JSON.parse(f.vault.get('fixture')); record.expiresAt = 1; f.vault.set('fixture', JSON.stringify(record));
  const values = await Promise.all([1, 2].map(() => oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal)));
  assert.deepEqual(values, ['refreshed-fixture', 'refreshed-fixture']); assert.equal(f.refreshes, 1); assert.equal(JSON.parse(f.vault.get('fixture')).refreshToken, 'rotated-fixture');
});
test('rejected refresh clears the session and asks for login, without replaying calls', async t => {
  const f = await fixture(t, { badRefresh: true }); await f.login(); const record = JSON.parse(f.vault.get('fixture')); record.expiresAt = 1; f.vault.set('fixture', JSON.stringify(record));
  await assert.rejects(oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal), /dicabut/); assert.equal(f.vault.size, 0); assert.equal(f.refreshes, 1);
});
test('OAuth credentials cannot be forwarded to a changed MCP URL', async t => { const f = await fixture(t); await f.login(); await assert.rejects(oauth.mcpOAuthToken('fixture', f.base + '/other', new AbortController().signal), /URL plugin berubah/); assert.equal(f.refreshes, 0); });
test('deleting a connection during refresh cannot recreate its credentials', async t => {
  let release, entered; const ready = new Promise(resolve => entered = resolve);
  const f = await fixture(t, { refreshWait: () => new Promise(resolve => { release = resolve; entered(); }) }); await f.login();
  const record = JSON.parse(f.vault.get('fixture')); record.expiresAt = 1; f.vault.set('fixture', JSON.stringify(record));
  const refresh = oauth.mcpOAuthToken('fixture', f.base + '/mcp', new AbortController().signal); const rejected = assert.rejects(refresh, /sudah dihapus/);
  await ready; await oauth.clearMcpOAuth('fixture'); release(); await rejected; assert.equal(f.vault.size, 0);
});
test('signing out clears all OAuth credentials from the native vault', async t => { const f = await fixture(t); await f.login(); await oauth.clearAllMcpOAuth(); assert.equal(f.vault.size, 0); });
test('main chat resolves the current OAuth token; profile configuration contains no tokens', async t => {
  const f = await fixture(t); await f.login();
  const profile = { id: 'fixture', name: 'OAuth fixture', kind: 'http', url: f.base + '/mcp', enabled: true, auth: 'oauth' };
  localStorage.setItem('client-local-features-v1', JSON.stringify({ mcp: [profile] }));
  assert.deepEqual(await settings.mainMcpProfiles(), [{ name: 'OAuth fixture', url: f.base + '/mcp', token: 'access-fixture' }]); assert.equal(JSON.stringify(profile).includes('access-fixture'), false);
  await oauth.clearMcpOAuth('fixture'); assert.equal(f.vault.size, 0); await assert.rejects(settings.mainMcpProfiles(), /Hubungkan ulang/);
});
test('browser OAuth ignores messages from other windows/origins and closes the popup', async t => { const f = await fixture(t, { browser: true }); assert.equal(await f.login(), 'access-fixture'); assert.equal(f.closed, 1); assert.ok(sessionStorage.getItem('supergpt-mcp-oauth:fixture')); });
test('canceling browser OAuth never saves credentials', async t => { const controller = new AbortController(); const f = await fixture(t, { browser: true, cancel: controller }); await assert.rejects(f.login(controller.signal), /dibatalkan/); assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:fixture'), null); });
test('credential discovery never downgrades an HTTPS service to an HTTP authorization server', async t => {
  const previous = global.fetch;
  global.fetch = async url => String(url) === 'https://resource.example/mcp' ? new Response('', { status: 401 }) : Response.json({ resource: 'https://resource.example/mcp', authorization_servers: ['http://127.0.0.1:8080'] });
  t.after(() => global.fetch = previous);
  await assert.rejects(oauth.discoverMcpOAuth('https://resource.example/mcp', new AbortController().signal), /HTTPS.*HTTP/);
});
test('OAuth development relay rejects foreign origins and credential URLs, strips ambient headers and preserves challenge', async () => {
  let handler, received;
  localMcpOAuthRelay().configureServer({ middlewares: { use(_, fn) { handler = fn; } } });
  const upstream = http.createServer((req, res) => { received = req.headers; res.writeHead(401, { 'WWW-Authenticate': 'Bearer scope="read"' }); res.end('{}'); });
  const server = http.createServer(handler), target = await listen(upstream), origin = await listen(server);
  const request = (url, source = origin) => fetch(origin, { method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json', Cookie: 'secret=x', Authorization: 'Bearer do-not-forward' }, body: JSON.stringify({ url }) });
  try {
    assert.equal((await request(target, 'https://foreign.example')).status, 403); assert.equal((await request(target.replace('http://', 'http://a:b@'))).status, 400);
    const response = await request(target); assert.equal(response.status, 401); assert.match(response.headers.get('WWW-Authenticate'), /scope/); await response.text(); assert.equal(received.cookie, undefined); assert.equal(received.authorization, undefined);
  } finally { await close(server); await close(upstream); }
});
