import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/lib/sakelarConnect.ts'], bundle: true, write: false, platform: 'node', format: 'esm', external: ['@tauri-apps/*'] });
const connect = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const DEVICE = 'd'.repeat(43);
const KEY = 'sk_live_' + 'k'.repeat(43);
function storage() { const values = {}; return { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = String(value); }, removeItem: key => { delete values[key]; } }; }

/** Browser-like globals and a fake Sakelar: token answers pending `pendingPolls` times, then issues a key. */
function fixture(t, { pendingPolls = 1, dropTokens = 0 } = {}) {
  const previous = Object.fromEntries(['window', 'document', 'localStorage', 'fetch'].map(key => [key, globalThis[key]]));
  const popup = { opener: {}, location: { href: '' }, closed: false, close() { this.closed = true; } };
  globalThis.window = Object.assign(new EventTarget(), { open: () => popup });
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  globalThis.localStorage = storage();
  const calls = [];
  let polls = 0, dropped = 0;
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/api/supergpt/token' && dropped < dropTokens) { dropped++; throw new TypeError('Failed to fetch'); }
    calls.push(path);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (path === '/api/supergpt/start') return json(200, { deviceCode: DEVICE, userCode: 'ABCD-EFGH', verificationUri: 'https://app.sakelar.web.id/console/connectsupergpt?code=ABCD-EFGH', expiresIn: 600, interval: 3 });
    if (path === '/api/supergpt/token') return ++polls <= pendingPolls ? json(202, { status: 'pending' }) : json(200, { apiKey: KEY, keyId: '11111111-1111-4111-8111-111111111111', expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), baseUrl: 'https://api.sakelar.web.id/v1' });
    if (path === '/api/supergpt/cancel') return json(200, { ok: true });
    if (path === '/v1/models') { assert.equal(new Headers(init.headers).get('authorization'), 'Bearer ' + KEY); return json(200, { data: [{ id: 'glm-5.3-flash' }] }); }
    return json(404, {});
  };
  // Coming back to the app wakes the 3-second wait at once; the tests use that instead of real waiting.
  const wake = setInterval(() => document.dispatchEvent(new Event('visibilitychange')), 20);
  t.after(() => { clearInterval(wake); Object.assign(globalThis, previous); });
  return { calls, popup };
}

test('a connection survives the app being paused: it is kept, resumed, and completes with one key', async t => {
  const { calls } = fixture(t, { pendingPolls: 2 });
  const first = new AbortController();
  const committed = [];
  const running = connect.connectSakelar(first.signal, () => {}, async value => { committed.push(value); });
  while (!connect.pendingSakelar()) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(connect.pendingSakelar().userCode, 'ABCD-EFGH');
  // The screen goes away (Android recreates the app): nothing is cancelled and the proof stays.
  first.abort(connect.KEEP_PENDING);
  await assert.rejects(running);
  assert.ok(!calls.includes('/api/supergpt/cancel'));
  assert.ok(connect.pendingSakelar(), 'kept for resuming');

  const messages = [];
  assert.equal(await connect.resumeSakelar(new AbortController().signal, message => messages.push(message), async value => { committed.push(value); }), true);
  assert.equal(committed.length, 1);
  assert.equal(committed[0].apiKey, KEY);
  assert.deepEqual(committed[0].models, ['glm-5.3-flash']);
  assert.equal(connect.pendingSakelar(), null, 'cleared once connected');
  assert.equal(await connect.resumeSakelar(new AbortController().signal, () => {}, async () => {}), false, 'nothing left to resume');
  assert.ok(messages.includes('Sakelar terhubung. Endpoint dan model sudah terisi.'));
});

test('cancelling on purpose cancels at Sakelar and forgets the connection', async t => {
  const { calls, popup } = fixture(t, { pendingPolls: 1e9 });
  const controller = new AbortController();
  const running = connect.connectSakelar(controller.signal, () => {}, async () => { throw Error('must not connect'); });
  while (!calls.includes('/api/supergpt/token')) await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(running);
  assert.ok(calls.includes('/api/supergpt/cancel'));
  assert.equal(connect.pendingSakelar(), null);
  assert.ok(popup.closed);
});

test('an expired saved connection is not resumed', async t => {
  fixture(t);
  localStorage.setItem('supergpt.sakelar.pending', JSON.stringify({ deviceCode: DEVICE, verifier: 'v'.repeat(43), userCode: 'ABCD-EFGH', browserUrl: 'https://app.sakelar.web.id/console/connectsupergpt?code=ABCD-EFGH', expiresAt: Date.now() - 1 }));
  assert.equal(connect.pendingSakelar(), null);
  assert.equal(localStorage.getItem('supergpt.sakelar.pending'), null);
});

test('requests wait for the app to be in front, and a dropped request is retried instead of cancelling', async t => {
  const { calls } = fixture(t, { pendingPolls: 0, dropTokens: 3 });
  document.visibilityState = 'hidden';  // the browser is in front
  const committed = [];
  const running = connect.connectSakelar(new AbortController().signal, () => {}, async value => { committed.push(value); });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(!calls.includes('/api/supergpt/token'), 'no request while the app is behind the browser');
  document.visibilityState = 'visible';  // the deep link brings the app back
  await running;
  assert.equal(committed.length, 1, 'connected after three dropped requests');
  assert.ok(!calls.includes('/api/supergpt/cancel'), 'a dropped request never cancels the connection');
  assert.equal(connect.pendingSakelar(), null);
});

test('on Android a failed browser open does not abandon the connection (the plugin rejects with a plain string)', async t => {
  const native = await build({ entryPoints: ['src/lib/sakelarConnect.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'tauri-stubs', setup(b) {
    b.onResolve({ filter: /^@tauri-apps\/plugin-(opener|http)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /opener/, namespace: 'stub' }, () => ({ contents: 'export async function openUrl(){ globalThis.__opened = (globalThis.__opened || 0) + 1; throw "Activity not found"; }' }));
    b.onLoad({ filter: /http/, namespace: 'stub' }, () => ({ contents: 'export const fetch = (...a) => globalThis.fetch(...a);' }));
  } }] });
  const app = await import('data:text/javascript;base64,' + Buffer.from(native.outputFiles[0].text).toString('base64'));
  const { calls } = fixture(t, { pendingPolls: 1 });
  window.__TAURI_INTERNALS__ = {};
  // The native path calls api.sakelar.web.id/auth/supergpt/...; route it to the same fake.
  const fake = globalThis.fetch;
  globalThis.fetch = (url, init) => fake(String(url).replace('https://api.sakelar.web.id/auth/supergpt/', 'https://app.sakelar.web.id/api/supergpt/'), init);
  const committed = [], messages = [];
  await app.connectSakelar(new AbortController().signal, message => messages.push(message), async value => { committed.push(value); });
  assert.equal(globalThis.__opened, 1);
  assert.equal(committed.length, 1, 'connected despite the opener error');
  assert.ok(!calls.includes('/api/supergpt/cancel'));
  assert.ok(messages.some(m => m.includes('Buka lagi browser Sakelar')));
  delete globalThis.__opened;
});
