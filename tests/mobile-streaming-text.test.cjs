const test = require('node:test'), assert = require('node:assert/strict'), Module = require('node:module');
const built = require('esbuild').buildSync({ entryPoints: ['src/mobile/streamingText.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const mod = new Module(__filename + '.fixture', module); mod._compile(built, __filename);
function fixture(initial = '') {
  let now = 0, id = 0; const jobs = new Map(), paints = [];
  const presenter = mod.exports.createMobileTextPresenter(value => paints.push(value), {
    now: () => now, request: callback => { jobs.set(++id, callback); return id; }, cancel: value => jobs.delete(value),
  }, initial);
  return { presenter, paints, jobs, advance(ms) { const end = now + ms; while (now < end) { now = Math.min(end, now + 16); const pending = [...jobs.values()]; jobs.clear(); pending.forEach(callback => callback(now)); } } };
}
test('stream presentation coalesces bursts, reveals in frames and preserves emoji/final text', () => {
  const view = fixture();
  view.presenter.update('Hello'); view.presenter.update('Hello 🌏 — complete');
  assert.equal(view.jobs.size, 1); assert.equal(view.paints.length, 0);
  view.advance(32); assert.notEqual(view.paints.at(-1), 'Hello 🌏 — complete');
  view.advance(200); assert.equal(view.paints.at(-1), 'Hello 🌏 — complete');
  assert.ok(view.paints.every(text => !/[\uD800-\uDBFF]$/.test(text)));
  assert.equal(view.jobs.size, 0);
});
test('history/reduced-motion text is immediate, replacements cancel old output and disposal cancels frames', () => {
  const view = fixture('Earlier');
  view.presenter.update('Saved history', false); assert.equal(view.paints.at(-1), 'Saved history'); assert.equal(view.jobs.size, 0);
  view.presenter.update('Saved history plus pending'); view.advance(16);
  view.presenter.update('Rewritten'); assert.equal(view.paints.at(-1), 'Rewritten'); assert.equal(view.jobs.size, 0);
  view.presenter.update('Rewritten pending'); view.presenter.dispose(); const count = view.paints.length; view.advance(400);
  assert.equal(view.jobs.size, 0); assert.equal(view.paints.length, count);
});
test('returning target to visible text does not replay or truncate it on an older pending frame', () => {
  const view = fixture('Start'); view.presenter.update('Start with pending tail'); view.advance(32);
  const visible = view.paints.at(-1); view.presenter.update(visible); view.advance(300);
  assert.equal(view.paints.at(-1), visible); assert.equal(view.jobs.size, 0);
});
