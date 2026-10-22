const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/lib/mobileProfile.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' });
const mod = new Module(__filename + '.fixture', module);
mod._compile(built.outputFiles[0].text, __filename);
function storage(entries) { const values = { ...entries }; return Object.assign(values, { getItem: key => values[key] ?? null, removeItem: key => delete values[key] }); }

test('mobile sign out clears provider/plugin credentials while retaining local data', async () => {
  const originals = Object.fromEntries(['window', 'localStorage', 'sessionStorage'].map(key => [key, global[key]]));
  try {
    global.window = new EventTarget();
    global.localStorage = storage({ 'client-local-profile-v1': 'Local profile', 'desktop-chat-content': 'Saved conversations', 'client-settings-v1': 'Saved preferences', 'client-endpoint-profiles-v1': 'Provider definitions' });
    global.sessionStorage = storage({ 'client-endpoint-keys-v1': 'Session credential fixture', 'supergpt-mcp-oauth:plugin': 'OAuth session fixture', 'supergpt-mcp-token:plugin': 'Bearer fixture', 'unrelated-session-state': 'Preserve' });
    let refreshed = 0; window.addEventListener('client-endpoints-changed', () => refreshed++);
    await mod.exports.signOutMobileProfile();
    assert.equal(localStorage.getItem('client-local-profile-v1'), null);
    assert.equal(sessionStorage.getItem('client-endpoint-keys-v1'), null);
    assert.equal(sessionStorage.getItem('supergpt-mcp-oauth:plugin'), null);
    assert.equal(sessionStorage.getItem('supergpt-mcp-token:plugin'), null);
    assert.equal(localStorage.getItem('desktop-chat-content'), 'Saved conversations');
    assert.equal(localStorage.getItem('client-settings-v1'), 'Saved preferences');
    assert.equal(localStorage.getItem('client-endpoint-profiles-v1'), 'Provider definitions');
    assert.equal(sessionStorage.getItem('unrelated-session-state'), 'Preserve');
    assert.equal(refreshed, 1);
  } finally { for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete global[key]; else global[key] = value; } }
});
