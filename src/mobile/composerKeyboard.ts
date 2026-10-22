type KeyboardBridge = { postMessage(value: string): void };
type ObservableBridge = KeyboardBridge & { addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; removeEventListener?(type: 'message', listener: (event: MessageEvent) => void): void };

/**
 * Keyboard state from the Android app. With `onLift`, the app also streams every frame of the keyboard animation
 * (Android 11+): `onLift(px)` gets how far the composer must rise above its resting place, so the page can follow
 * the keyboard instead of jumping when WebView resizes. `onLift(null)` means frame tracking is unavailable.
 */
export function observeComposerKeyboard(onChange: (open: boolean) => void, onLift?: (lift: number | null) => void) {
  const native = (window as Window & { SuperGPTComposer?: ObservableBridge }).SuperGPTComposer;
  if (!native?.addEventListener) { onLift?.(null); return () => {}; }
  let open: boolean | undefined;
  const report = (next: boolean) => { if (next !== open) { open = next; onChange(next); } };
  const listener = (event: MessageEvent) => {
    try {
      const value = JSON.parse(String(event.data));
      if (value.event === 'keyboard' && typeof value.open === 'boolean') report(value.open);
      else if (value.event === 'ime' && onLift && Number.isFinite(value.height) && Number.isFinite(value.nav)) {
        const lift = Math.max(0, value.height - value.nav);
        onLift(lift);
        // WebView no longer resizes for the keyboard, so the settled inset is also the open/closed signal.
        if (value.phase === 'settle') report(lift > 80);
      } else if (value.event === 'ime-unsupported') onLift?.(null);
    } catch { /* Ignore unrelated messages. */ }
  };
  native.addEventListener('message', listener); native.postMessage('observe');
  if (onLift) native.postMessage('track-ime');
  return () => native.removeEventListener?.('message', listener);
}
export function mobileComposerKeyboard(action: 'show' | 'hide') {
  const native = (window as Window & { SuperGPTComposer?: KeyboardBridge }).SuperGPTComposer;
  // Browsers only focus the field; their own keyboard policy remains in control.
  try { native?.postMessage(action); } catch { /* A normal tap can still open IME. */ }
}
