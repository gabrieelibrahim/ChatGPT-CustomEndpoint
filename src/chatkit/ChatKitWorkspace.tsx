import { useEffect, useRef, useState } from 'react';
import { ChatKit, useChatKit, type Entity } from '@openai/chatkit-react';
import { loadEndpointStore, loadEndpointKeys, type EndpointProfile } from '../lib/endpointProfiles';
import { useClientSettings } from '../desktop/useClientSettings';
import { recordUsage } from '../lib/clientSettings';
import { isNativeMobile } from '../lib/nativeDesktop';
import { bindSettingsBack } from '../mobile/settingsBack';
import { loadChatKit } from './loader';
import { connectSdk, type SdkConnection } from './transport';
import { loadSdkConfig, sdkConfigKey, sdkServer, type SdkConfig } from './config';
import { SdkVoice } from './SdkVoice';
import { SdkActivity } from './SdkActivity';
import './chatkit.css';

function ChatSurface({ connection, config, endpoint, onError, onReady, onThread }: { connection: SdkConnection; config: SdkConfig; endpoint: EndpointProfile; onError: (message: string) => void; onReady: () => void; onThread: (value: string | null) => void }) {
  const { settings } = useClientSettings(onError);
  const [scheme, setScheme] = useState<'light' | 'dark'>(() => document.documentElement.dataset.clientTheme === 'light' ? 'light' : 'dark');
  useEffect(() => { const observer = new MutationObserver(() => setScheme(document.documentElement.dataset.clientTheme === 'light' ? 'light' : 'dark')); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-client-theme'] }); return () => observer.disconnect(); }, []);
  const methods = useRef<ReturnType<typeof useChatKit> | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const kit = useChatKit({
    api: { url: connection.apiUrl, domainKey: config.domainKey, fetch: connection.fetch, uploadStrategy: { type: 'two_phase' } }, locale: 'id', frameTitle: 'SuperGPT by Sakelar',
    theme: { colorScheme: scheme, radius: 'pill', density: 'normal', color: { accent: { primary: settings.accent, level: 2 } }, typography: { fontFamily: 'Roboto, sans-serif', fontSources: [{ family: 'Roboto', src: location.origin + '/fonts/Roboto-Variable.ttf', weight: '100 900', display: 'swap' }] } },
    header: { title: { text: 'SuperGPT' } }, history: { enabled: true, showDelete: true, showRename: true }, thread: { autoScroll: true },
    startScreen: { greeting: 'Ada yang bisa kubantu?', prompts: [{ label: 'Buat rencana', prompt: 'Bantu aku menyusun rencana dan checklist yang jelas.', icon: 'notebook' }, { label: 'Analisis dokumen', prompt: 'Bantu aku menganalisis dokumen yang akan kulampirkan.', icon: 'document' }] },
    composer: { placeholder: 'Ask SuperGPT', models: [...new Set([endpoint?.model || '', ...(endpoint?.models || [])])].filter(Boolean).slice(0, 100).map(model => ({ id: model, label: model, default: model === endpoint?.model })),
      tools: config.options.tools ? [{ id: 'analyst', label: 'Analisis', icon: 'analytics' }, { id: 'documents', label: 'Dokumen', icon: 'document' }] : [],
      attachments: { enabled: true, maxCount: 4, maxSize: 10 * 1024 * 1024, accept: { 'text/plain': ['.txt', '.md', '.csv', '.html'], 'application/json': ['.json'], ...(config.options.vision ? { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] } : {}), ...(config.options.api === 'responses' && config.options.pdf ? { 'application/pdf': ['.pdf'] } : {}) } },
      dictation: { enabled: !!config.options.transcriptionModel },
    },
    threadItemActions: { feedback: true, retry: true }, disclaimer: { text: 'SuperGPT dapat membuat kesalahan. Periksa informasi penting.' },
    entities: { showComposerMenu: true, onTagSearch: query => connection.request<Entity[]>('/entities', { query, threadId: activeThread }), onClick: entity => onError('File: ' + entity.title), onRequestPreview: async entity => ({ preview: { type: 'Basic', children: [{ type: 'Text', value: entity.title }, { type: 'Caption', value: entity.data?.mime || 'File tersimpan' }] } }) },
    commands: { enabled: true, onSearch: async query => [{ id: 'summary', label: 'Ringkas obrolan', icon: 'document' as const }, { id: 'preferences', label: 'Lihat tema aplikasi', icon: 'settings-slider' as const }].filter(item => item.label.toLowerCase().includes(query.toLowerCase())), onSelect: async command => { try { await methods.current?.sendCustomAction({ type: command.id === 'summary' ? 'thread.summary' : 'app.preferences' }); } catch { onError('Buka obrolan dahulu untuk menjalankan perintah.'); } } },
    widgets: { onAction: async (action, item) => { if (action.type === 'checklist.copy') { try { await navigator.clipboard.writeText(String(action.payload?.text || '')); onError('Daftar disalin.'); } catch { onError('Clipboard tidak tersedia.'); } } else await methods.current?.sendCustomAction(action, item.id); } },
    onClientTool: ({ name }) => { if (name !== 'get_display_preferences') throw Error('Tool client tidak dikenal.'); return { theme: settings.theme }; },
    onReady, onError: ({ error }) => onError(error.name === 'IntegrationError' ? 'ChatKit menolak konfigurasi. Periksa domain key dan domain yang terdaftar.' : 'ChatKit belum dapat memuat respons. Periksa server, domain key, atau koneksi.'), onThreadChange: ({ threadId }) => { setActiveThread(threadId); onThread(threadId); },
    onEffect: ({ name, data }) => { if (name === 'sdk.usage' && data && (typeof data.input === 'number' || typeof data.output === 'number')) recordUsage({ provider: endpoint?.name || 'SDK', model: String(data.model || endpoint?.model || ''), source: 'agent', status: 'completed', ...(typeof data.input === 'number' ? { input: data.input } : {}), ...(typeof data.output === 'number' ? { output: data.output } : {}) }); },
  });
  methods.current = kit;
  return <ChatKit control={kit.control} className="sg-chat-surface"/>;
}

export function ChatKitWorkspace({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState(loadSdkConfig), [serverToken, setServerToken] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [voice, setVoice] = useState(false), [threadId, setThreadId] = useState<string | null>(null);
  const [connectedEndpoint, setConnectedEndpoint] = useState<EndpointProfile | null>(null);
  const [activity, setActivity] = useState(false);
  const [connection, setConnection] = useState<SdkConnection | null>(null), connectionRef = useRef<SdkConnection | null>(null), generation = useRef(0);
  const { settings } = useClientSettings(setNotice);
  const [store, setStore] = useState(loadEndpointStore), [selected, setSelected] = useState(store.selectedId || '');
  const endpoint = store.profiles.find(value => value.id === selected);
  const closeRef = useRef(onClose); closeRef.current = () => { if (voice) setVoice(false); else if (activity) setActivity(false); else onClose(); };
  useEffect(() => { const refresh = () => setStore(loadEndpointStore()); window.addEventListener('client-endpoints-changed', refresh); return () => window.removeEventListener('client-endpoints-changed', refresh); }, []);
  useEffect(() => () => { generation.current++; void connectionRef.current?.close(); }, []);
  useEffect(() => isNativeMobile() ? bindSettingsBack(() => closeRef.current()) : undefined, []);
  useEffect(() => { if (!connection || ready) return; const timer = window.setTimeout(() => setNotice('ChatKit belum siap. Periksa akses CDN OpenAI dan domain key. Kamu dapat kembali ke tampilan SuperGPT sebelumnya.'), 20000); return () => window.clearTimeout(timer); }, [connection, ready]);
  function changeOptions(change: Partial<SdkConfig['options']>) { setConfig(previous => ({ ...previous, options: { ...previous.options, ...change } })); }
  async function start() {
    if (!endpoint) { setNotice('Tambahkan Custom Endpoint terlebih dahulu di pengaturan SuperGPT.'); return; }
    const current = ++generation.current; setBusy(true); setNotice('');
    try {
      sdkServer(config.server); if (!config.domainKey.trim()) throw Error('Isi domain key ChatKit.');
      const keys = loadEndpointKeys(store.profiles); if (endpoint.auth === 'bearer' && !keys[endpoint.id]) throw Error('API key endpoint belum tersedia. Atur kembali di Custom Endpoint.');
      localStorage.setItem(sdkConfigKey, JSON.stringify(config));
      const active = await connectSdk(config, endpoint, keys[endpoint.id] || '', serverToken, settings);
      if (current !== generation.current) { await active.close(); return; }
      connectionRef.current = active; await loadChatKit();
      if (current !== generation.current) { await active.close(); return; }
      setConnectedEndpoint(endpoint); setConnection(active);
    } catch (error) { void connectionRef.current?.close(); connectionRef.current = null; setNotice((error as Error).message); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function importHistory() {
    if (!connection) return;
    setBusy(true);
    try { const raw = JSON.parse(localStorage.getItem('desktop-chat-content') || '{}'), chats = Object.entries(raw).filter(([, value]) => Array.isArray(value)).slice(0, 100).map(([title, value]) => ({ title, messages: (value as { role: string; text: string }[]).filter(item => ['user', 'assistant'].includes(item.role)).map(item => ({ role: item.role, text: item.text })) })); const result = await connection.request<{ count: number }>('/import', { chats }); setNotice(`${result.count} obrolan disalin ke server. Buka riwayat ChatKit untuk melihatnya. Lampiran lama tetap ada di library perangkat.`); }
    catch { setNotice('Riwayat belum dapat diimpor. Data asli tetap tersimpan.'); } finally { setBusy(false); }
  }
  const toggle = (key: 'tools' | 'vision' | 'pdf' | 'web' | 'code' | 'images' | 'mcp', label: string, disabled = false) => <label className="sg-toggle"><span>{label}</span><input type="checkbox" disabled={disabled} checked={!disabled && config.options[key]} onChange={event => changeOptions({ [key]: event.target.checked })}/></label>;
  return <main className="sg-workspace" onKeyDown={event => { if (event.key === 'Escape') closeRef.current(); }}>
    <header className="sg-toolbar"><button aria-label="Kembali ke SuperGPT" onClick={onClose}>‹</button><div><strong>SuperGPT</strong><small>ChatKit · Agents SDK</small></div>{connection && <button onClick={() => { generation.current++; void connection.close(); connectionRef.current = null; setConnection(null); setReady(false); setVoice(false); setActivity(false); }}>Koneksi</button>}</header>
    {notice && <div className="sg-notice" role="status"><span>{notice}</span><button aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}>×</button></div>}
    {connection ? <><div className="sg-chat-wrap">{!ready && <div className="sg-skeleton" role="status" aria-label="Memuat ChatKit"><span/><span/><span/></div>}<ChatSurface connection={connection} config={config} endpoint={connectedEndpoint!} onReady={() => setReady(true)} onError={setNotice} onThread={setThreadId}/></div><footer className="sg-utilities"><button disabled={!threadId} onClick={() => setActivity(true)}>Aktivitas</button><button disabled={busy} onClick={() => void importHistory()}>Salin riwayat lama</button>{config.options.realtimeModel && <button onClick={() => setVoice(true)}>Voice</button>}<span>{threadId ? 'Obrolan tersimpan di server' : 'Chat baru'}</span></footer>{activity && threadId && <SdkActivity connection={connection} threadId={threadId} onClose={() => setActivity(false)}/>} {voice && <SdkVoice connection={connection} onClose={() => setVoice(false)}/>}</> : <form className="sg-setup" onSubmit={event => { event.preventDefault(); void start(); }}>
      <div className="sg-intro"><img src="/supergpt-logo.png" alt=""/><h1>SuperGPT by Sakelar</h1><p>Chat dengan tool, dokumen, dan agen spesialis.</p></div>
      <section><h2>Koneksi</h2><label>Custom Endpoint<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Pilih endpoint</option>{store.profiles.map(profile => <option value={profile.id} key={profile.id}>{profile.name} · {profile.model}</option>)}</select></label><label>Server SuperGPT<input type="url" placeholder="Server lokal preview ini" value={config.server} onChange={event => setConfig({ ...config, server: event.target.value })}/></label><p>Preview browser memakai server lokal. Untuk APK, gunakan server HTTPS milikmu.</p><label>Domain key ChatKit<input autoComplete="off" value={config.domainKey} onChange={event => setConfig({ ...config, domainKey: event.target.value })}/></label><label>Token akses server (jika memakai server terpisah)<input type="password" autoComplete="off" value={serverToken} onChange={event => setServerToken(event.target.value)}/></label><label>API model<select value={config.options.api} onChange={event => changeOptions({ api: event.target.value as 'chat' | 'responses' })}><option value="chat">Chat Completions compatible</option><option value="responses">Responses API</option></select></label></section>
      <section><h2>Kemampuan endpoint</h2><p>Aktifkan fitur yang didukung penyediamu. Tools memerlukan model dengan function calling.</p>{toggle('tools', 'Tools, checklist, dan agen spesialis')}{toggle('vision', 'Gambar / vision')}{toggle('mcp', 'MCP dari konfigurasi server')}{toggle('pdf', 'Dokumen PDF', config.options.api !== 'responses')}{toggle('web', 'Web search', config.options.api !== 'responses')}{toggle('code', 'Code Interpreter', config.options.api !== 'responses')}{toggle('images', 'Image generation', config.options.api !== 'responses')}{config.options.api === 'responses' && <label>Vector Store IDs<input placeholder="vs_… (pisahkan dengan koma)" value={config.options.vectorStores.join(',')} onChange={event => changeOptions({ vectorStores: event.target.value.split(',').map(value => value.trim()) })}/></label>}<label>Model transkripsi (opsional)<input placeholder="ID model audio/transcriptions" value={config.options.transcriptionModel} onChange={event => changeOptions({ transcriptionModel: event.target.value })}/></label><label>Model Realtime (opsional)<input placeholder="ID model realtime" value={config.options.realtimeModel} onChange={event => changeOptions({ realtimeModel: event.target.value })}/></label></section>
      <p className="sg-privacy">Riwayat baru dan unggahan disimpan di server pilihanmu. Antarmuka ChatKit dimuat dari CDN OpenAI. API key diteruskan hanya ke server SDK dan endpoint pilihanmu; tracing OpenAI dimatikan.</p><button className="sg-primary" disabled={busy || !endpoint}>{busy ? 'Menghubungkan…' : 'Buka ChatKit'}</button>
    </form>}
  </main>;
}
