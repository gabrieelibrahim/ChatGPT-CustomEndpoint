const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { buildSync } = require('esbuild');
function load(entry) {
  const code = buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
  const m = new Module(__filename + '.fixture', module); m.paths = module.paths; m._compile(code, __filename); return m.exports;
}
test('Android export preserves Unicode and reports saved, cancelled and write failure', async () => {
  const original = global.window, sent = []; let listener;
  global.window = { __TAURI_INTERNALS__: {}, SuperGPTExport: { addEventListener(type, fn) { listener = fn; }, postMessage(raw) { sent.push(JSON.parse(raw)); } } };
  try {
    const { exportDeviceFile } = load('src/mobile/deviceActions.ts');
    const text = JSON.stringify({ text: 'Halo 🌏 日本語', content: ['chat'] });
    const saved = exportDeviceFile('obrolan.json', text);
    assert.equal(sent[0].text, text);
    listener({ data: JSON.stringify({ id: sent[0].id, status: 'saved' }) }); assert.equal(await saved, 'saved');
    const cancelled = exportDeviceFile('obrolan.json', text);
    listener({ data: JSON.stringify({ id: sent[1].id, status: 'cancelled' }) }); assert.equal(await cancelled, 'cancelled');
    const failed = exportDeviceFile('obrolan.json', text);
    listener({ data: JSON.stringify({ id: sent[2].id, error: 'Disk penuh' }) }); await assert.rejects(failed, /Disk penuh/);
  } finally { global.window = original; }
});
test('dictation can use a separate endpoint and model while preserving the chat selection', async () => {
  const original = { window: global.window, localStorage: global.localStorage, fetch: global.fetch };
  const profile = (id, baseUrl) => ({ id, name: id, baseUrl, model: 'chat-model', models: [], auth: 'none', protocol: 'openai-compatible' });
  const entries = new Map([
    ['client-endpoint-profiles-v1', JSON.stringify({ version: 1, selectedId: 'chat', profiles: [profile('chat', 'https://chat.example/v1'), profile('audio', 'https://audio.example/v1')] })],
    ['client-settings-v1', JSON.stringify({ dictationEngine: 'endpoint', transcriptionEndpointId: 'audio', transcriptionModel: 'custom-transcriber' })],
  ]);
  global.window = { dispatchEvent() {} }; global.localStorage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  let requested;
  global.fetch = async (url, options) => { requested = { url, options }; return Response.json({ text: 'Hasil dikte' }); };
  try {
    const { transcribeAudio } = load('src/mobile/recordedSpeech.ts');
    assert.equal(await transcribeAudio(new Blob(['audio'], { type: 'audio/mp4' }), new AbortController().signal, 'id-ID'), 'Hasil dikte');
    assert.equal(requested.url, 'https://audio.example/v1/audio/transcriptions');
    assert.equal(requested.options.body.get('model'), 'custom-transcriber');
    assert.equal(requested.options.body.get('language'), 'id');
    assert.equal(JSON.parse(entries.get('client-endpoint-profiles-v1')).selectedId, 'chat');
    global.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(transcribeAudio(new Blob(['audio']), new AbortController().signal, 'auto'), /API key/);
  } finally { Object.assign(global, original); }
});
