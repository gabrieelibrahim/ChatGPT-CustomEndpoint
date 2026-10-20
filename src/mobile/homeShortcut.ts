type HomeBridge = { postMessage(value: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; removeEventListener?(type: 'message', listener: (event: MessageEvent) => void): void };
export function bindHomeShortcut(onOpen: (title: string) => void, onNotice: (message: string) => void) {
  const bridge = (window as unknown as { SuperGPTHome?: HomeBridge }).SuperGPTHome;
  if (!bridge) return () => {};
  let active = true;
  const receive = (event: MessageEvent) => { if (!active) return; try { const value = JSON.parse(String(event.data)); if (value.event === 'open' && typeof value.title === 'string') onOpen(value.title); else if (value.event === 'pin') onNotice(value.ok ? 'Konfirmasi pintasan di layar utama Android.' : 'Launcher perangkat tidak mendukung pintasan.'); } catch { /* Ignore unrelated messages. */ } };
  bridge.addEventListener('message', receive);
  try { bridge.postMessage(JSON.stringify({ op: 'ready' })); } catch { /* Native activity may be closing. */ }
  return () => { active = false; bridge.removeEventListener?.('message', receive); };
}
export function pinHomeShortcut(title: string) {
  const bridge = (window as unknown as { SuperGPTHome?: HomeBridge }).SuperGPTHome;
  if (!bridge) return false;
  try { bridge.postMessage(JSON.stringify({ op: 'pin', title })); return true; } catch { return false; }
}
