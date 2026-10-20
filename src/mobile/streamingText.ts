type Frames = { now(): number; request(callback: (time: number) => void): number; cancel(id: number): void };

// Presentation only: raw provider text/history is never delayed or modified.
// Short token bursts follow the next frame; large bursts settle within 180ms.
export function createMobileTextPresenter(paint: (text: string) => void, frames: Frames, initial = '') {
  let shown = initial, target = initial, from = initial.length, started = 0, duration = 0;
  let frame: number | undefined, disposed = false;
  let lastPaint = -Infinity;
  const write = (value: string) => { if (value !== shown) { shown = value; paint(value); } };
  function tick(time: number) {
    frame = undefined;
    if (disposed) return;
    // Bound expensive Markdown work on long answers to about 20 paints/second.
    if (target.length > 1200 && time - lastPaint < 50) { frame = frames.request(tick); return; }
    const progress = Math.min(1, Math.max(0, (time - started) / duration));
    let end = Math.min(target.length, from + Math.ceil((target.length - from) * progress));
    // Never split an emoji's UTF-16 surrogate pair while revealing a token.
    if (end < target.length && end > 0 && /[\uDC00-\uDFFF]/.test(target[end])) end--;
    write(target.slice(0, end)); lastPaint = time;
    if (end < target.length) frame = frames.request(tick);
  }
  return {
    update(value: string, animate = true) {
      if (disposed) return;
      target = value;
      if (!animate || !value.startsWith(shown)) {
        if (frame !== undefined) frames.cancel(frame);
        frame = undefined; write(value); return;
      }
      if (value === shown) { if (frame !== undefined) frames.cancel(frame); frame = undefined; return; }
      from = shown.length; started = frames.now();
      duration = Math.min(180, Math.max(32, (value.length - from) * 9));
      if (frame === undefined) frame = frames.request(tick);
    },
    dispose() { disposed = true; if (frame !== undefined) frames.cancel(frame); },
  };
}
