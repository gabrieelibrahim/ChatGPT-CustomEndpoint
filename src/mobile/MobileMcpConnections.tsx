import { useEffect, useRef, useState } from 'react';
import type { McpProfile, useClientData } from '../desktop/ClientCollections';
import { UIIcon as Icon } from '../components/UIIcon';
import { connectMcp, mcpToken, mcpUrl, type McpConnection } from '../mcp/httpClient';
import { mcpTemplates } from '../mcp/catalog';
import { loadMainAi, saveMainAi } from '../agent/settings';
import { loadSettings, saveSettings } from '../lib/clientSettings';
import './mcp-connections.css';

export function MobileMcpConnections({ store, onClose, onNotice, backLabel }: { store: ReturnType<typeof useClientData>; onClose: () => void; onNotice: (text: string) => void; backLabel: string }) {
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState(''), [url, setUrl] = useState(''), [token, setToken] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function edit(profile?: McpProfile) { setEditing(profile?.id || 'new'); setName(profile?.name || ''); setUrl(profile?.url || ''); setToken(profile ? mcpToken(profile.id) : ''); setError(''); }
  async function connect(value: { id?: string; name: string; url: string }, secret = '') {
    if (busy) return;
    const id = value.id || crypto.randomUUID(); setBusy(id); setError(''); const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(Error('Pemeriksaan koneksi melewati 30 detik.')), 30000);
    let connection: McpConnection | undefined;
    try {
      if (store.data.mcp.filter(item => item.enabled && item.id !== id).length >= 8) throw Error('Maksimal 8 koneksi aktif. Nonaktifkan salah satu terlebih dahulu.');
      if (!value.name.trim()) throw Error('Isi nama koneksi.');
      const target = mcpUrl(value.url); connection = await connectMcp({ url: target, token: secret }, controller.signal);
      controller.signal.throwIfAborted();
      mcpToken(id, secret);
      store.setData(previous => ({ ...previous, mcp: [...previous.mcp.filter(item => item.id !== id), { id, name: value.name.trim().slice(0, 80), kind: 'http', url: target, command: '', args: [], enabled: true, checkedAt: Date.now(), toolNames: connection!.tools.map(tool => tool.name) }] }));
      saveMainAi({ ...loadMainAi(), enabled: true, mcp: true }); saveSettings({ ...loadSettings(), pluginsEnabled: true });
      setEditing(null); setToken(''); onNotice('Terhubung · ' + connection.tools.length + ' tool tersedia untuk chat berikutnya.');
    } catch (failure) { if (!controller.signal.aborted || request.current === controller) setError(failure instanceof Error ? failure.message : 'MCP belum dapat dihubungkan.'); }
    finally { clearTimeout(timer); await connection?.close(); if (request.current === controller) { request.current = null; setBusy(''); } }
  }
  return <div className="m-library-screen m-mcp-screen"><header className="m-page-header"><button className="m-page-back" aria-label={editing ? 'Kembali ke koneksi' : backLabel} onClick={() => { request.current?.abort(); if (editing) { setEditing(null); setError(''); } else onClose(); }}><Icon name="arrow"/></button><h1>{editing ? 'Koneksi MCP' : 'Plugin & MCP'}</h1><button className="m-page-add" aria-label="Tambah MCP sendiri" onClick={() => edit()}><Icon name="plus"/></button></header>
    <div className="m-library-body m-mcp-body">
      <p className="m-setting-caption">Hubungkan layanan untuk dipakai model di chat utama. Mendukung MCP Streamable HTTP; model endpoint perlu mendukung function calling.</p>
      {error && <p role="alert" className="m-mcp-error">{error}</p>}
      {editing ? <form className="m-library-editor" onSubmit={event => { event.preventDefault(); void connect({ id: editing === 'new' ? undefined : editing, name, url }, token); }}>
        <label>Nama<input required maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label>
        <label>URL MCP<input required type="url" placeholder="https://server.example/mcp" value={url} onChange={event => setUrl(event.target.value)}/></label>
        <label>Bearer token (opsional)<input type="password" autoComplete="off" maxLength={4096} value={token} onChange={event => setToken(event.target.value)}/></label>
        <p className="m-setting-caption">Token tersimpan selama sesi aplikasi. Layanan dengan OAuth memerlukan alur login dari penyedia; menempel URL saja belum memberikan izin akun.</p>
        <button className="m-primary" disabled={!!busy}>{busy ? 'Memeriksa…' : 'Uji & sambungkan'}</button>
        {busy && <button type="button" onClick={() => request.current?.abort()}>Batalkan</button>}
      </form> : <>
        {!!store.data.mcp.length && <><h2>Koneksi Anda</h2>{store.data.mcp.map(profile => <section className="m-mcp-card" key={profile.id}><h3><Icon name="plugin" size={22}/>{profile.name}</h3><p>{profile.url || 'Stdio · runtime desktop'}</p><small>{profile.enabled ? 'Aktif' : 'Nonaktif'}{profile.checkedAt ? ' · Diperiksa ' + new Date(profile.checkedAt).toLocaleString('id-ID') : ' · Belum diuji'}</small>{profile.toolNames && <details><summary>{profile.toolNames.length} tool</summary><ul>{profile.toolNames.map(tool => <li key={tool}>{tool}</li>)}</ul></details>}<div className="m-mcp-actions">{profile.kind === 'http' && <><button disabled={!!busy} onClick={() => void connect(profile, mcpToken(profile.id))}>{busy === profile.id ? 'Memeriksa…' : 'Uji ulang'}</button><button disabled={!!busy} onClick={() => edit(profile)}>Atur</button><button disabled={!!busy} onClick={() => { if (!profile.enabled) void connect(profile, mcpToken(profile.id)); else store.setData(previous => ({ ...previous, mcp: previous.mcp.map(item => item.id === profile.id ? { ...item, enabled: false } : item) })); }}>{profile.enabled ? 'Nonaktifkan' : 'Sambungkan'}</button></>}<button disabled={!!busy} onClick={() => { mcpToken(profile.id, ''); store.setData(previous => ({ ...previous, mcp: previous.mcp.filter(item => item.id !== profile.id) })); }}>Hapus</button></div></section>)}</>}
        <h2>Template koneksi</h2><p className="m-setting-caption">Layanan publik berikut dapat diperiksa tanpa token. Ketersediaan dan kuota mengikuti penyedia.</p>
        {mcpTemplates.map(template => { const existing = store.data.mcp.find(item => item.url === template.url); return <section className="m-mcp-card" key={template.id}><h3><Icon name="plugin" size={22}/>{template.name}</h3><p>{template.description}</p><button disabled={!!busy || existing?.enabled} onClick={() => void connect({ ...template, id: existing?.id })}>{existing?.enabled ? 'Sudah ditambahkan' : busy === (existing?.id || template.id) ? 'Memeriksa…' : 'Sambungkan'}</button></section>; })}
        <button className="m-mcp-custom" disabled={!!busy} onClick={() => edit()}><Icon name="plus" size={20}/> Tambah server sendiri</button>
        {busy && <p role="status">Memeriksa koneksi dan daftar tool… <button onClick={() => request.current?.abort()}>Batalkan</button></p>}
      </>}
    </div>
  </div>;
}
