const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const output = require('esbuild').buildSync({ absWorkingDir: root, entryPoints: ['src/desktop/AgentStream.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' }, external: ['react', 'react-dom', 'react/jsx-runtime'] }).outputFiles[0].text;
const mod = { exports: {} }; new Function('require', 'module', 'exports', output)(require, mod, mod.exports);
const { updateAgentStream, AgentStream } = mod.exports;
const render = (entries, streaming) => renderToStaticMarkup(React.createElement(AgentStream, { entries, streaming }));

test('agent stream preserves commentary/tool order while updating output and completion in place', () => {
  let entries = [];
  for (const [event, now] of [
    [{ type: 'text', itemId: 'a', delta: 'Checking project.' }, 0],
    [{ type: 'item', item: { id: 'cmd', type: 'commandExecution', status: 'inProgress', command: 'echo hello' } }, 1000],
    [{ type: 'output', itemId: 'cmd', delta: 'hello' }, 2000],
    [{ type: 'item', item: { id: 'cmd', type: 'commandExecution', status: 'completed' } }, 3000],
    [{ type: 'text', itemId: 'b', delta: 'Done checking.' }, 4000],
    [{ type: 'message', itemId: 'a', text: 'Checking project.' }, 5000],
  ]) entries = updateAgentStream(entries, event, now);
  assert.deepEqual(entries.map(entry => entry.id), ['a', 'cmd', 'b']);
  assert.equal(entries[1].item.aggregatedOutput, 'hello');
  assert.equal(entries[1].endedAt - entries[1].startedAt, 2000);
  const markup = render(entries, false);
  assert.ok(markup.indexOf('Checking project.') < markup.indexOf('Ran echo hello'));
  assert.ok(markup.indexOf('Ran echo hello') < markup.indexOf('Done checking.'));
  assert.ok(markup.includes('<details'));
  assert.ok(markup.includes('Shell'));
  assert.ok(markup.includes('hello'));
  assert.ok(!markup.includes('Running'));
});

test('only a runtime summary at the live tail appears, and running tools do not claim completion', () => {
  let entries = updateAgentStream([], { type: 'summary', itemId: 'r', delta: 'Checking dependencies' }, 1);
  assert.ok(render(entries, true).includes('d-agent-stream-summary'));
  assert.ok(!render(entries, false).includes('Checking dependencies'));
  entries = updateAgentStream(entries, { type: 'item', item: { id: 'cmd', type: 'commandExecution', command: 'test', status: 'inProgress' } });
  const markup = render(entries, true);
  assert.ok(!markup.includes('Checking dependencies'));
  assert.ok(markup.includes('Running'));
  assert.ok(!markup.includes('Ran test'));
  assert.equal(updateAgentStream(entries, { type: 'notice', text: 'No synthetic activity' }), entries);
  entries = updateAgentStream(entries, { type: 'summary', itemId: 'r', delta: ' again' });
  assert.equal(entries.at(-1).kind, 'summary');
  assert.ok(render(entries, true).includes('Checking dependencies again'));
});
