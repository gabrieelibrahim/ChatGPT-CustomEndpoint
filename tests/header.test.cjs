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

const { ProviderModelMenu } = load(path.join(root, 'src/desktop/ProviderModelMenu.tsx'));
const { prepareChatMessages } = load(path.join(root, 'src/lib/clientSettings.ts'));

test('temporary release gate keeps saved Codex mode in ChatGPT and removes the switch action', () => {
  const { CODEX_MODE_ENABLED, availableExperience } = load(path.join(root, 'src/lib/clientFeatures.ts'));
  const { NavigationPalette } = load(path.join(root, 'src/desktop/NavigationPalette.tsx'));
  assert.equal(CODEX_MODE_ENABLED, false);
  assert.equal(availableExperience('Codex'), 'ChatGPT');
  assert.equal(availableExperience('ChatGPT'), 'ChatGPT');
  const markup = renderToStaticMarkup(React.createElement(NavigationPalette, { titles: [], snippets: {}, onClose() {}, onOpen() {}, onAction() {} }));
  assert.ok(!markup.includes('Switch to Codex'));
  assert.ok(markup.includes('Switch to Chat'));
});

test('ProviderModelMenu renders accessible options without speculative heuristic badges', () => {
  const profiles = [
    {
      id: 'p1',
      name: 'OpenAI Provider',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      models: ['gpt-4o', 'o1-preview', 'o3-mini', 'text-embedding-3'],
      auth: 'bearer',
      protocol: 'openai-compatible',
      sendReasoning: true,
    },
  ];
  const markup = renderToStaticMarkup(
    React.createElement(ProviderModelMenu, {
      profiles,
      selectedId: 'p1',
      model: 'gpt-4o',
      availableKeyIds: ['p1'],
      position: { left: 40, top: 80, width: 382, maxHeight: 420 },
      onSelect() {},
      onSettings() {},
      onClose() {},
    })
  );

  assert.ok(markup.includes('role="dialog"'));
  assert.ok(markup.includes('role="listbox"'));
  assert.ok(markup.includes('role="option"'));
  assert.ok(markup.includes('gpt-4o'));
  assert.ok(markup.includes('o3-mini'));
  assert.ok(markup.includes('Kelola endpoint'));
  // Does not inject speculative substring badges
  assert.ok(!markup.includes('d-badge-reasoning'));
  assert.ok(!markup.includes('d-badge-vision'));
});

test('prepareChatMessages suppresses saved memories in temporary mode', () => {
  const DISTINCTIVE_FIXTURE = 'FIXTURE_USER_PRIVATE_NOTE_COBOL_9999';
  const settings = {
    instructions: 'Always be polite.',
    writingStyle: 'default',
    memoriesEnabled: true,
    memories: [DISTINCTIVE_FIXTURE, 'Second saved memory item'],
    timeoutSeconds: 60,
    sendShortcut: 'enter',
    voice: '',
    voiceRate: 1,
    voiceVolume: 1,
    defaultEffort: 2,
    efforts: [0, 1, 2, 3, 4, 5],
    suggestions: true,
    notifications: false,
    sound: false,
    smartPunctuation: true,
    networkAccess: true,
    pluginsEnabled: true,
  };

  const messages = [
    { role: 'user', text: 'Hello AI' },
  ];

  // 1. Normal mode (suppressMemories: false or omitted): memory notes ARE included
  const regularPayload = prepareChatMessages(messages, settings);
  assert.ok(
    regularPayload[0].text.includes(DISTINCTIVE_FIXTURE),
    'Normal request payload must include saved memories when enabled'
  );

  // 2. Temporary mode (suppressMemories: true): memory notes MUST be excluded
  const temporaryPayload = prepareChatMessages(messages, settings, { suppressMemories: true });
  assert.ok(
    !temporaryPayload[0].text.includes(DISTINCTIVE_FIXTURE),
    'Temporary chat request payload must completely exclude saved memories'
  );
  assert.ok(
    !temporaryPayload[0].text.includes('User-saved memory notes'),
    'Temporary chat payload must not include memory section header'
  );
  assert.ok(
    temporaryPayload[0].text.includes('Always be polite.'),
    'Temporary chat payload preserves non-memory instructions'
  );
});

test('Temporary chat toggle transitions cleanly on and off', () => {
  // Test transition state machine
  function toggleTemporaryState(currentTemporary, isHome, onNewChat) {
    let newChatCalled = false;
    let nextTemporary = currentTemporary;

    if (currentTemporary) {
      // Currently ON -> turn OFF
      if (!isHome) {
        onNewChat();
        newChatCalled = true;
      }
      nextTemporary = false;
    } else {
      // Currently OFF -> turn ON
      if (!isHome) {
        onNewChat();
        newChatCalled = true;
      }
      nextTemporary = true;
    }

    return { nextTemporary, newChatCalled };
  }

  // Case A: On home screen, toggling changes temporary state without newChat call
  let calls = 0;
  const homeOn = toggleTemporaryState(false, true, () => { calls++; });
  assert.equal(homeOn.nextTemporary, true);
  assert.equal(homeOn.newChatCalled, false);

  const homeOff = toggleTemporaryState(true, true, () => { calls++; });
  assert.equal(homeOff.nextTemporary, false);
  assert.equal(homeOff.newChatCalled, false);
  assert.equal(calls, 0);

  // Case B: In active chat (!home), toggling ON resets to a new temporary chat
  const chatOn = toggleTemporaryState(false, false, () => { calls++; });
  assert.equal(chatOn.nextTemporary, true);
  assert.equal(chatOn.newChatCalled, true);
  assert.equal(calls, 1);

  // Case C: In active chat (!home), toggling OFF resets to a clean non-temporary chat
  const chatOff = toggleTemporaryState(true, false, () => { calls++; });
  assert.equal(chatOff.nextTemporary, false);
  assert.equal(chatOff.newChatCalled, true);
  assert.equal(calls, 2);
});
