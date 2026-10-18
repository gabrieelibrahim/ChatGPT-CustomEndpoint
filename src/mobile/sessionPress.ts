// Keep a press independent of React renders. Native scrolling cancels the
// gesture; releasing a completed hold must never also open the conversation.
export function createSessionPress(onHold: (x: number, y: number) => void, schedule = setTimeout, unschedule = clearTimeout) {
  let timer: ReturnType<typeof setTimeout> | undefined, start: { x: number; y: number } | undefined, held = false;
  function cancel() { if (timer !== undefined) unschedule(timer); timer = undefined; start = undefined; }
  return {
    down(x: number, y: number) { cancel(); held = false; start = { x, y }; timer = schedule(() => { timer = undefined; start = undefined; held = true; onHold(x, y); }, 450); },
    move(x: number, y: number) { if (start && Math.hypot(x - start.x, y - start.y) > 8) cancel(); },
    cancel,
    consumeClick() { const consumed = held; held = false; return consumed; },
  };
}
