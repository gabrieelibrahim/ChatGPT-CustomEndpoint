import { diagnosticReport, logDiagnostic } from '../lib/diagnosticLog';
import { isNativeDesktop } from '../lib/nativeDesktop';

type Bridge = { postMessage(value: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void };
const pending = new Map<string, { resolve(value: string): void; reject(reason: Error): void }>();
const bound = new WeakSet<Bridge>();
export async function exportDeviceFile(name: string, text: string, type = 'application/json') {
  const bridge = (window as Window & { SuperGPTExport?: Bridge }).SuperGPTExport;
  if (!bridge) {
    if (isNativeDesktop() && /Android/i.test(navigator.userAgent)) throw Error('Ekspor memerlukan APK terbaru.');
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return 'downloaded';
  }
  if (!bound.has(bridge)) {
    bound.add(bridge);
    bridge.addEventListener('message', event => { try {
      const value = JSON.parse(String(event.data)), request = pending.get(value.id);
      if (!request) return;
      pending.delete(value.id);
      if (value.error) request.reject(Error(value.error)); else request.resolve(value.status);
    } catch { /* Ignore malformed messages. */ } });
  }
  const id = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { bridge.postMessage(JSON.stringify({ id, name, type, text })); }
    catch { pending.delete(id); reject(Error('Pemilih lokasi simpan tidak tersedia.')); }
  });
}
export async function reportBug() {
  const entries = JSON.parse(diagnosticReport());
  const recent = entries.entries.slice(-8).map((entry: { area: string; event: string; detail: object }) => `${entry.area}: ${entry.event} ${JSON.stringify(entry.detail)}`).join('\n');
  const draft = `Laporan bug SuperGPT\n\nMasalah: \nLangkah kejadian: \n\nPlatform: ${entries.native ? 'APK' : 'Browser'}\nViewport: ${innerWidth}×${innerHeight}\nLog terakhir:\n${recent}`.slice(0, 3800);
  const url = 'https://t.me/gaasssiikkkkk?text=' + encodeURIComponent(draft);
  if (isNativeDesktop()) { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
  else window.open(url, '_blank', 'noopener,noreferrer');
}
export function configureTaskNotifications(enabled: boolean, requestPermission = false) {
  try {
  const bridge = (window as Window & { SuperGPTNotifications?: Bridge }).SuperGPTNotifications;
  if (bridge) bridge.postMessage(JSON.stringify({ op: 'configure', enabled, requestPermission }));
  else if (enabled && requestPermission && typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission().catch(() => {});
  } catch { logDiagnostic('app', 'notification-unavailable', {}, 'error'); }
}
export function notifyTaskComplete(title: string, body = 'Respons selesai. Ketuk untuk membuka obrolan.') {
  try {
  const bridge = (window as Window & { SuperGPTNotifications?: Bridge }).SuperGPTNotifications;
  if (bridge) bridge.postMessage(JSON.stringify({ op: 'notify', title: title.slice(0, 160), body: body.slice(0, 300) }));
  else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('SuperGPT · ' + title, { body });
  } catch { logDiagnostic('app', 'notification-failed', {}, 'error'); }
}
