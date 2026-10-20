type KeyboardBridge = { postMessage(value: string): void };
export function observeComposerKeyboard(onChange: (open: boolean) => void) {
  const native = (window as Window & { SuperGPTComposer?: KeyboardBridge & { addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; removeEventListener?(type: 'message', listener: (event: MessageEvent) => void): void } }).SuperGPTComposer;
  if (!native?.addEventListener) return () => {};
  const listener = (event: MessageEvent) => { try { const value = JSON.parse(String(event.data)); if (value.event === 'keyboard' && typeof value.open === 'boolean') onChange(value.open); } catch { /* Ignore unrelated messages. */ } };
  native.addEventListener('message', listener); native.postMessage('observe');
  return () => native.removeEventListener?.('message', listener);
}
export function mobileComposerKeyboard(action: 'show' | 'hide') {
  const native = (window as Window & { SuperGPTComposer?: KeyboardBridge }).SuperGPTComposer;
  // Browsers only focus the field; their own keyboard policy remains in control.
  try { native?.postMessage(action); } catch { /* A normal tap can still open IME. */ }
}
