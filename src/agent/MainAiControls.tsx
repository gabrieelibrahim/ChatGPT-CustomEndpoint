import { useState } from 'react';
import { ClientSwitch } from '../components/SDKPrimitives';
import { loadMainAi, saveMainAi, mainAgentAvailable, mainServerToken } from './settings';
import './main-settings.css';

export function MainAiControls({ onNotice }: { onNotice: (text: string) => void }) {
  const [config, setConfig] = useState(loadMainAi), [token, setToken] = useState(mainServerToken);
  return <form className="ai-settings" onSubmit={event => { event.preventDefault(); try { saveMainAi(config); mainServerToken(token); onNotice('Fitur AI tersimpan untuk pesan berikutnya.'); } catch (error) { onNotice(error instanceof Error ? error.message : 'Pengaturan belum tersimpan.'); } }}>
    <label className="ai-setting-toggle"><span>Tools di chat utama</span><ClientSwitch label="Tools di chat utama" value={config.enabled} change={enabled => setConfig({ ...config, enabled })}/></label>
    <label className="ai-setting-toggle"><span>Pencarian web</span><ClientSwitch label="Pencarian web" value={config.web} change={web => setConfig({ ...config, web })}/></label>
    <label>Layanan pencarian<select value={config.webSearch} onChange={event => setConfig({ ...config, webSearch: event.target.value as 'exa' | 'provider' })}><option value="exa">Exa melalui MCP</option><option value="provider">Web search bawaan provider (Responses)</option></select></label>
    <p>Model memilih kapan mencari. Exa menerima kueri publik ketika pencarian dijalankan. Jawaban menyertakan tautan sumber dari hasil pencarian.</p>
    <label className="ai-setting-toggle"><span>Server MCP dari menu Plugin</span><ClientSwitch label="Server MCP dari menu Plugin" value={config.mcp} change={mcp => setConfig({ ...config, mcp })}/></label>
    <p>Panggilan ke plugin meminta persetujuan di dalam jawaban. Aktifkan juga izin Plugin di pengaturan umum.</p>
    <label>API endpoint model<select value={config.api} onChange={event => setConfig({ ...config, api: event.target.value as 'chat' | 'responses' })}><option value="chat">Chat Completions</option><option value="responses">Responses API</option></select></label>
    <p>Endpoint, API key, dan model memakai pilihan Custom Endpoint. Model perlu mendukung function calling.</p>
    <label>Pemrosesan tools<select value={config.runtime} onChange={event => setConfig({ ...config, runtime: event.target.value as typeof config.runtime })}><option value="auto">Otomatis</option><option value="device">Langsung di perangkat</option><option value="server">Server SDK</option></select></label>
    <p>Mode langsung menghubungkan model Custom Endpoint dengan MCP dan pencarian Exa. Responses dan fitur provider khusus memakai server SDK. Browser web memerlukan izin CORS dari layanan; APK memakai transport native.</p>
    <details><summary>Server pemrosesan AI</summary><label>URL server SuperGPT<input type="url" placeholder="Kosong untuk server preview ini" value={config.server} onChange={event => setConfig({ ...config, server: event.target.value })}/></label><label>Token akses server<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)}/></label><p>Server SDK bersifat opsional untuk MCP langsung. Jika diisi, pesan dan API key dikirim ke server pilihanmu untuk menjalankan SDK. Token akses ini hanya disimpan selama sesi tab.</p></details>
    <p role="status">{mainAgentAvailable(config) ? 'Tools tersedia melalui server yang dipilih; koneksi diuji saat mengirim pesan.' : config.enabled ? config.runtime === 'server' ? 'Isi URL server SDK untuk memakai mode server.' : 'Tools berjalan langsung di perangkat; koneksi dan dukungan model diperiksa saat mengirim pesan.' : 'Tools dimatikan. Pesan dikirim langsung ke endpoint.'}</p>
    <button type="submit">Simpan fitur AI</button>
  </form>;
}
