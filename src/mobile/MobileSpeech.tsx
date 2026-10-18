import { useEffect, useRef, useState } from 'react';
import { UIIcon } from '../components/UIIcon';
import { loadSettings } from '../lib/clientSettings';
import { captureSpeech, type SpeechCapture } from './speechCapture';

type Phase = 'ready' | 'starting' | 'listening' | 'transcribing' | 'review' | 'thinking' | 'speaking' | 'error';
export function MobileSpeech({ mode, onClose, onDictation, onReply }: {
  mode: 'dictation' | 'voice'; onClose(): void; onDictation(text: string): void; onReply(text: string): Promise<string>;
}) {
  const [phase, setPhase] = useState<Phase>('ready'), [text, setText] = useState(''), [reply, setReply] = useState(''), [error, setError] = useState(''), [captions, setCaptions] = useState(true);
  const close = useRef<HTMLButtonElement>(null), capture = useRef<SpeechCapture | null>(null), epoch = useRef(0), utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(25).fill(.08));
  const accepted = useRef(false), finalizing = useRef(false), captureFailed = useRef(false);
  function stopAudio() {
    if (utterance.current) { utterance.current.onend = utterance.current.onerror = null; utterance.current = null; window.speechSynthesis?.cancel(); }
  }
  function cancelCapture() { epoch.current++; capture.current?.cancel(); capture.current = null; stopAudio(); }
  useEffect(() => { if (mode === 'dictation') start(); else close.current?.focus({ preventScroll: true }); return cancelCapture; }, []);
  async function answer(value: string, token: number) {
    if (!value.trim()) { setPhase('ready'); return; }
    setPhase('thinking');
    try {
      const result = await onReply(value);
      if (epoch.current !== token) return;
      setReply(result);
      if (!window.speechSynthesis) throw Error('Pembacaan suara belum tersedia. Jawaban tetap tampil sebagai teks.');
      const settings = loadSettings(), speech = new SpeechSynthesisUtterance(result);
      speech.rate = settings.voiceRate; speech.volume = settings.voiceVolume;
      const selected = window.speechSynthesis.getVoices().find(voice => voice.voiceURI === settings.voice);
      if (selected) speech.voice = selected;
      speech.onend = () => { if (epoch.current === token) { utterance.current = null; setPhase('ready'); } };
      speech.onerror = () => { if (epoch.current === token) { utterance.current = null; setError('Jawaban belum bisa dibacakan.'); setPhase('error'); } };
      utterance.current = speech; setPhase('speaking'); window.speechSynthesis.speak(speech);
    } catch (failure) { if (epoch.current === token) { setError(failure instanceof Error ? failure.message : 'Percakapan suara terhenti.'); setPhase('error'); } }
  }
  function start() {
    cancelCapture(); const token = epoch.current;
    accepted.current = false; finalizing.current = false; captureFailed.current = false; setLevels(Array(25).fill(.08));
    window.speechSynthesis?.cancel();
    setText(''); setError(''); setPhase('starting');
    try {
      capture.current = captureSpeech({ language: loadSettings().dictationLanguage, continuous: mode === 'dictation',
        onStart: () => { if (epoch.current === token) setPhase('listening'); },
        onText: value => { if (epoch.current === token) setText(value); },
        onLevel: value => { if (epoch.current === token) setLevels(previous => [...previous.slice(1), Math.max(.08, Math.min(1, value))]); },
        onProcessing: () => { if (epoch.current === token && mode === 'dictation') setPhase('transcribing'); },
        onEnd: value => { if (epoch.current !== token) return; if (mode === 'dictation') { if (value.trim()) acceptText(value); else { setError('Belum terdengar suara. Coba lagi.'); setPhase('error'); finalizing.current = false; } } else void answer(value, token); },
        onError: message => { if (epoch.current === token) { captureFailed.current = true; finalizing.current = false; setError(message); setPhase('error'); } },
      });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Mikrofon tidak tersedia.'); setPhase('error'); }
  }
  function acceptText(value: string) {
    if (accepted.current) return;
    accepted.current = true; cancelCapture(); onDictation(value.trim());
  }
  async function confirm() {
    if (finalizing.current) return;
    finalizing.current = true;
    const token = epoch.current; setPhase('transcribing');
    const value = capture.current ? await capture.current.stop() : text;
    if (token === epoch.current && !captureFailed.current) { if (value.trim()) acceptText(value); else { finalizing.current = false; setPhase('error'); setError('Belum terdengar suara. Coba lagi.'); } }
  }
  const status = error || ({ ready: 'Ketuk mikrofon untuk bicara', starting: 'Menyiapkan mikrofon…', listening: 'Mendengarkan…', transcribing: 'Mentranskripsi…', review: 'Tinjau hasil dikte', thinking: 'Menunggu jawaban…', speaking: 'Berbicara…', error: 'Coba lagi' } as const)[phase];
  const listening = phase === 'listening' || phase === 'starting';
  if (mode === 'dictation') return <div className="m-dictation" role="group" aria-label="Dikte">
    {error && <p className="m-dictation-transcript" role="alert">{error}</p>}
    <div className="m-dictation-bar" aria-busy={phase === 'transcribing'}>
      <button type="button" aria-label="Cancel dictation" onClick={onClose}><UIIcon name="close"/></button>
      {phase === 'transcribing' ? <span className="m-dictation-progress">Mentranskripsi…</span> : <div className="m-speech-signal" aria-hidden="true">{levels.map((level, n) => <i key={n} style={{ height: `${4 + level * 24}px` }}/>)}</div>}
      <span className="m-speech-status" role="status">{status}</span>
      {phase === 'error' ? <button type="button" aria-label="Retry dictation" onClick={start}><UIIcon name="mic"/></button> : <><button type="button" className="m-dictation-stop" aria-label="Stop dictation" disabled={!listening} onClick={() => void confirm()}><UIIcon name="stop"/></button><button type="button" className="m-dictation-accept" aria-label="Accept dictation" disabled={!listening} onClick={() => void confirm()}><UIIcon name="arrow"/></button></>}
    </div>
  </div>;
  return <section className="m-voice-screen" role="dialog" aria-modal="true" aria-label="SuperGPT Voice">
    <header><button type="button" aria-label="Toggle voice captions" aria-pressed={captions} onClick={() => setCaptions(value => !value)}>Aa</button><button ref={close} type="button" aria-label="Close voice" onClick={onClose}><UIIcon name="close"/></button></header>
    <div className={`m-voice-orb m-voice-${phase}`} aria-hidden="true"/>
    <p className="m-voice-status" role={error ? 'alert' : 'status'}>{status}</p>
    {captions && <div className="m-voice-captions">{text && <p>{text}</p>}{reply && <p>{reply}</p>}</div>}
    <footer><button type="button" aria-label={listening ? 'Mute microphone' : 'Start voice microphone'} disabled={phase === 'thinking'} onClick={() => { if (listening) { cancelCapture(); setPhase('ready'); } else start(); }}><UIIcon name={listening ? 'mic' : 'wave'}/></button><button type="button" aria-label="End voice conversation" onClick={onClose}><UIIcon name="close"/></button></footer>
    <small>Suara perangkat · model endpoint yang dipilih</small>
  </section>;
}
