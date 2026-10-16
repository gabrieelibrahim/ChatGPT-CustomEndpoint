const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load([base + '.tsx', base + '.ts', base + '/index.ts'].find(candidate => fs.existsSync(candidate)));
  }, mod, mod.exports);
  return mod.exports;
}
const { parseThinking, hasMessageContent } = load(path.join(root, 'src/lib/endpointChat.ts'));
const { ChatMessage } = load(path.join(root, 'src/desktop/UXControls.tsx'));
function render(message, streaming = false) {
  return renderToStaticMarkup(React.createElement(ChatMessage, { message, streaming, onEdit() {}, onNotice() {} }));
}

test('literal think tags in prose, fenced code and inline examples remain part of the answer', () => {
  for (const text of ['Example: <think>literal</think>', '```xml\n<think>literal</think>\n```', '`<think>literal</think>`', 'Answer first\n<think>quoted unfinished example']) {
    assert.deepEqual(parseThinking(text), { content: text, reasoning: '', isThinking: false });
  }
  assert.deepEqual(parseThinking(' \n<think>Actual reasoning</think>\nAnswer'), { content: 'Answer', reasoning: 'Actual reasoning', isThinking: false });
});

test('malformed reasoning in an older saved message cannot crash the message component', () => {
  for (const reasoning of [{ summary: 'vendor object' }, ['vendor array'], 42, true]) {
    const markup = render({ role: 'assistant', text: 'Safe answer', reasoning });
    assert.ok(markup.includes('Safe answer')); assert.ok(!markup.includes('d-thinking-block'));
  }
});

test('stopped reasoning survives saved-history filtering and renders without a waiting-answer element', () => {
  const messages = JSON.parse(JSON.stringify([{ role: 'user', text: 'Question' }, { role: 'assistant', text: '', reasoning: 'Partial reasoning before Stop' }, { role: 'assistant', text: '' }]));
  const restored = messages.filter(hasMessageContent);
  assert.equal(restored.length, 2);
  const markup = render(restored[1]);
  assert.ok(markup.includes('Partial reasoning before Stop'));
  assert.ok(markup.includes('data-streaming="false"'));
  assert.ok(!markup.includes('class="d-assistant-message"'));
  assert.ok(!markup.includes('role="status"'));
});

test('active reasoning remains collapsible while final text and response actions render normally', () => {
  const active = render({ role: 'assistant', text: '', reasoning: 'Working' }, true);
  assert.ok(active.includes('data-streaming="true"')); assert.ok(active.includes('aria-expanded="true"'));
  assert.ok(!active.includes('class="d-assistant-message"'));
  const complete = render({ role: 'assistant', text: 'Answer', reasoning: 'Working' });
  assert.ok(complete.includes('data-streaming="false"')); assert.ok(complete.includes('class="d-assistant-message">Answer'));
  assert.ok(complete.includes('Copy response'));
});
