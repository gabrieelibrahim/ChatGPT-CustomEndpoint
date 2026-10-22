import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { localProviderRelay } from '../scripts/localProviderRelay.mjs';

const built = await build({ entryPoints: ['src/lib/homeStarters.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { pickStarters } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

test('email starters appear only once Gmail is connected, and are routed to that plugin', () => {
  for (let seed = 1; seed < 40; seed++) assert.ok(pickStarters([], seed).every(s => !s.plugin && !s.label.startsWith('Email')), 'no plugin starters without plugins');
  const gmail = [{ name: 'Gmail', catalogId: 'gmail', enabled: true }];
  const picked = pickStarters(gmail, 7);
  assert.equal(picked.length, 3);
  assert.equal(picked.filter(s => s.plugin === 'gmail').length, 2, 'at most two plugin starters, the rest general');
  assert.ok(picked.filter(s => s.plugin).every(s => s.prompt.startsWith('@Gmail ')));
  assert.equal(pickStarters([{ ...gmail[0], enabled: false }], 7).filter(s => s.plugin).length, 0, 'a disabled plugin offers nothing');
});

test('starters rotate with the seed', () => {
  const sets = new Set(Array.from({ length: 20 }, (_, seed) => pickStarters([], seed + 1).map(s => s.label).join('|')));
  assert.ok(sets.size > 3);
});

test('the local relay forwards GET /account so account limits load in the browser build', async () => {
  let seen;
  const provider = http.createServer((req, res) => { seen = { method: req.method, url: req.url, auth: req.headers.authorization }; res.setHeader('Content-Type', 'application/json'); res.end('{"object":"account","balance_tokens":"5"}'); });
  let handler; localProviderRelay().configureServer({ middlewares: { use(_, value) { handler = value; } } });
  const relay = http.createServer(handler);
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
  const providerUrl = await listen(provider), relayUrl = await listen(relay);
  try {
    const r = await fetch(relayUrl, { method: 'POST', headers: { Origin: relayUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: providerUrl + '/v1/account', key: 'fixture-key' }) });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).object, 'account');
    assert.deepEqual(seen, { method: 'GET', url: '/v1/account', auth: 'Bearer fixture-key' });
  } finally { relay.close(); relay.closeAllConnections(); provider.close(); provider.closeAllConnections(); }
});
