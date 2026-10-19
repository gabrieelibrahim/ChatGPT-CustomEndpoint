import { useEffect, useRef, useState } from 'react';
import type { SdkConnection } from './transport';

export function SdkVoice({ connection, onClose }: { connection: SdkConnection; onClose: () => void }) {
  const [status, setStatus] = useState('Siap'), [active, setActive] = useState(false), [muted, setMuted] = useState(false);
  const session = useRef<import('@openai/agents/realtime').RealtimeSession | null>(null), generation = useRef(0);
  const stop = () => { generation.current++; session.current?.close(); session.current = null; setActive(false); setMuted(false); setStatus('Terputus'); };
  useEffect(() => () => { generation.current++; session.current?.close(); }, []);
  async function start() {
    const current = ++generation.current; setStatus('Menghubungkan…'); setActive(true);
    try {
      const [{ RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC }, credential] = await Promise.all([import('@openai/agents/realtime'), connection.request<{ value: string; model: string; callsUrl: string }>('/realtime')]);
      if (current !== generation.current) return;
      const value = new RealtimeSession(new RealtimeAgent({ name: 'SuperGPT', instructions: 'You are SuperGPT by Sakelar. Speak in the user language. Do not claim access to tools that are not connected.' }), { model: credential.model, transport: new OpenAIRealtimeWebRTC({ baseUrl: credential.callsUrl }), tracingDisabled: true });
      session.current = value;
      value.on('error', () => { if (current === generation.current) { stop(); setStatus('Koneksi suara gagal. Periksa dukungan Realtime dan izin mikrofon.'); } });
      // Only this explicit button connects to the microphone. Long-lived provider
      // credentials never enter the WebRTC session or the ChatKit iframe.
      await value.connect({ apiKey: credential.value });
      if (current !== generation.current) { value.close(); return; } setStatus('Terhubung');
    } catch { if (current === generation.current) { stop(); setStatus('Realtime belum dapat tersambung. Periksa model audio, API, dan izin mikrofon.'); } }
  }
  return <section className="sg-voice" role="dialog" aria-modal="true" aria-label="Voice SuperGPT"><button className="sg-close" aria-label="Tutup voice" onClick={() => { stop(); onClose(); }}>×</button><div className={'sg-orb' + (active ? ' sg-active' : '')} aria-hidden="true"/><h2>Voice SuperGPT</h2><p role="status">{status}</p>{active ? <div className="sg-actions"><button onClick={() => { session.current?.mute(!muted); setMuted(!muted); }}>{muted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}</button><button onClick={stop}>Akhiri</button></div> : <button className="sg-primary" onClick={() => void start()}>Mulai percakapan suara</button>}<small>Audio dikirim ke endpoint Realtime pilihanmu.</small></section>;
}
