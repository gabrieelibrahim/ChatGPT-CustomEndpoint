import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/mobile/composerKeyboard.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { observeComposerKeyboard } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

function bridge(t) {
  const listeners = [], sent = [];
  globalThis.window = { SuperGPTComposer: { addEventListener: (_, listener) => listeners.push(listener), removeEventListener: () => {}, postMessage: value => sent.push(value) } };
  t.after(() => { delete globalThis.window; });
  return { sent, emit: value => listeners.forEach(listener => listener({ data: JSON.stringify(value) })) };
}

test('keyboard frames become a lift above the navigation bar, and the settled frame says open or closed', t => {
  const { sent, emit } = bridge(t);
  const lifts = [], states = [];
  observeComposerKeyboard(open => states.push(open), lift => lifts.push(lift));
  assert.deepEqual(sent, ['observe', 'track-ime']);
  // Opening: the keyboard rises from behind the 24px navigation bar to 300px.
  for (const height of [0, 20, 120, 260]) emit({ event: 'ime', height, nav: 24, phase: 'progress' });
  emit({ event: 'ime', height: 300, nav: 24, phase: 'settle' });
  assert.deepEqual(lifts, [0, 0, 96, 236, 276]);
  assert.deepEqual(states, [true]);
  // Closing.
  emit({ event: 'ime', height: 150, nav: 24, phase: 'progress' });
  emit({ event: 'ime', height: 0, nav: 24, phase: 'settle' });
  assert.deepEqual(lifts.slice(-2), [126, 0]);
  assert.deepEqual(states, [true, false]);
  // Repeated settles and the old layout signal do not repeat a state change.
  emit({ event: 'keyboard', open: false });
  assert.deepEqual(states, [true, false]);
});

test('without frame tracking the page is told so and keeps the plain keyboard signal', t => {
  const { emit } = bridge(t);
  const lifts = [], states = [];
  observeComposerKeyboard(open => states.push(open), lift => lifts.push(lift));
  emit({ event: 'ime-unsupported' });
  emit({ event: 'keyboard', open: true });
  assert.deepEqual(lifts, [null]);
  assert.deepEqual(states, [true]);
});

test('in a browser there is no bridge and no lift', () => {
  globalThis.window = {};
  const lifts = [];
  observeComposerKeyboard(() => {}, lift => lifts.push(lift));
  assert.deepEqual(lifts, [null]);
  delete globalThis.window;
});
