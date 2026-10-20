export type DiagnosticEntry = { id: string; time: number; area: 'speech' | 'chat' | 'files' | 'app'; event: string; level: 'info' | 'error'; detail: Record<string, string | number | boolean> };
const key = 'client-diagnostic-log-v1';
const areas = ['speech', 'chat', 'files', 'app'];
const fields = new Set(['engine', 'code', 'status', 'bytes', 'count', 'durationMs', 'native', 'kind']);
const codes = new Set(['not-allowed', 'service-not-allowed', 'no-speech', 'unavailable', 'interrupted', 'language-unavailable', 'network', 'network-timeout', 'busy', 'audio-capture', 'recognition-failed', 'audio-capture-failed', 'capture-failed', 'capture-timeout', 'start-timeout', 'timeout', 'transcription-failed', 'capture-unavailable', 'bridge-unavailable', 'invalid-audio', 'unknown', 'completed', 'failed']);
// Deliberately accepts only diagnostic codes/counters, never request bodies,
// transcripts, filenames, URLs, API keys, provider error bodies or stacks.
function details(value: unknown): DiagnosticEntry['detail'] {
  const result: DiagnosticEntry['detail'] = {};
  if (!value || typeof value !== 'object') return result;
  for (const [name, item] of Object.entries(value)) {
    if (!fields.has(name)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) result[name] = item;
    else if (typeof item === 'boolean') result[name] = item;
    else if (typeof item === 'string' && ((name === 'engine' && ['device', 'endpoint'].includes(item)) || (name === 'code' && codes.has(item)) || (name === 'kind' && ['media', 'document'].includes(item)))) result[name] = item;
  }
  return result;
}
export function loadDiagnosticLog(): DiagnosticEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(v => v && typeof v.id === 'string' && Number.isFinite(v.time) && areas.includes(v.area) && /^[a-z0-9_.-]{1,64}$/i.test(v.event) && ['info', 'error'].includes(v.level)).slice(-300).map(v => ({ id: v.id, time: v.time, area: v.area, event: v.event, level: v.level, detail: details(v.detail) })) : [];
  } catch { return []; }
}
export function logDiagnostic(area: DiagnosticEntry['area'], event: string, detail: Record<string, unknown> = {}, level: DiagnosticEntry['level'] = 'info') {
  if (!/^[a-z0-9_.-]{1,64}$/i.test(event)) return;
  try {
    const entry: DiagnosticEntry = { id: crypto.randomUUID(), time: Date.now(), area, event, level, detail: details(detail) };
    localStorage.setItem(key, JSON.stringify([...loadDiagnosticLog(), entry].slice(-300)));
    window.dispatchEvent(new Event('client-log-changed'));
  } catch { /* Diagnostics must never prevent capture or chat. */ }
}
export function clearDiagnosticLog() { try { localStorage.removeItem(key); window.dispatchEvent(new Event('client-log-changed')); } catch { /* Storage may be disabled. */ } }
export function diagnosticReport() { return JSON.stringify({ app: 'SuperGPT', native: '__TAURI_INTERNALS__' in window, viewport: { width: innerWidth, height: innerHeight }, entries: loadDiagnosticLog() }, null, 2); }
