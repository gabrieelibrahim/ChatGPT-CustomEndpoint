type KeyboardBridge = { postMessage(value: string): void };
export function mobileComposerKeyboard(action: 'show' | 'hide') {
  const native = (window as Window & { SuperGPTComposer?: KeyboardBridge }).SuperGPTComposer;
  // Browsers only focus the field; their own keyboard policy remains in control.
  try { native?.postMessage(action); } catch { /* A normal tap can still open IME. */ }
}
