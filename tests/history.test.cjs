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
  const output = file.endsWith('SDKPrimitives.tsx') ? require('esbuild').buildSync({ absWorkingDir: root, entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' }, external: ['react', 'react-dom', 'react/jsx-runtime'] }).outputFiles[0].text : ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load([base + '.tsx', base + '.ts', base + '/index.ts'].find(candidate => fs.existsSync(candidate)));
  }, mod, mod.exports);
  return mod.exports;
}
const { HistoryList, loadChatTimestamps, groupTitlesByDate } = load(path.join(root, 'src/desktop/HistoryList.tsx'));
function rowActions(experience, pinned = []) {
  const markup = renderToStaticMarkup(React.createElement(HistoryList, { experience, titles: ['Example chat'], pinned, archived: [], active: 'Example chat', onNew() {}, onOpen() {}, onPin() {}, onArchive() {} }));
  const row = markup.match(/<div class="d-history-actions">(.*?)<\/div>/s);
  assert.ok(row, 'History row actions exist');
  return [...row[1].matchAll(/aria-label="([^"]+)"/g)].map(match => match[1]);
}
test('Codex history exposes pin and archive without a conversation dots menu', () => { assert.deepEqual(rowActions('Codex'), ['Pin chat', 'Archive chat']); });
test('ChatGPT history keeps conversation dots and pin without an archive shortcut', () => { assert.deepEqual(rowActions('ChatGPT'), ['Conversation options', 'Pin chat']); });
test('both experiences expose unpin for a pinned chat', () => { assert.deepEqual(rowActions('Codex', ['Example chat']), ['Unpin chat', 'Archive chat']); assert.deepEqual(rowActions('ChatGPT', ['Example chat']), ['Conversation options', 'Unpin chat']); });

test('groupTitlesByDate groups correctly into Today, Yesterday, 7 Days, 30 Days, and Older boundaries', () => {
  const refDate = new Date(2026, 9, 17, 14, 0, 0); // Oct 17, 2026 14:00
  const startOfToday = new Date(2026, 9, 17, 0, 0, 0).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 6 * 86400000;
  const startOf30Days = startOfToday - 29 * 86400000;

  const mockTimestamps = {
    'chat-today': startOfToday + 3600000,
    'chat-today-boundary': startOfToday,
    'chat-yesterday': startOfToday - 1000,
    'chat-yesterday-boundary': startOfYesterday,
    'chat-7d': startOfYesterday - 1000,
    'chat-7d-boundary': startOf7Days,
    'chat-30d': startOf7Days - 1000,
    'chat-30d-boundary': startOf30Days,
    'chat-older-31d': startOf30Days - 1000,
    'chat-older-90d': startOfToday - 90 * 86400000,
  };

  const titles = Object.keys(mockTimestamps);
  const groups = groupTitlesByDate(titles, mockTimestamps, refDate);

  const groupMap = Object.fromEntries(groups.map(g => [g.label, g.items]));

  assert.deepEqual(groupMap['Today'], ['chat-today', 'chat-today-boundary']);
  assert.deepEqual(groupMap['Yesterday'], ['chat-yesterday', 'chat-yesterday-boundary']);
  assert.deepEqual(groupMap['Previous 7 Days'], ['chat-7d', 'chat-7d-boundary']);
  assert.deepEqual(groupMap['Previous 30 Days'], ['chat-30d', 'chat-30d-boundary']);
  assert.deepEqual(groupMap['Older'], ['chat-older-31d', 'chat-older-90d']);
});

test('loadChatTimestamps reads and parses storage once without scaling per row count', () => {
  let parseCount = 0;
  let getItemCount = 0;

  const syntheticData = {};
  const titles = [];
  for (let i = 0; i < 200; i++) {
    const title = `synthetic-chat-${i}`;
    titles.push(title);
    syntheticData[title] = [{ role: 'user', content: 'hi', timestamp: Date.now() - i * 100000 }];
  }

  const rawJson = JSON.stringify(syntheticData);

  const originalLocalStorage = global.localStorage;
  const originalJSONParse = JSON.parse;

  global.localStorage = {
    getItem(key) {
      if (key === 'desktop-chat-content') {
        getItemCount++;
        return rawJson;
      }
      return null;
    },
  };

  JSON.parse = function (...args) {
    if (args[0] === rawJson) parseCount++;
    return originalJSONParse.apply(this, args);
  };

  try {
    const timestamps = loadChatTimestamps();
    assert.equal(getItemCount, 1, 'localStorage.getItem called exactly once for entire archive');
    assert.equal(parseCount, 1, 'JSON.parse called exactly once for entire archive');
    assert.equal(Object.keys(timestamps).length, 200);

    // Grouping 200 titles with pre-loaded map does zero extra parses
    const groups = groupTitlesByDate(titles, timestamps);
    assert.ok(groups.length > 0);
    assert.equal(getItemCount, 1, 'No additional getItem during grouping');
    assert.equal(parseCount, 1, 'No additional parse during grouping');
  } finally {
    global.localStorage = originalLocalStorage;
    JSON.parse = originalJSONParse;
  }
});
