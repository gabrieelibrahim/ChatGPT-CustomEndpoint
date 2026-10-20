import { loadSettings } from '../lib/clientSettings';
import { logDiagnostic } from '../lib/diagnosticLog';
import { captureRecordedSpeech, hasEndpointRecorder, hasTranscriptionEndpoint } from './recordedSpeech';
type RecognitionResult = { isFinal?: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
};
export type SpeechCapture = { stop(): Promise<string>; cancel(): void };
export type CaptureOptions = {
  language: string; continuous: boolean; onStart(): void;
  onText(text: string): void; onEnd(text: string): void; onError(message: string): void;
  onLevel?(level: number): void;
  onProcessing?(): void;
};
type NativeSpeechBridge = {
  postMessage(value: string): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};
const nativeListeners = new WeakMap<NativeSpeechBridge, Map<string, (value: Record<string, unknown>) => void>>();
let nativeSequence = 0;
function speechError(code: unknown) {
  logDiagnostic('speech', 'failed', { engine: 'device', code: typeof code === 'string' ? code : 'unknown' }, 'error');
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Izin mikrofon ditolak. Izinkan mikrofon untuk menggunakan dikte.';
  if (code === 'no-speech') return 'Belum terdengar suara. Coba lagi.';
  if (code === 'unavailable') return 'Layanan dikte Android belum tersedia. Aktifkan layanan pengenalan suara perangkat.';
  if (code === 'interrupted') return 'Dikte dihentikan saat aplikasi ditinggalkan. Ketuk mikrofon untuk mulai lagi.';
  if (code === 'language-unavailable') return 'Bahasa dikte belum tersedia di layanan suara perangkat. Pilih bahasa lain di pengaturan.';
  if (code === 'network' || code === 'network-timeout') return 'Layanan suara perangkat gagal terhubung. Pilih Custom Endpoint di Pengaturan → Suara, atau periksa jaringan layanan suara Android.';
  if (code === 'busy') return 'Mikrofon atau layanan suara sedang sibuk. Tutup rekaman lain lalu coba lagi.';
  if (code === 'audio-capture') return 'Mikrofon tidak dapat merekam. Periksa izin dan aplikasi lain yang memakai mikrofon.';
  return `Dikte perangkat gagal (${typeof code === 'string' && /^[a-z-]+$/.test(code) ? code : 'unknown'}). Buka Log di Pengaturan atau pilih Custom Endpoint di Pengaturan → Suara.`;
}
function captureNativeSpeech(native: NativeSpeechBridge, options: CaptureOptions): SpeechCapture {
  let listeners = nativeListeners.get(native);
  if (!listeners) {
    listeners = new Map(); nativeListeners.set(native, listeners);
    const handlers = listeners;
    native.addEventListener('message', event => {
      try {
        const value = JSON.parse(String(event.data));
        if (value && typeof value.id === 'string') handlers.get(value.id)?.(value);
      } catch { /* Ignore malformed or unrelated bridge messages. */ }
    });
  }
  const id = `speech-${Date.now()}-${++nativeSequence}`;
  let active = true, text = '', failed = false, started = false, stopping: Promise<string> | undefined;
  let resolveStop: ((text: string) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const send = (op: 'start' | 'stop' | 'cancel') => native.postMessage(JSON.stringify({ id, op, ...(op === 'start' ? { language: options.language === 'auto' ? navigator.language : options.language } : {}) }));
  function cleanup() { active = false; clearTimeout(timer); listeners!.delete(id); window.removeEventListener?.('pagehide', cancel); }
  function cancel() { if (!active) return; cleanup(); failed = true; text = ''; resolveStop?.(''); try { send('cancel'); } catch { /* Already unavailable. */ } }
  function end() { if (!active) return; cleanup(); resolveStop?.(failed ? '' : text); if (!failed) options.onEnd(text); }
  function fail(code: unknown) { if (!active) return; failed = true; cleanup(); resolveStop?.(''); options.onError(speechError(code)); }
  listeners.set(id, value => {
    if (!active) return;
    if (value.event === 'started' && !started && !stopping) { started = true; clearTimeout(timer); timer = undefined; options.onStart(); }
    else if (value.event === 'text' && typeof value.text === 'string') { text = value.text; options.onText(text); }
    else if (value.event === 'level' && typeof value.level === 'number' && Number.isFinite(value.level)) options.onLevel?.(Math.max(0, Math.min(1, value.level)));
    else if (value.event === 'processing') options.onProcessing?.();
    else if (value.event === 'end') { if (typeof value.text === 'string') { text = value.text; options.onText(text); } end(); }
    else if (value.event === 'error') fail(value.code);
  });
  // Permission prompts may remain open; a cancelled or timed-out request must never
  // start capturing when a delayed permission grant arrives.
  timer = setTimeout(() => { try { send('cancel'); } catch { /* Bridge unavailable. */ } fail('timeout'); }, 60000);
  window.addEventListener?.('pagehide', cancel);
  try { send('start'); } catch (error) { cleanup(); throw error; }
  return {
    stop() {
      if (!active) return Promise.resolve(failed ? '' : text);
      if (stopping) return stopping;
      stopping = new Promise(resolve => { resolveStop = resolve; });
      clearTimeout(timer);
      timer = setTimeout(() => { try { send('cancel'); } catch { /* Bridge unavailable. */ } fail('timeout'); }, 16000);
      try { send('stop'); } catch { fail('unavailable'); }
      return stopping;
    },
    cancel,
  };
}
export function captureSpeech(options: CaptureOptions): SpeechCapture {
  const engine = loadSettings().dictationEngine;
  if (engine === 'endpoint' || (engine === 'auto' && hasEndpointRecorder() && hasTranscriptionEndpoint())) return captureRecordedSpeech(options);
  logDiagnostic('speech', 'requested', { engine: 'device' });
  const native = (window as unknown as { SuperGPTSpeech?: NativeSpeechBridge }).SuperGPTSpeech;
  if (native) return captureNativeSpeech(native, options);
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  if (!Constructor) throw Error('Dikte belum didukung perangkat ini. Kamu tetap bisa mengetik pesan.');
  const recognition = new Constructor();
  let active = true, text = '', failed = false, stopping: Promise<string> | undefined;
  let resolveStop: ((text: string) => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  recognition.lang = options.language === 'auto' ? navigator.language : options.language;
  recognition.continuous = options.continuous; recognition.interimResults = true;
  function cleanup() { active = false; clearTimeout(timer); recognition.onstart = recognition.onend = recognition.onspeechend = recognition.onerror = recognition.onresult = null; }
  function end() { if (!active) return; cleanup(); resolveStop?.(failed ? '' : text); if (!failed) options.onEnd(text); }
  recognition.onstart = () => { if (active) options.onStart(); };
  recognition.onspeechend = () => { if (active && (!options.continuous || stopping)) options.onProcessing?.(); };
  recognition.onresult = event => {
    if (!active) return;
    text = Array.from(event.results, result => result[0].transcript).join(' ').trim(); options.onText(text);
  };
  recognition.onerror = event => {
    if (!active) return;
    failed = true;
    options.onError(speechError(event.error));
    end();
    try { recognition.abort(); } catch { /* The device may have already ended it. */ }
  };
  recognition.onend = end;
  try { recognition.start(); } catch (error) { cleanup(); throw error; }
  return {
    stop() {
      if (!active) return Promise.resolve(failed ? '' : text);
      if (stopping) return stopping;
      stopping = new Promise(resolve => { resolveStop = resolve; });
      timer = setTimeout(() => { recognition.onerror = null; try { recognition.abort(); } catch { /* Already stopped. */ } end(); }, 2500);
      try { recognition.stop(); } catch { end(); }
      return stopping;
    },
    cancel() { if (!active) return; cleanup(); failed = true; text = ''; resolveStop?.(''); try { recognition.abort(); } catch { /* Already stopped by the device. */ } },
  };
}
