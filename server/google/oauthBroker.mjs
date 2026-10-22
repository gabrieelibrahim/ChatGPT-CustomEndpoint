import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const AUTHORIZATION = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';
const EMAIL = 'https://www.googleapis.com/auth/userinfo.email';
const FLOW_TTL = 10 * 60 * 1000;
const MAX_FLOWS = 100;
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
const proof = value => createHash('sha256').update(value).digest('base64url');
const equal = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string') return false; const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
const loopbackHost = host => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host || '');
const loopbackAddress = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const bearer = req => /^Bearer ([A-Za-z0-9_\-.~+\/=]{1,4096})$/.exec(req.headers.authorization || '')?.[1] || '';
const scopeList = value => typeof value === 'string' ? [...new Set(value.trim().split(/\s+/).filter(Boolean).map(scope => scope === 'email' ? EMAIL : scope === 'profile' ? 'https://www.googleapis.com/auth/userinfo.profile' : scope))] : [];
const covers = (granted, scope) => granted.includes(scope) || scope === 'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly' && (granted.includes('https://www.googleapis.com/auth/classroom.coursework.students.readonly') || granted.includes('https://www.googleapis.com/auth/classroom.coursework.students')) || scope.endsWith('.readonly') && granted.includes(scope.slice(0, -9)) || scope.startsWith('https://www.googleapis.com/auth/drive.') && granted.includes('https://www.googleapis.com/auth/drive') || scope.startsWith('https://www.googleapis.com/auth/calendar.') && granted.includes('https://www.googleapis.com/auth/calendar') || scope === 'https://www.googleapis.com/auth/calendar.events.freebusy' && granted.includes('https://www.googleapis.com/auth/calendar.events') || scope === 'https://www.googleapis.com/auth/gmail.readonly' && (granted.includes('https://www.googleapis.com/auth/gmail.modify') || granted.includes('https://mail.google.com/'));
class BrokerError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const failure = (status, code) => new BrokerError(status, code);

async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw failure(415, 'json_required');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16000) throw failure(413, 'request_too_large'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
  catch { throw failure(400, 'invalid_json'); }
}
async function responseJson(response) {
  if (!response.body) throw failure(502, 'google_empty_response');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 64000) throw failure(502, 'google_response_too_large'); chunks.push(Buffer.from(part.value)); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw failure(502, 'google_invalid_response'); }
}

/** Google OAuth client credentials and refresh tokens stay on this server. */
export function createGoogleOAuthBroker(options = {}) {
  const catalog = options.services || JSON.parse(readFileSync(new URL('../../shared/googleWorkspace.json', import.meta.url), 'utf8'));
  const services = new Map(catalog.map(item => [item.id, item]));
  const clientId = options.clientId || '', clientSecret = options.clientSecret || '', serverToken = options.serverToken || '';
  const origins = new Set(options.origins || []);
  const directory = resolve(options.directory || '.supergpt-sdk/google');
  const fetcher = options.fetch || fetch, now = options.now || Date.now;
  let origin = '', key;
  try {
    const url = new URL(options.publicOrigin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(options.allowLoopback === true && url.protocol === 'http:' && loopbackHost(url.host)))) throw Error();
    origin = url.origin;
  } catch { /* An unconfigured broker exposes only readiness, never an incomplete login. */ }
  try { key = Buffer.isBuffer(options.tokenKey) ? options.tokenKey : Buffer.from(options.tokenKey || '', 'base64'); if (key.length !== 32) key = undefined; } catch { key = undefined; }
  const ready = !!(origin && key && clientId && clientSecret && (serverToken || options.allowLoopback === true));
  if (origin) origins.add(origin);
  const redirectUri = origin ? origin + '/__google/callback' : '';
  const flows = new Map(), states = new Map(), refreshes = new Map(), revisions = new Map(), controllers = new Set();
  let closed = false;
  const clean = () => { for (const [id, flow] of flows) if (flow.created + FLOW_TTL < now()) { flows.delete(id); states.delete(flow.state); } };
  const timer = setInterval(clean, 60000); timer.unref();
  const requiredScopes = (service, write) => [...new Set([...service.readScopes, ...(write ? service.writeScopes : []), EMAIL])];
  function serviceFor(id) { const value = services.get(id); if (!value) throw failure(400, 'unknown_google_service'); return value; }
  function validateRecord(record, service) {
    if (record?.serviceId !== service.id || record?.resource !== service.url || !Array.isArray(record.scopes) || typeof record.account !== 'string' || typeof record.accessToken !== 'string') throw failure(401, 'google_reconnect_required');
  }
  function fileFor(capability) { if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) throw failure(401, 'invalid_connection'); return join(directory, digest(capability) + '.json'); }
  async function save(capability, record) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const aad = digest(capability), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(aad));
    const bytes = Buffer.concat([cipher.update(JSON.stringify(record), 'utf8'), cipher.final()]);
    const value = JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: bytes.toString('base64') });
    const file = fileFor(capability), temporary = file + '.' + random() + '.tmp';
    try { await writeFile(temporary, value, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  async function load(capability) {
    try {
      const bytes = await readFile(fileFor(capability)); if (bytes.length > 64000) throw Error(); const value = JSON.parse(bytes.toString('utf8'));
      if (value.v !== 1) throw Error(); const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64')); decipher.setAAD(Buffer.from(digest(capability))); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch { throw failure(401, 'google_reconnect_required'); }
  }
  async function remove(capability) { revisions.set(digest(capability), (revisions.get(digest(capability)) || 0) + 1); await unlink(fileFor(capability)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  async function google(url, init = {}) {
    const controller = new AbortController(); controllers.add(controller); const deadline = setTimeout(() => controller.abort(), 30000);
    try { const response = await fetcher(url, { ...init, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store' }); const value = await responseJson(response); return { response, value }; }
    catch (error) { if (error instanceof BrokerError) throw error; throw failure(502, 'google_unavailable'); }
    finally { clearTimeout(deadline); controllers.delete(controller); }
  }
  function tokenRecord(value, previous) {
    if (typeof value.access_token !== 'string' || !value.access_token || value.access_token.length > 4096 || /[\r\n]/.test(value.access_token) || String(value.token_type).toLowerCase() !== 'bearer' || !Number.isFinite(Number(value.expires_in)) || Number(value.expires_in) <= 0 || (value.refresh_token !== undefined && (typeof value.refresh_token !== 'string' || value.refresh_token.length > 8192))) throw failure(502, 'google_invalid_token');
    const granted = value.scope === undefined ? previous.scopes : scopeList(value.scope);
    if (!Array.isArray(granted) || !previous.required.every(scope => covers(granted, scope))) throw failure(403, 'google_scopes_not_granted');
    return { ...previous, scopes: granted, accessToken: value.access_token, refreshToken: value.refresh_token || previous.refreshToken || '', expiresAt: now() + Math.min(Number(value.expires_in), 86400) * 1000 };
  }
  async function access(capability, service) {
    const identity = digest(capability), version = revisions.get(identity) || 0;
    if (refreshes.has(identity)) return refreshes.get(identity);
    const task = (async () => {
      const record = await load(capability); validateRecord(record, service);
      if (closed || (revisions.get(identity) || 0) !== version) throw failure(401, 'google_reconnect_required');
      if (record.expiresAt > now() + 60000) return record;
      if (!record.refreshToken) throw failure(401, 'google_reconnect_required');
      const { response, value } = await google(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: record.refreshToken, client_id: clientId, client_secret: clientSecret }).toString() });
      if (!response.ok) { if ([400, 401, 403].includes(response.status)) { await remove(capability); throw failure(401, 'google_reconnect_required'); } throw failure(502, 'google_refresh_unavailable'); }
      const next = tokenRecord(value, record);
      if (closed || (revisions.get(identity) || 0) !== version) throw failure(401, 'google_reconnect_required');
      await save(capability, next);
      // Deleting during a pending refresh must not leave restored credentials behind.
      if (closed || (revisions.get(identity) || 0) !== version) { await unlink(fileFor(capability)).catch(() => {}); throw failure(401, 'google_reconnect_required'); }
      return next;
    })();
    refreshes.set(identity, task); try { return await task; } finally { if (refreshes.get(identity) === task) refreshes.delete(identity); }
  }
  const send = (res, status, value) => { res.statusCode = status; if (status === 204) { res.end(); return; } res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  function sourceAllowed(req) {
    const supplied = req.headers.origin;
    if (supplied === undefined) return true;
    return origins.has(supplied) || (options.allowLoopback === true && loopbackAddress(req.socket.remoteAddress) && loopbackHost(req.headers.host) && supplied === 'http://' + req.headers.host);
  }
  function admin(req) {
    const trustedLocal = options.allowLoopback === true && loopbackAddress(req.socket.remoteAddress) && loopbackHost(req.headers.host) && req.headers.origin === 'http://' + req.headers.host;
    if (!trustedLocal && !(serverToken && equal(bearer(req), serverToken))) throw failure(403, 'google_server_access_denied');
  }
  async function callback(req, res, url) {
    const state = url.searchParams.get('state'); const flowId = states.get(state), flow = flows.get(flowId);
    if (!state || url.searchParams.getAll('state').length !== 1 || !flow || flow.created + FLOW_TTL < now() || flow.status !== 'pending') throw failure(400, 'invalid_google_callback');
    states.delete(state); flow.status = 'exchanging';
    try {
      if (url.searchParams.has('error')) throw failure(403, 'google_authorization_denied');
      const code = url.searchParams.get('code'); if (!code || code.length > 8192 || url.searchParams.getAll('code').length !== 1) throw failure(400, 'invalid_google_callback');
      const { response, value } = await google(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code_verifier: flow.googleVerifier }).toString() });
      if (!response.ok) throw failure(502, 'google_token_exchange_failed');
      const record = tokenRecord(value, { serviceId: flow.service.id, resource: flow.service.url, required: flow.scopes, scopes: [], account: '' });
      const identity = await google(USERINFO, { headers: { Accept: 'application/json', Authorization: 'Bearer ' + record.accessToken } });
      if (!identity.response.ok || identity.value.email_verified !== true || typeof identity.value.email !== 'string' || !/^[^\s@]{1,150}@[^\s@]{1,150}$/.test(identity.value.email)) throw failure(502, 'google_account_unavailable');
      record.account = identity.value.email;
      if (!closed && flows.get(flowId) === flow) { flow.record = record; flow.status = 'ready'; }
    } catch (error) { flow.status = 'error'; flow.error = error instanceof BrokerError ? error.code : 'google_authorization_failed'; }
    finally { delete flow.googleVerifier; }
    res.statusCode = 303; res.setHeader('Location', '/__google/complete'); res.end();
  }
  const handler = async (req, res) => {
    if (!req.url?.startsWith('/__google/')) return false;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    try {
      if (closed) throw failure(503, 'google_broker_closed');
      if (!sourceAllowed(req)) throw failure(403, 'google_origin_denied');
      const requestOrigin = req.headers.origin;
      if (requestOrigin) { res.setHeader('Access-Control-Allow-Origin', requestOrigin); res.setHeader('Vary', 'Origin'); }
      const host = req.headers.host || '';
      const trustedHost = origin && host === new URL(origin).host || options.allowLoopback === true && loopbackHost(host) && loopbackAddress(req.socket.remoteAddress);
      if (!trustedHost && origin) throw failure(403, 'google_host_denied');
      const url = new URL(req.url, origin || 'http://localhost');
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); send(res, 204); return true; }
      if (url.pathname === '/__google/config' && req.method === 'GET') { send(res, 200, { ready, services: catalog.map(({ id, name, url }) => ({ id, name, resource: url })), ...(ready ? { redirectUri } : {}) }); return true; }
      if (!ready) throw failure(503, 'google_oauth_not_configured');
      clean();
      if (url.pathname === '/__google/complete' && req.method === 'GET') { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Proses login Google selesai. Kembali ke SuperGPT untuk menyelesaikan koneksi.'); return true; }
      if (url.pathname === '/__google/callback' && req.method === 'GET') { await callback(req, res, url); return true; }
      if (['/__google/start', '/__google/result', '/__google/cancel'].includes(url.pathname) && req.method === 'POST') {
        admin(req); const body = await jsonBody(req);
        if (url.pathname === '/__google/start') {
          if (!/^[A-Za-z0-9_-]{43}$/.test(body.challenge) || typeof body.write !== 'boolean') throw failure(400, 'invalid_google_start');
          if (flows.size >= MAX_FLOWS) throw failure(429, 'google_login_busy');
          const service = serviceFor(body.serviceId), scopes = requiredScopes(service, body.write), flowId = random(), state = random(), googleVerifier = random();
          flows.set(flowId, { service, scopes, created: now(), challenge: body.challenge, state, googleVerifier, status: 'pending' }); states.set(state, flowId);
          const login = new URL(AUTHORIZATION); for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(' '), state, access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', code_challenge: proof(googleVerifier), code_challenge_method: 'S256' })) login.searchParams.set(key, value);
          send(res, 200, { flowId, authorizationUrl: login.href }); return true;
        }
        const flow = flows.get(body.flowId);
        if (!flow || typeof body.verifier !== 'string' || !/^[A-Za-z0-9_\-.~]{43,128}$/.test(body.verifier) || !equal(proof(body.verifier), flow.challenge)) throw failure(403, 'invalid_google_login_proof');
        if (url.pathname === '/__google/cancel') { flows.delete(body.flowId); states.delete(flow.state); send(res, 204); return true; }
        if (flow.status === 'pending' || flow.status === 'exchanging') { send(res, 202, { pending: true }); return true; }
        if (flow.status !== 'ready') { flows.delete(body.flowId); throw failure(403, flow.error || 'google_authorization_failed'); }
        flow.status = 'claimed'; flows.delete(body.flowId);
        const connectionToken = random(); await save(connectionToken, flow.record);
        send(res, 200, { connectionToken, serviceId: flow.service.id, resource: flow.service.url, account: flow.record.account, scopes: flow.record.scopes, expiresAt: flow.record.expiresAt }); return true;
      }
      if (url.pathname === '/__google/access' && req.method === 'POST') {
        const capability = bearer(req), body = await jsonBody(req), service = serviceFor(body.serviceId);
        if (body.resource !== service.url) throw failure(400, 'google_resource_mismatch');
        const record = await access(capability, service); validateRecord(record, service);
        send(res, 200, { accessToken: record.accessToken, account: record.account, scopes: record.scopes, expiresAt: record.expiresAt }); return true;
      }
      if (url.pathname === '/__google/connection' && req.method === 'DELETE') { const capability = bearer(req); await load(capability); await remove(capability); send(res, 204); return true; }
      throw failure(404, 'google_route_not_found');
    } catch (error) { if (!res.headersSent) send(res, error instanceof BrokerError ? error.status : 500, { error: error instanceof BrokerError ? error.code : 'google_broker_failed' }); else res.end(); return true; }
  };
  return { handler, ready, redirectUri, close() { closed = true; clearInterval(timer); flows.clear(); states.clear(); for (const controller of controllers) controller.abort(); controllers.clear(); } };
}

export function googleOAuthBrokerFromEnvironment(options = {}) {
  return createGoogleOAuthBroker({ directory: options.directory, origins: options.origins || (process.env.SUPERGPT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean), serverToken: process.env.SUPERGPT_SERVER_TOKEN || '', publicOrigin: process.env.SUPERGPT_PUBLIC_ORIGIN || '', clientId: process.env.SUPERGPT_GOOGLE_CLIENT_ID || '', clientSecret: process.env.SUPERGPT_GOOGLE_CLIENT_SECRET || '', tokenKey: process.env.SUPERGPT_GOOGLE_TOKEN_KEY || '', ...options });
}
