import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const output = await build({ entryPoints: ['src/mobile/endPull.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createEndPull, rubberBand, pullVisuals, PULL_ARM_DISTANCE } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
function fixture(reduced = false) {
  let now = 0, serial = 0, starts = 0; const jobs = new Map(), frames = [];
  const pull = createEndPull(frame => frames.push(frame), () => starts++, () => 700, { now: () => now, request(fn) { jobs.set(++serial, fn); return serial; }, cancel(id) { jobs.delete(id); } }, () => reduced);
  return { pull, frames, get starts() { return starts; }, get pending() { return jobs.size; }, advance(ms) { for (let target = now + ms; now < target;) { now = Math.min(target, now + 8); const tasks = [...jobs.values()]; jobs.clear(); tasks.forEach(fn => fn(now)); } } };
}

test('overdrag has the APK rubber-band resistance and continuous reveal before arming', () => {
  assert.equal(rubberBand(0, 700), 0);
  const short = rubberBand(100, 700), longer = rubberBand(200, 700);
  assert.ok(short > 0 && short < 100); assert.ok(longer - short < short);
  assert.ok(rubberBand(1e6, 700) < 700);
  assert.equal(pullVisuals(12).opacity, 0); assert.equal(pullVisuals(36).opacity, 1);
  assert.equal(pullVisuals(24).progress, 24 / PULL_ARM_DISTANCE); assert.equal(pullVisuals(PULL_ARM_DISTANCE).progress, 1);
  assert.equal(pullVisuals(PULL_ARM_DISTANCE).scale, 1);
  assert.equal(pullVisuals(PULL_ARM_DISTANCE).center, 80);
});

test('a short pull springs home; it cannot create a persistent shortcut or start a chat', () => {
  const f = fixture(); assert.equal(f.pull.begin(), true); f.pull.move(120);
  const held = f.frames.at(-1); assert.equal(held.armed, false); assert.ok(held.distance > 0);
  f.pull.release(); f.advance(120); const returning = f.frames.at(-1);
  assert.ok(returning.distance < held.distance && returning.distance > 0);
  assert.ok(returning.opacity < held.opacity);
  f.advance(2000); assert.equal(f.frames.at(-1).phase, 'idle'); assert.equal(f.frames.at(-1).distance, 0); assert.equal(f.starts, 0); assert.equal(f.pending, 0);
});

test('release beyond the threshold starts one chat automatically, with an armed spring', () => {
  const f = fixture(); f.pull.begin(); f.pull.move(300); assert.equal(f.frames.at(-1).armed, true);
  f.advance(120); assert.ok(f.frames.at(-1).iconScale > 1.2, 'underdamped scale overshoots');
  assert.equal(f.starts, 0, 'holding does not commit');
  f.pull.release(); f.advance(100); assert.equal(f.starts, 0); assert.ok(f.frames.at(-1).opacity < 1);
  f.advance(80); assert.equal(f.starts, 1); assert.equal(f.pull.phase, 'idle');
  f.pull.release(); f.advance(2000); assert.equal(f.starts, 1);
});

test('reverse drag disarms; cancellation and stale/unmounted gesture never start a chat', () => {
  const f = fixture(); f.pull.begin(); f.pull.move(350); assert.equal(f.frames.at(-1).armed, true);
  f.pull.move(-300); assert.equal(f.frames.at(-1).armed, false); f.pull.release(); f.advance(2000); assert.equal(f.starts, 0);
  f.pull.begin(); f.pull.move(350); f.pull.release(true); f.advance(2000); assert.equal(f.starts, 0);
  f.pull.begin(); f.pull.move(350); f.pull.release(); f.pull.dispose(); f.advance(2000); assert.equal(f.starts, 0); assert.equal(f.pending, 0);
});

test('reduced motion keeps gesture threshold and automatic activation, without recoil animation', () => {
  const f = fixture(true); f.pull.begin(); f.pull.move(70); f.pull.release(); f.advance(16); assert.equal(f.pull.phase, 'idle'); assert.equal(f.starts, 0);
  f.pull.begin(); f.pull.move(350); f.pull.release(); f.advance(16); assert.equal(f.starts, 1);
});
