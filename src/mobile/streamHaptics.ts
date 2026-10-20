type Pulse = (kind: 'tick' | 'complete') => void;
/** Presentation-only feedback. History, failed requests and hidden pages stay quiet. */
export function createStreamHaptics(pulse: Pulse, now = () => performance.now()) {
  let finished = false, lastLength = 0, lastPulse = -Infinity;
  return {
    progress(text: string, enabled = true) {
      if (finished || !enabled || text.length < 3000 || text.length - lastLength < 240 || now() - lastPulse < 900) return;
      lastLength = text.length; lastPulse = now(); pulse('tick');
    },
    complete(enabled = true) { if (finished) return; finished = true; if (enabled) pulse('complete'); },
  };
}
export function streamHaptic(kind: 'tick' | 'complete') {
  if (document.visibilityState !== 'visible') return;
  const bridge = (window as Window & { SuperGPTHaptics?: { postMessage(value: string): void } }).SuperGPTHaptics;
  try { if (bridge) bridge.postMessage(kind); else navigator.vibrate?.(kind === 'complete' ? 25 : 7); } catch { /* Optional hardware feature. */ }
}
