import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { localProviderRelay } from '../scripts/localProviderRelay.mjs';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
test('loopback audio relay builds a real multipart upload with the selected model and credentials', async () => {
  let received;
  const provider = http.createServer(async (req, res) => {
    const input = new Request('http://127.0.0.1' + req.url, { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' });
    const form = await input.formData(); received = { url: req.url, auth: req.headers.authorization, model: form.get('model'), language: form.get('language'), name: form.get('file').name, bytes: await form.get('file').text() };
    res.setHeader('Content-Type', 'application/json'); res.end('{"text":"fixture transcript"}');
  });
  let handler; localProviderRelay().configureServer({ middlewares: { use(path, value) { assert.equal(path, '/__client/provider'); handler = value; } } });
  const relay = http.createServer(handler);
  const providerUrl = await listen(provider), relayUrl = await listen(relay);
  try {
    const r = await fetch(relayUrl, { method: 'POST', headers: { Origin: relayUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: providerUrl + '/v1/audio/transcriptions', key: 'fixture-key', audio: { data: Buffer.from('audio-fixture').toString('base64'), type: 'audio/mp4', model: 'whisper-1', language: 'id' } }) });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { text: 'fixture transcript' });
    assert.deepEqual(received, { url: '/v1/audio/transcriptions', auth: 'Bearer fixture-key', model: 'whisper-1', language: 'id', name: 'dictation.m4a', bytes: 'audio-fixture' });
  } finally { await close(relay); await close(provider); }
});
test('audio relay rejects cross-origin requests and invalid audio before contacting any provider', async () => {
  let handler; localProviderRelay().configureServer({ middlewares: { use(_, value) { handler = value; } } });
  const relay = http.createServer(handler), relayUrl = await listen(relay);
  const body = JSON.stringify({ url: 'https://example.invalid/v1/audio/transcriptions', key: '', audio: { data: 'YXVkaW8=', type: 'application/octet-stream', model: 'whisper-1', language: 'id' } });
  try {
    const a = await fetch(relayUrl, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body });
    assert.equal(a.status, 403);
    const b = await fetch(relayUrl, { method: 'POST', headers: { Origin: relayUrl, 'Content-Type': 'application/json' }, body });
    assert.equal(b.status, 400);
  } finally { await close(relay); }
});
