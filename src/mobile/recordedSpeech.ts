import type { CaptureOptions, SpeechCapture } from './speechCapture';
import { loadEndpointKeys, loadEndpointStore, normalizeBaseUrl } from '../lib/endpointProfiles';
import { loadSettings } from '../lib/clientSettings';
import { isNativeDesktop, nativeProviderFetch } from '../lib/nativeDesktop';
import { usesLocalProviderRelay } from '../lib/providerTransport';
import { logDiagnostic } from '../lib/diagnosticLog';

type AudioBridge = { postMessage(value: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void };
const bridges = new WeakMap<AudioBridge, Map<string, (value: Record<string, unknown>) => void>>();
export function hasEndpointRecorder() { return !!(window as unknown as { SuperGPTAudio?: AudioBridge }).SuperGPTAudio; }
export function hasTranscriptionEndpoint() { const store = loadEndpointStore(); return store.profiles.some(p => p.id === store.selectedId); }
export async function transcribeAudio(blob: Blob, signal: AbortSignal, language: string): Promise<string> {
  const settings = loadSettings(), store = loadEndpointStore(), endpoint = store.profiles.find(p => p.id === store.selectedId);
  if (!endpoint) throw Error('Pilih Custom Endpoint sebelum menggunakan transkripsi API.');
  const key = endpoint.auth === 'bearer' ? loadEndpointKeys(store.profiles)[endpoint.id] || '' : '';
  if (endpoint.auth === 'bearer' && !key) throw Error('API key endpoint belum tersedia. Simpan ulang di Custom Endpoint.');
  if (blob.size > 5 * 1024 * 1024 || !blob.size) throw Error('Rekaman kosong atau melebihi 5 MB.');
  const model = settings.transcriptionModel, url = normalizeBaseUrl(endpoint.baseUrl) + '/audio/transcriptions';
  const mime = blob.type.split(';')[0], filename = mime === 'audio/webm' ? 'dictation.webm' : mime === 'audio/ogg' ? 'dictation.ogg' : 'dictation.m4a';
  const form = new FormData(); form.append('file', blob, filename); form.append('model', model); form.append('response_format', 'json');
  const lang = language === 'auto' ? '' : language.split('-')[0];
  if (lang) form.append(model === 'gpt-transcribe' ? 'languages[]' : 'language', lang);
  logDiagnostic('speech', 'transcription-request', { engine: 'endpoint', bytes: blob.size });
  let response: Response;
  if (usesLocalProviderRelay()) {
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    response = await fetch('/__client/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, key, audio: { data: btoa(binary), type: mime, model, language: lang } }), signal, credentials: 'omit', redirect: 'error', cache: 'no-store' });
  } else response = await (isNativeDesktop() ? nativeProviderFetch : fetch)(url, { method: 'POST', headers: { Accept: 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }, body: form, signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
  logDiagnostic('speech', 'transcription-response', { engine: 'endpoint', status: response.status }, response.ok ? 'info' : 'error');
  if (!response.ok) {
    await response.body?.cancel();
    if ([400, 404, 405, 422, 501].includes(response.status)) throw Error(`Endpoint tidak mendukung model/transkripsi yang dipilih (HTTP ${response.status}). Atur model transkripsi di Pengaturan → Suara, atau pilih layanan perangkat.`);
    if ([401, 403].includes(response.status)) throw Error('Transkripsi ditolak. Periksa API key dan izin audio penyedia.');
    if (response.status === 429) throw Error('Kuota transkripsi habis atau terkena batas permintaan penyedia.');
    throw Error(`Transkripsi gagal (HTTP ${response.status}). Cek Log di Pengaturan.`);
  }
  const value = await response.json();
  if (typeof value?.text !== 'string' || !value.text.trim()) throw Error('Penyedia tidak mengembalikan teks transkripsi.');
  return value.text.trim();
}

export function captureRecordedSpeech(options: CaptureOptions): SpeechCapture {
  const controller = new AbortController(), startedAt = Date.now();
  let active = true, stopping = false, processing = false, text = '', recorder: MediaRecorder | undefined, stream: MediaStream | undefined;
  let release = () => {}, timer: ReturnType<typeof setTimeout> | undefined, audioContext: AudioContext | undefined;
  let resolve: (value: string) => void;
  const done = new Promise<string>(value => { resolve = value; });
  const native = (window as unknown as { SuperGPTAudio?: AudioBridge }).SuperGPTAudio;
  const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function cleanup() { clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); stream = undefined; void audioContext?.close().catch(() => {}); audioContext = undefined; release(); window.removeEventListener('pagehide', cancel); }
  function cancel() { if (!active) return; active = false; controller.abort(); if (native) try { native.postMessage(JSON.stringify({ id, op: 'cancel' })); } catch { /* Already gone. */ } if (recorder?.state === 'recording') recorder.stop(); cleanup(); resolve(''); logDiagnostic('speech', 'cancelled', { engine: 'endpoint' }); }
  function fail(message: string, code: string) { if (!active) return; logDiagnostic('speech', 'failed', { engine: 'endpoint', code }, 'error'); active = false; controller.abort(); if (native) try { native.postMessage(JSON.stringify({ id, op: 'cancel' })); } catch { /* Bridge gone. */ } cleanup(); resolve(''); options.onError(message); }
  async function audio(blob: Blob) {
    if (!active || processing) return;
    processing = true;
    clearTimeout(timer); stopping = true; options.onProcessing?.();
    timer = setTimeout(() => fail('Transkripsi terlalu lama. Coba lagi.', 'timeout'), 120000);
    try { text = await transcribeAudio(blob, controller.signal, options.language); if (!active) return; active = false; cleanup(); resolve(text); logDiagnostic('speech', 'completed', { engine: 'endpoint', durationMs: Date.now() - startedAt }); options.onText(text); options.onEnd(text); }
    catch (error) { if (active) fail(error instanceof Error ? error.message : 'Transkripsi gagal. Cek Log di Pengaturan.', 'transcription-failed'); }
  }
  function stop() {
    if (!active || stopping) return done;
    stopping = true; clearTimeout(timer); options.onProcessing?.();
    timer = setTimeout(() => fail('Perekaman tidak merespons. Coba lagi.', 'capture-timeout'), 15000);
    if (native) { try { native.postMessage(JSON.stringify({ id, op: 'stop' })); } catch { fail('Perekam Android tidak tersedia.', 'bridge-unavailable'); } }
    else if (recorder?.state === 'recording') recorder.stop();
    else cancel();
    return done;
  }
  window.addEventListener('pagehide', cancel);
  logDiagnostic('speech', 'requested', { engine: 'endpoint', native: !!native });
  if (native) {
    let handlers = bridges.get(native);
    if (!handlers) { handlers = new Map(); bridges.set(native, handlers); const map = handlers; native.addEventListener('message', event => { try { const value = JSON.parse(String(event.data)); map.get(value.id)?.(value); } catch { /* Ignore unrelated messages. */ } }); }
    handlers.set(id, value => {
      if (!active) return;
      if (value.event === 'started' && !stopping) { clearTimeout(timer); timer = setTimeout(() => void stop(), 61000); options.onStart(); }
      else if (value.event === 'level' && typeof value.level === 'number' && Number.isFinite(value.level)) options.onLevel?.(Math.max(0, Math.min(1, value.level)));
      else if (value.event === 'audio' && typeof value.data === 'string' && value.data.length <= 7 * 1024 * 1024) {
        try { void audio(new Blob([Uint8Array.from(atob(value.data), c => c.charCodeAt(0))], { type: 'audio/mp4' })); } catch { fail('Rekaman tidak dapat dibaca.', 'invalid-audio'); }
      } else if (value.event === 'error') fail(value.code === 'not-allowed' ? 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan Android.' : value.code === 'interrupted' ? 'Dikte dihentikan saat aplikasi ditinggalkan.' : 'Perekaman gagal. Periksa apakah mikrofon dipakai aplikasi lain. Cek Log di Pengaturan.', typeof value.code === 'string' ? value.code : 'capture-failed');
    });
    release = () => handlers!.delete(id);
    timer = setTimeout(() => { try { native.postMessage(JSON.stringify({ id, op: 'cancel' })); } catch { /* Bridge gone. */ } fail('Mikrofon tidak merespons. Coba lagi.', 'start-timeout'); }, 60000);
    try { native.postMessage(JSON.stringify({ id, op: 'start', continuous: options.continuous })); } catch { fail('Perekam Android tidak tersedia.', 'bridge-unavailable'); }
  } else {
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Error('Perekaman tidak didukung browser ini. Pilih layanan perangkat di Pengaturan → Suara.');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active || stopping) { stream.getTracks().forEach(track => track.stop()); return; }
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        const chunks: Blob[] = []; let bytes = 0;
        recorder.ondataavailable = e => { if (active) { chunks.push(e.data); bytes += e.data.size; if (bytes > 5 * 1024 * 1024) cancel(); } };
        recorder.onstop = () => { stream?.getTracks().forEach(track => track.stop()); if (active) void audio(new Blob(chunks, { type: recorder!.mimeType })); };
        recorder.onerror = () => fail('Perekaman mikrofon gagal.', 'capture-failed');
        // Real input energy drives the waveform, never simulated amplitude.
        try { audioContext = new AudioContext(); const analyser = audioContext.createAnalyser(); analyser.fftSize = 256; audioContext.createMediaStreamSource(stream).connect(analyser); const samples = new Uint8Array(analyser.fftSize); let meter: ReturnType<typeof setInterval>; meter = setInterval(() => { if (!active || stopping) { clearInterval(meter); return; } analyser.getByteTimeDomainData(samples); options.onLevel?.(Math.min(1, Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length) * 5)); }, 90); const previous = release; release = () => { clearInterval(meter); previous(); }; } catch { /* Recording remains usable without a meter. */ }
        recorder.start(250); options.onStart(); timer = setTimeout(() => void stop(), 60000);
      } catch (error) { if (active) fail(error instanceof Error ? error.message : 'Izin mikrofon tidak tersedia.', 'capture-unavailable'); }
    })();
  }
  return { stop, cancel };
}
