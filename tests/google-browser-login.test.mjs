import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

// Built with a desktop client ID, as the APK is when VITE_GOOGLE_OAUTH_CLIENT_ID is set.
const built = await build({ entryPoints: ['src/mcp/googleAuth.ts'], bundle: true, write: false, platform: 'node', format: 'esm', define: { __GOOGLE_OAUTH_CLIENT_ID__: JSON.stringify('desktop-fixture.apps.googleusercontent.com') } });
const google = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const gmail = 'https://google.supergpt.invalid/mcp/gmail';
const readScopes = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

function fixture(t, config = {}) {
  const before = Object.fromEntries(['window', 'localStorage', 'sessionStorage', 'location', 'fetch'].map(key => [key, global[key]]));
  t.after(() => { for (const [key, value] of Object.entries(before)) if (value === undefined) delete global[key]; else global[key] = value; });
  const values = {}; global.localStorage = global.sessionStorage = { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = value; }, removeItem: key => { delete values[key]; } };
  global.window = new EventTarget(); global.location = { origin: 'http://tauri.localhost', href: 'http://tauri.localhost/', hostname: 'tauri.localhost' };
  const vault = new Map(), listeners = [], seen = { authorize: [], token: [], prepare: [] };
  window.SuperGPTMcpOAuth = { addEventListener(_, listener) { listeners.push(listener); }, postMessage(raw) {
    const request = JSON.parse(raw), response = { id: request.id, ok: true };
    if (request.op === 'prepare') { seen.prepare.push(request); response.handle = 'login-handle'; response.redirectUri = 'http://127.0.0.1:5555/'; }
    if (request.op === 'authorize') {
      const url = new URL(request.url); seen.authorize.push(url); seen.challenge = url.searchParams.get('code_challenge');
      response.callback = config.denied ? 'http://127.0.0.1:5555/?state=' + request.state + '&error=access_denied' : 'http://127.0.0.1:5555/?state=' + request.state + '&code=fixture-code&scope=ignored';
    }
    if (request.op === 'load') response.value = vault.get(request.key) || '';
    if (request.op === 'save') { if (request.value) vault.set(request.key, request.value); else vault.delete(request.key); }
    queueMicrotask(() => listeners.forEach(listener => listener({ data: JSON.stringify(response) })));
  } };
  global.fetch = async (url, init = {}) => {
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') { assert.equal(init.headers.Authorization, 'Bearer access-1'); return Response.json({ email: 'Fixture@Example.test', email_verified: true }); }
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(init.body); seen.token.push(form); assert.equal(form.get('client_secret'), null);
    assert.equal(form.get('client_id'), 'desktop-fixture.apps.googleusercontent.com');
    if (form.get('grant_type') === 'refresh_token') {
      assert.equal(form.get('refresh_token'), 'refresh-1'); if (config.revoked) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      await config.refreshWait?.(); return Response.json({ access_token: 'access-2', token_type: 'Bearer', expires_in: 3600, scope: readScopes.join(' ') });
    }
    assert.equal(form.get('code'), 'fixture-code'); assert.equal(form.get('redirect_uri'), 'http://127.0.0.1:5555/');
    assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), seen.challenge);
    return Response.json({ access_token: 'access-1', refresh_token: config.noRefresh ? undefined : 'refresh-1', token_type: 'Bearer', expires_in: config.expiresIn ?? 3600, scope: (config.partial ? readScopes.slice(1) : readScopes).join(' ') });
  };
  return { vault, seen, values, login: (options = {}) => google.loginGoogleConnection('gmail-1', 'gmail', options, new AbortController().signal) };
}

test('Google login opens the account chooser in the browser with PKCE and a root loopback, without a client secret', async t => {
  const f = fixture(t); assert.equal(google.hasBrowserGoogleAuth(), true);
  assert.equal(await f.login(), 'access-1');
  assert.deepEqual(f.seen.prepare.map(request => request.root), [true]);
  const url = f.seen.authorize[0]; assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of [['client_id', 'desktop-fixture.apps.googleusercontent.com'], ['redirect_uri', 'http://127.0.0.1:5555/'], ['response_type', 'code'], ['code_challenge_method', 'S256'], ['access_type', 'offline'], ['prompt', 'select_account consent'], ['scope', readScopes.join(' ')]]) assert.equal(url.searchParams.get(key), value);
  const record = JSON.parse(f.vault.get('google:gmail-1')); assert.equal(record.mode, 'browser'); assert.equal(record.refreshToken, 'refresh-1'); assert.equal(record.account, 'fixture@example.test'); assert.equal(record.accessToken, undefined);
  assert.deepEqual(f.values, {});
  // The token from login is reused in memory; no refresh until it nears expiry.
  assert.equal(await google.googleAccessToken('gmail-1', gmail, new AbortController().signal), 'access-1'); assert.equal(f.seen.token.length, 1);
});

test('an expiring Google token refreshes once for concurrent chat requests', async t => {
  let release; const f = fixture(t, { expiresIn: 30, refreshWait: () => new Promise(resolve => { release = resolve; }) }); await f.login();
  const both = Promise.all([google.googleAccessToken('gmail-1', gmail, new AbortController().signal), google.googleAccessToken('gmail-1', gmail, new AbortController().signal)]);
  while (!release) await new Promise(resolve => setImmediate(resolve)); release();
  assert.deepEqual(await both, ['access-2', 'access-2']); assert.equal(f.seen.token.filter(form => form.get('grant_type') === 'refresh_token').length, 1);
});

test('a revoked Google grant clears the connection and asks to reconnect', async t => {
  const f = fixture(t, { expiresIn: 30, revoked: true }); await f.login();
  await assert.rejects(google.googleAccessToken('gmail-1', gmail, new AbortController().signal), /Hubungkan ulang/); assert.equal(f.vault.size, 0);
});

for (const [label, config, message] of [['denied consent', { denied: true }, /dibatalkan atau izin ditolak/], ['partial consent', { partial: true }, /Sebagian izin/], ['missing offline access', { noRefresh: true }, /akses berkelanjutan/]]) {
  test('Google browser login refuses ' + label + ' without saving anything', async t => { const f = fixture(t, config); await assert.rejects(f.login(), message); assert.equal(f.vault.size, 0); });
}
