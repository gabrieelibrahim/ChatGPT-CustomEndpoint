import { useEffect, useSyncExternalStore } from 'react';
type State = { phase: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'installing' | 'ready' | 'error'; message: string; currentVersion: string; version: string; autoCheck: boolean; autoDownload: boolean; autoInstall: boolean; wifiOnly: boolean; lastChecked: number; native: boolean };
type Bridge = { postMessage(value: string): void; addEventListener(type: 'message', callback: (event: MessageEvent) => void): void };
let state: State = { phase: 'idle', message: '', currentVersion: '', version: '', autoCheck: true, autoDownload: true, autoInstall: true, wifiOnly: true, lastChecked: 0, native: false };
let connected: Bridge | undefined;
const listeners = new Set<() => void>();
function bridge() { return (window as Window & { SuperGPTUpdates?: Bridge }).SuperGPTUpdates; }
function connect() {
  const native = bridge(); if (!native || connected === native) return;
  connected = native;
  native.addEventListener('message', event => { try {
    const value = JSON.parse(String(event.data));
    if (!['idle', 'checking', 'current', 'available', 'downloading', 'installing', 'ready', 'error'].includes(value.phase)) return;
    state = { ...state, phase: value.phase, message: typeof value.message === 'string' ? value.message.slice(0, 500) : '', currentVersion: String(value.currentVersion || '').slice(0, 40), version: String(value.version || '').slice(0, 40), native: true,
      autoCheck: value.autoCheck === true, autoDownload: value.autoDownload === true, autoInstall: value.autoInstall === true, wifiOnly: value.wifiOnly === true, lastChecked: Number.isFinite(value.lastChecked) ? value.lastChecked : 0 };
    listeners.forEach(notify => notify());
  } catch { /* Ignore malformed messages. */ } });
  native.postMessage(JSON.stringify({ op: 'observe' }));
}
export function updateAction(op: 'check' | 'download' | 'install' | 'status' | 'configure', changes?: Partial<Pick<State, 'autoCheck' | 'autoDownload' | 'autoInstall' | 'wifiOnly'>>) {
  try { connect(); bridge()?.postMessage(JSON.stringify({ op, ...changes })); } catch { /* Native bridge unavailable. */ }
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAppUpdates() {
  const value = useSyncExternalStore(subscribe, () => state);
  useEffect(() => { connect(); const refresh = () => updateAction('status'); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  useEffect(() => { if (!['downloading', 'checking', 'installing'].includes(value.phase)) return; const timer = setInterval(() => updateAction('status'), 4000); return () => clearInterval(timer); }, [value.phase]);
  return value;
}
