import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/chatkit/transport.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { connectSdk } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('client keeps provider keys out of storage, renews before admission and rejects credential forwarding to other origins', async () => {
  const previous = Object.fromEntries(['location', 'localStorage', 'fetch'].map(key => [key, global[key]])), values = new Map(), calls = [];
  let serial = 0, sent = 0;
  global.location = { origin: 'http://127.0.0.1:1420', href: 'http://127.0.0.1:1420/?mobile=1' };
  global.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  global.fetch = async (target, options = {}) => {
    const request = target instanceof Request ? new Request(target, options) : new Request(target, options);
    calls.push({ url: request.url, method: request.method, body: await request.text(), headers: Object.fromEntries(request.headers), redirect: request.redirect });
    if (request.url.endsWith('/session') && request.method === 'POST') return Response.json({ token: 'fixture-session-' + ++serial });
    if (request.url.endsWith('/chatkit') && ++sent === 1) return Response.json({}, { status: 401 });
    return Response.json({ ok: true });
  };
  try {
    const connection = await connectSdk({ server: '', domainKey: 'public-development-key', options: { api: 'chat', tools: true } }, { id: 'fixture', name: 'Fixture', baseUrl: 'https://provider.invalid/v1', model: 'selected-model', models: [], auth: 'bearer' }, 'fixture-private-key', '', { instructions: '', writingStyle: 'balanced', memoriesEnabled: false, memories: [] });
    const result = await connection.fetch(new Request(connection.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'threads.list', params: {} }) })); assert.equal(result.status, 200);
    const actual = calls.filter(call => call.url.endsWith('/chatkit')); assert.equal(actual.length, 2); assert.equal(actual[0].body, actual[1].body); assert.equal(actual[1].headers.authorization, 'Bearer fixture-session-2'); assert.equal(actual[1].method, 'POST');
    assert.ok(calls.every(call => call.redirect === 'error')); assert.ok(!JSON.stringify([...values]).includes('fixture-private-key'));
    assert.equal(JSON.parse(calls[0].body).provider.model, 'selected-model');
    const count = calls.length; await assert.rejects(connection.fetch('https://external.invalid/__sdk/chatkit'), /diblokir/); assert.equal(calls.length, count);
    await connection.close(); await assert.rejects(connection.fetch(connection.apiUrl), /ditutup/);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } }
});
