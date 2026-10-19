// APK ghm0.a: a viewport-normalized rubber band, not a linear translation.
export const PULL_ARM_DISTANCE = 112;
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function rubberBand(raw: number, extent: number) {
  const size = Math.max(1, extent);
  return (1 - 1 / (0.55 * Math.max(0, raw) / size + 1)) * size;
}
export function pullVisuals(distance: number, dismissal = 0) {
  const fade = clamp((distance - 12) / 24), extra = Math.max(0, distance - 12);
  const half = distance / 2, center = half <= 56 ? half : 56 + rubberBand(half - 56, 56);
  return {
    opacity: (1 - dismissal) * fade,
    scale: (1 - dismissal * .15) * (.6 + .6 * extra / (50 + extra)),
    center: 24 + center - (1 - fade) * 8 - dismissal * 12,
    progress: clamp(distance / PULL_ARM_DISTANCE),
  };
}
export type PullFrame = ReturnType<typeof pullVisuals> & {
  phase: 'idle' | 'dragging' | 'releasing' | 'committing'; distance: number; armed: boolean; iconScale: number;
};
type Clock = { now(): number; request(fn: (time: number) => void): number; cancel(id: number): void };
function spring(position: number, velocity: number, target: number, dt: number, stiffness: number, damping: number) {
  // Small substeps keep a slow/dropped frame from destabilizing the spring.
  for (let left = Math.min(.064, dt); left > 0;) {
    const step = Math.min(1 / 120, left); left -= step;
    velocity += (-stiffness * (position - target) - 2 * damping * Math.sqrt(stiffness) * velocity) * step;
    position += velocity * step;
  }
  return { position, velocity };
}
export function createEndPull(paint: (frame: PullFrame) => void, onNew: () => void, viewport: () => number, clock: Clock, reduced: () => boolean = () => false) {
  let phase: PullFrame['phase'] = 'idle', raw = 0, distance = 0, velocity = 0, iconScale = 1, iconVelocity = 0;
  let armed = false, frame: number | undefined, last = 0, released = 0, disposed = false;
  const emit = () => {
    const elapsed = Math.max(0, clock.now() - released) / 1000;
    const omega = 2 * Math.PI / (phase === 'committing' ? .15 : .2);
    const dismissal = phase === 'releasing' || phase === 'committing' ? 1 - (1 + omega * elapsed) * Math.exp(-omega * elapsed) : 0;
    paint({ phase, distance, armed, iconScale, ...pullVisuals(distance, dismissal) });
  };
  const stopFrame = () => { if (frame !== undefined) clock.cancel(frame); frame = undefined; };
  const reset = () => { stopFrame(); phase = 'idle'; raw = distance = velocity = iconVelocity = 0; iconScale = 1; armed = false; if (!disposed) emit(); };
  const schedule = () => { if (frame === undefined && !disposed) { last = clock.now(); frame = clock.request(tick); } };
  function tick(time: number) {
    frame = undefined; if (disposed) return;
    const dt = Math.max(0, time - last) / 1000; last = time;
    const icon = spring(iconScale, iconVelocity, armed ? 1.2 : 1, dt, 631.6547, .5);
    iconScale = reduced() ? (armed ? 1.2 : 1) : icon.position; iconVelocity = reduced() ? 0 : icon.velocity;
    if (phase === 'releasing') {
      const back = spring(distance, velocity, 0, dt, 109.66227, 1);
      distance = reduced() ? 0 : Math.max(0, back.position); velocity = reduced() ? 0 : back.velocity;
      if (distance < .05 && Math.abs(velocity) < .1) { reset(); return; }
    }
    if (phase === 'committing' && time - released >= (reduced() ? 0 : 150)) { reset(); onNew(); return; }
    emit();
    if (phase === 'releasing' || phase === 'committing' || Math.abs(iconScale - (armed ? 1.2 : 1)) > .001 || Math.abs(iconVelocity) > .01) frame = clock.request(tick);
  }
  return {
    begin() { if (disposed || phase === 'committing' || distance > 5) return false; reset(); phase = 'dragging'; return true; },
    move(delta: number) {
      if (disposed || phase !== 'dragging') return;
      raw = Math.max(0, raw + delta); distance = rubberBand(raw, viewport()); armed = distance >= PULL_ARM_DISTANCE;
      emit(); schedule();
    },
    release(cancelled = false) {
      if (disposed || phase !== 'dragging') return;
      if (!distance) { reset(); return; }
      phase = armed && !cancelled ? 'committing' : 'releasing'; released = clock.now();
      if (cancelled) armed = false;
      emit(); schedule();
    },
    reset,
    dispose() { disposed = true; stopFrame(); },
    get phase() { return phase; },
  };
}
