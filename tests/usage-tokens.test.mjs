import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/lib/usageTokens.ts', 'src/lib/endpointChat.ts'], bundle: true, write: false, platform: 'node', format: 'esm', outdir: 'out', external: ['@tauri-apps/*'] });
const [usage, chat] = await Promise.all(built.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))));

test('token counts are read from every provider shape and never estimated', () => {
  assert.deepEqual(usage.readUsage({ prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }), { input: 120, output: 30 });
  assert.deepEqual(usage.readUsage({ input_tokens: 80, output_tokens: 12 }), { input: 80, output: 12 }, 'Responses API');
  assert.deepEqual(usage.readUsage({ input_tokens: 10, cache_read_input_tokens: 500, cache_creation_input_tokens: 40, output_tokens: 7 }), { input: 550, output: 7 }, 'Anthropic counts cached input');
  assert.deepEqual(usage.readUsage({ completion_tokens: 9 }), { input: undefined, output: 9 });
  for (const value of [undefined, null, {}, { prompt_tokens: -1 }, { prompt_tokens: 1.5 }, { output_tokens: '12' }]) assert.equal(usage.readUsage(value), undefined);
});

test('streams ask for real usage, and a provider that rejects the option is asked again without it', async t => {
  const previous = globalThis.fetch, bodies = [];
  t.after(() => { globalThis.fetch = previous; });
  const sse = 'data: {"choices":[{"delta":{"content":"Hai"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":2}}\n\ndata: [DONE]\n\n';
  const reply = strict => async (url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    if (strict && body.stream_options) return new Response('{"error":"unknown field stream_options"}', { status: 400 });
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
  };
  const run = async baseUrl => { let reported; let text = ''; await chat.streamEndpointChat({ id: 'p', name: 'P', baseUrl, protocol: 'openai-compatible', model: 'm', models: [], auth: 'bearer' }, 'k', 'm', [{ role: 'user', text: 'hi' }], new AbortController().signal, value => { text = value; }, undefined, value => { reported = value; }); return { text, reported }; };

  globalThis.fetch = reply(false);
  assert.deepEqual(await run('https://open.example/v1'), { text: 'Hai', reported: { input: 11, output: 2 } });
  assert.deepEqual(bodies.at(-1).stream_options, { include_usage: true });

  bodies.length = 0; globalThis.fetch = reply(true);
  assert.equal((await run('https://strict.example/v1')).text, 'Hai');
  assert.equal(bodies.length, 2); assert.ok(bodies[0].stream_options); assert.equal(bodies[1].stream_options, undefined);
  bodies.length = 0;
  await run('https://strict.example/v1');
  assert.equal(bodies.length, 1, 'remembered for the session'); assert.equal(bodies[0].stream_options, undefined);
});
