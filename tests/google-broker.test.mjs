import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoogleOAuthBroker } from '../server/google/oauthBroker.mjs';

const challenge = verifier => createHash('sha256').update(verifier).digest('base64url');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
const EMAIL = 'https://www.googleapis.com/auth/userinfo.email';
async function fixture(t, config = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'supergpt-google-broker-'));
  let clock = Date.now(), refreshes = 0, tokenCalls = 0, googleChallenge, scopes, base, broker;
  const secret = 'fixture-server-only-secret', admin = 'fixture-admin-token';
  const google = async (url, init) => {
    assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
    assert.equal(init.headers?.Cookie, undefined);
    if (url === 'https://oauth2.googleapis.com/token') {
      tokenCalls++; const form = new URLSearchParams(init.body); assert.equal(form.get('client_secret'), secret); assert.equal(form.get('client_id'), 'fixture.apps.googleusercontent.com');
      if (form.get('grant_type') === 'refresh_token') {
        refreshes++; if (config.refreshWait) await config.refreshWait();
        if (config.badRefresh) return Response.json({ error: 'invalid_grant', error_description: secret }, { status: 400 });
        assert.match(form.get('refresh_token'), /^fixture-refresh/);
        return Response.json({ access_token: 'fixture-refreshed-access', refresh_token: 'fixture-refresh-rotated', token_type: 'Bearer', expires_in: 3600, scope: scopes.join(' ') });
      }
      assert.equal(form.get('redirect_uri'), 'https://broker.example/__google/callback'); assert.equal(form.get('code'), 'fixture-approved-code'); assert.equal(challenge(form.get('code_verifier')), googleChallenge);
      if (config.exchangeError) return Response.json({ error: 'invalid_grant', error_description: secret }, { status: 400 });
      return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: config.badTokenType ? 'MAC' : 'Bearer', expires_in: 3600, scope: config.partial ? EMAIL : config.scopeOverride || scopes.join(' ') });
    }
    assert.equal(url, 'https://www.googleapis.com/oauth2/v3/userinfo'); assert.equal(init.headers.Authorization, 'Bearer fixture-access');
    return Response.json({ email: 'fixture@example.test', email_verified: config.unverified ? false : true });
  };
  const make = () => createGoogleOAuthBroker({ directory, clientId: 'fixture.apps.googleusercontent.com', clientSecret: secret, serverToken: admin, publicOrigin: 'https://broker.example', tokenKey: Buffer.alloc(32, 7), allowLoopback: true, now: () => clock, fetch: google });
  broker = make();
  const server = http.createServer((req, res) => void broker.handler(req, res)); base = await listen(server);
  async function request(path, { method = 'POST', body, token = admin, origin = base, headers = {}, raw } = {}) {
    return fetch(base + path, { method, headers: { ...(origin === null ? {} : { Origin: origin }), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw, redirect: 'manual' });
  }
  async function start(serviceId = 'gmail', write = false) {
    const verifier = randomBytes(32).toString('base64url'), response = await request('/__google/start', { body: { serviceId, write, challenge: challenge(verifier) } }); assert.equal(response.status, 200);
    const data = await response.json(), auth = new URL(data.authorizationUrl); googleChallenge = auth.searchParams.get('code_challenge'); scopes = auth.searchParams.get('scope').split(' ');
    assert.equal(auth.origin + auth.pathname, 'https://accounts.google.com/o/oauth2/v2/auth'); assert.equal(auth.searchParams.get('access_type'), 'offline'); assert.equal(auth.searchParams.get('code_challenge_method'), 'S256'); assert.match(auth.searchParams.get('prompt'), /consent/); assert.ok(scopes.includes(EMAIL));
    return { ...data, verifier, auth };
  }
  async function authorize(flow, extra = '') {
    const response = await request('/__google/callback?state=' + flow.auth.searchParams.get('state') + (extra || '&code=fixture-approved-code'), { method: 'GET', token: '', origin: null }); assert.equal(response.status, 303); assert.equal(response.headers.get('Location'), '/__google/complete');
  }
  async function result(flow, extra = {}) { return request('/__google/result', { body: { flowId: flow.flowId, verifier: flow.verifier, ...extra } }); }
  async function connection(serviceId = 'gmail') { const flow = await start(serviceId); await authorize(flow); const response = await result(flow); assert.equal(response.status, 200); return response.json(); }
  t.after(async () => { broker.close(); await close(server); await rm(directory, { recursive: true, force: true }); });
  return { directory, request, start, authorize, result, connection, get scopes() { return scopes; }, get refreshes() { return refreshes; }, get tokenCalls() { return tokenCalls; }, advance: milliseconds => clock += milliseconds, restart() { broker.close(); broker = make(); } };
}

test('unconfigured Google broker reports readiness and refuses login without exposing server credentials', async t => {
  const broker = createGoogleOAuthBroker(), server = http.createServer((req, res) => void broker.handler(req, res)), base = await listen(server);
  t.after(async () => { broker.close(); await close(server); });
  const config = await (await fetch(base + '/__google/config')).json(); assert.equal(config.ready, false); assert.equal(config.services.length, 9); assert.equal(JSON.stringify(config).includes('clientSecret'), false);
  assert.equal((await fetch(base + '/__google/start', { method: 'POST' })).status, 503);
});
test('Google confidential OAuth exchanges code with internal PKCE and releases only an opaque connection after client proof', async t => {
  const f = await fixture(t), flow = await f.start();
  assert.equal(f.scopes.includes('https://www.googleapis.com/auth/gmail.compose'), false); assert.equal(f.scopes.includes('https://mail.google.com/'), false);
  const pending = await f.result(flow); assert.equal(pending.status, 202); assert.deepEqual(await pending.json(), { pending: true });
  await f.authorize(flow);
  assert.equal((await f.result(flow, { verifier: randomBytes(32).toString('base64url') })).status, 403);
  const response = await f.result(flow), value = await response.json(); assert.equal(response.status, 200); assert.equal(value.serviceId, 'gmail'); assert.equal(value.resource, 'https://gmailmcp.googleapis.com/mcp/v1'); assert.equal(value.account, 'fixture@example.test'); assert.ok(value.connectionToken); assert.equal(value.accessToken, undefined); assert.equal(value.refreshToken, undefined);
  assert.equal((await f.result(flow)).status, 403); assert.equal(f.tokenCalls, 1);
  const access = await f.request('/__google/access', { token: value.connectionToken, body: { serviceId: 'gmail', resource: value.resource } }); assert.equal(access.status, 200); assert.equal((await access.json()).accessToken, 'fixture-access');
});
test('Google write scopes require explicit request and all nine official services can start OAuth', async t => {
  const f = await fixture(t); await f.start('gmail', true); assert.ok(f.scopes.includes('https://www.googleapis.com/auth/gmail.compose'));
  for (const id of ['google-drive', 'google-docs', 'google-sheets', 'google-slides', 'google-calendar', 'google-chat', 'google-contacts', 'google-classroom']) { const flow = await f.start(id); assert.equal((await f.request('/__google/cancel', { body: { flowId: flow.flowId, verifier: flow.verifier } })).status, 204); }
});
for (const [label, config] of [['partial consent', { partial: true }], ['non-bearer token', { badTokenType: true }], ['unverified account', { unverified: true }], ['Google exchange failure', { exchangeError: true }]]) {
  test('Google broker rejects ' + label + ' without creating a connection', async t => { const f = await fixture(t, config), flow = await f.start(); await f.authorize(flow); const response = await f.result(flow); assert.equal(response.status, 403); const body = await response.text(); assert.equal(body.includes('fixture-server-only-secret'), false); assert.deepEqual(await readdir(f.directory), []); });
}
test('existing broader Google grants satisfy readonly requirements', async t => {
  const f = await fixture(t, { scopeOverride: 'https://www.googleapis.com/auth/gmail.modify ' + EMAIL }); const connection = await f.connection(); assert.ok(connection.scopes.includes('https://www.googleapis.com/auth/gmail.modify'));
});
test('Google callback state/code cannot be reused or replaced by an unrelated request', async t => {
  const f = await fixture(t), flow = await f.start();
  assert.equal((await f.request('/__google/callback?state=wrong&code=fixture-approved-code', { method: 'GET' })).status, 400); assert.equal(f.tokenCalls, 0);
  await f.authorize(flow); assert.equal((await f.request('/__google/callback?state=' + flow.auth.searchParams.get('state') + '&code=fixture-approved-code', { method: 'GET' })).status, 400); assert.equal(f.tokenCalls, 1);
});
test('denied, canceled and expired Google authorizations never become usable connections', async t => {
  const f = await fixture(t), denied = await f.start(); await f.authorize(denied, '&error=access_denied'); assert.equal((await f.result(denied)).status, 403); assert.equal(f.tokenCalls, 0);
  const canceled = await f.start(); assert.equal((await f.request('/__google/cancel', { body: { flowId: canceled.flowId, verifier: canceled.verifier } })).status, 204); assert.equal((await f.result(canceled)).status, 403);
  const expired = await f.start(); f.advance(11 * 60000); assert.equal((await f.result(expired)).status, 403);
});
test('Google tokens persist encrypted across broker restarts and refresh once for concurrent access', async t => {
  const f = await fixture(t), connection = await f.connection(), files = await readdir(f.directory); assert.equal(files.length, 1);
  const encrypted = await readFile(join(f.directory, files[0]), 'utf8'); for (const value of ['fixture-access', 'fixture-refresh', 'fixture@example.test']) assert.equal(encrypted.includes(value), false);
  f.restart(); f.advance(3600000);
  const request = () => f.request('/__google/access', { token: connection.connectionToken, body: { serviceId: 'gmail', resource: connection.resource } });
  const results = await Promise.all([request(), request()]); assert.ok(results.every(result => result.status === 200)); assert.deepEqual(await Promise.all(results.map(result => result.json().then(body => body.accessToken))), ['fixture-refreshed-access', 'fixture-refreshed-access']); assert.equal(f.refreshes, 1);
});
test('invalid Google refresh removes persisted session and requests reconnect', async t => {
  const f = await fixture(t, { badRefresh: true }), connection = await f.connection(); f.advance(3600000);
  const response = await f.request('/__google/access', { token: connection.connectionToken, body: { serviceId: 'gmail', resource: connection.resource } }); assert.equal(response.status, 401); assert.equal((await response.json()).error, 'google_reconnect_required'); assert.deepEqual(await readdir(f.directory), []);
});
test('Google connection cannot be used for another service or an arbitrary MCP resource', async t => {
  const f = await fixture(t), connection = await f.connection();
  assert.equal((await f.request('/__google/access', { token: connection.connectionToken, body: { serviceId: 'gmail', resource: 'https://attacker.example/mcp' } })).status, 400);
  assert.equal((await f.request('/__google/access', { token: connection.connectionToken, body: { serviceId: 'google-drive', resource: 'https://drivemcp.googleapis.com/mcp/v1' } })).status, 401);
  assert.equal((await f.request('/__google/connection', { method: 'DELETE', token: connection.connectionToken })).status, 204);
  assert.equal((await f.request('/__google/access', { token: connection.connectionToken, body: { serviceId: 'gmail', resource: connection.resource } })).status, 401);
});
test('Google broker blocks foreign origins, unauthenticated native callers, malformed bodies and resource injection', async t => {
  const f = await fixture(t), body = { serviceId: 'gmail', write: false, challenge: randomBytes(32).toString('base64url') };
  assert.equal((await f.request('/__google/start', { body, origin: 'https://attacker.example' })).status, 403);
  assert.equal((await f.request('/__google/start', { body, origin: null, token: '' })).status, 403);
  assert.equal((await f.request('/__google/start', { body, origin: null })).status, 200);
  assert.equal((await f.request('/__google/start', { body: { ...body, serviceId: 'https://attacker.example' } })).status, 400);
  assert.equal((await f.request('/__google/start', { raw: '{' })).status, 400);
  assert.equal((await f.request('/__google/start', { raw: JSON.stringify({ padding: 'x'.repeat(17000) }) })).status, 413);
});
