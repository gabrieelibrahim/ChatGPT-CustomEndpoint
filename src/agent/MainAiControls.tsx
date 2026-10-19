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
    <details><summary>Server pemrosesan AI</summary><label>URL server SuperGPT<input type="url" placeholder="Kosong untuk server preview ini" value={config.server} onChange={event => setConfig({ ...config, server: event.target.value })}/></label><label>Token akses server<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)}/></label><p>APK memerlukan server SuperGPT HTTPS. Riwayat tetap di perangkat; pesan dan API key dikirim ke server pilihanmu untuk menjalankan SDK. Token akses ini hanya disimpan selama sesi tab.</p></details>
    <p role="status">{mainAgentAvailable(config) ? 'Tools tersedia melalui server yang dipilih; koneksi diuji saat mengirim pesan.' : config.enabled ? 'Server AI belum diatur. Chat biasa tetap dapat digunakan; web dan MCP membutuhkan server AI.' : 'Tools dimatikan. Pesan dikirim langsung ke endpoint.'}</p>
    <button type="submit">Simpan fitur AI</button>
  </form>;
}
