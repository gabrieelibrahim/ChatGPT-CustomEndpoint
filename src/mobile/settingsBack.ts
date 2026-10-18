type BackBridge = {
  postMessage(value: string): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

// Only intercept Android Back while settings (or a settings-owned page) is open.
// Header navigation and Android Back use the same current React screen state.
export function bindSettingsBack(onBack: () => void) {
  const bridge = (window as unknown as { SuperGPTSettingsBack?: BackBridge }).SuperGPTSettingsBack;
  if (!bridge) return () => {};
  let active = true;
  const receive = (event: MessageEvent) => { if (active && event.data === 'back') onBack(); };
  bridge.addEventListener('message', receive);
  try { bridge.postMessage('enabled'); } catch { bridge.removeEventListener('message', receive); return () => {}; }
  const detach = () => { if (!active) return; active = false; window.removeEventListener?.('pagehide', detach); bridge.removeEventListener('message', receive); try { bridge.postMessage('disabled'); } catch { /* Activity already left. */ } };
  window.addEventListener?.('pagehide', detach);
  return detach;
}
