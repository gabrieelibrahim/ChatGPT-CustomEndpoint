import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { McpProfile, useClientData } from '../desktop/ClientCollections';
import type { MobileDestination } from './MobileSidebar';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';
import { connectMcp, mcpToken, mcpUrl, type McpConnection } from '../mcp/httpClient';
import { builtinPlugins, filterPlugins, pluginCatalog, pluginCategories, type PluginTemplate } from '../mcp/catalog';
import { loadMainAi, saveMainAi } from '../agent/settings';
import { loadSettings, saveSettings } from '../lib/clientSettings';
import { MobilePageTransition } from './MobilePageTransition';
import { MobilePluginSkeleton } from './MobilePluginSkeleton';
import { PluginIcon } from './PluginIcon';
import './mcp-connections.css';
const PluginDetail = lazy(() => import('./MobilePluginDetail'));
type View = { kind: 'catalog' | 'installed' | 'category' | 'detail' | 'connection'; plugin?: PluginTemplate; profileId?: string; category?: string };
const identity = (view: View) => [view.kind, view.category, view.plugin?.id, view.profileId].filter(Boolean).join('/');
const sameUrl = (a?: string, b?: string) => !!a && !!b && a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
export function profilePlugin(profile: McpProfile): PluginTemplate {
  return pluginCatalog.find(item => item.id === profile.catalogId || sameUrl(item.url, profile.url)) || { id: 'custom-' + profile.id, name: profile.name, description: 'Koneksi MCP sendiri', categories: [], auth: 'custom', url: profile.url };
}

export function MobileMcpConnections({ store, onClose, onNotice, backLabel, onDraft, onLibrary }: { store: ReturnType<typeof useClientData>; onClose: () => void; onNotice: (text: string) => void; backLabel: string; onDraft?: (text: string) => void; onLibrary?: (page: MobileDestination) => void }) {
  const [path, setPath] = useState<View[]>([{ kind: backLabel === 'Back to Settings' ? 'installed' : 'catalog' }]), [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [query, setQuery] = useState(''), [menu, setMenu] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [name, setName] = useState(''), [url, setUrl] = useState(''), [token, setToken] = useState(''), [pendingPrompt, setPendingPrompt] = useState('');
  const [ai, setAi] = useState(loadMainAi);
  const request = useRef<AbortController | null>(null), mounted = useRef(true), scroll = useRef<HTMLDivElement>(null), offsets = useRef(new Map<string, number>());
  const view = path[path.length - 1], pageId = identity(view);
  const selectedProfile = store.data.mcp.find(item => item.id === view.profileId || !!view.plugin && (item.catalogId === view.plugin.id || sameUrl(item.url, view.plugin.url)));
  const installedBuiltins = builtinPlugins.filter(item => item.id !== 'browser' || ai.enabled && ai.web);
  const installed = [...installedBuiltins.map(plugin => ({ plugin, profile: undefined as McpProfile | undefined })), ...store.data.mcp.map(profile => ({ plugin: profilePlugin(profile), profile }))];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = offsets.current.get(pageId) || 0; }, [pageId]);
  function remember() { if (scroll.current) offsets.current.set(pageId, scroll.current.scrollTop); }
  function push(next: View) { if (busy) return; remember(); setDirection('forward'); setError(''); setMenu(false); setPath(previous => [...previous, next]); }
  function back() {
    if (menu) { setMenu(false); return; }
    request.current?.abort(Error('Pemeriksaan dibatalkan.')); remember(); setError(''); setToken(''); setPendingPrompt(''); setDirection('back');
    if (path.length > 1) setPath(previous => previous.slice(0, -1)); else onClose();
  }
  const backRef = useRef(back); backRef.current = back;
  useEffect(() => {
    const handler = (event: Event) => { if (path.length > 1 || menu || busy) { event.preventDefault(); backRef.current(); } };
    window.addEventListener('client-settings-back', handler);
    return () => window.removeEventListener('client-settings-back', handler);
  }, [path.length, menu, busy]);
  function configure(plugin?: PluginTemplate, profile?: McpProfile, prompt = '') {
    if (busy) return;
    setName(profile?.name || plugin?.name || ''); setUrl(profile?.url || plugin?.url || ''); setToken(profile ? mcpToken(profile.id) : ''); setPendingPrompt(prompt);
    push({ kind: 'connection', plugin, profileId: profile?.id });
  }
  async function connect() {
    if (request.current) return;
    const id = selectedProfile?.id || crypto.randomUUID(), controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    const timer = setTimeout(() => controller.abort(Error('Pemeriksaan koneksi melewati 30 detik.')), 30000);
    let connection: McpConnection | undefined;
    try {
      if (store.data.mcp.filter(item => item.enabled && item.id !== id).length >= 8) throw Error('Maksimal 8 koneksi aktif. Nonaktifkan salah satu terlebih dahulu.');
      if (!name.trim()) throw Error('Isi nama koneksi.');
      const target = mcpUrl(url); connection = await connectMcp({ url: target, token }, controller.signal); controller.signal.throwIfAborted();
      mcpToken(id, token);
      const catalogId = view.plugin && pluginCatalog.some(item => item.id === view.plugin?.id) ? view.plugin.id : undefined;
      const verified: McpProfile = { id, name: name.trim().slice(0, 80), kind: 'http', url: target, command: '', args: [], enabled: true, checkedAt: Date.now(), toolNames: connection.tools.map(tool => tool.name), catalogId };
      // Preferences/credentials must be available before advertising the connection as active.
      const nextAi = { ...loadMainAi(), enabled: true, mcp: true }; saveMainAi(nextAi); saveSettings({ ...loadSettings(), pluginsEnabled: true }); setAi(nextAi);
      store.setData(previous => ({ ...previous, mcp: [...previous.mcp.filter(item => item.id !== id), verified] }));
      setToken(''); setError(''); setDirection('back');
      setPath(previous => previous.length > 1 ? previous.slice(0, -1) : [{ kind: 'installed' }]);
      onNotice('Terhubung · ' + connection.tools.length + ' tool tersedia untuk chat berikutnya.');
      if (pendingPrompt) { setPendingPrompt(''); onDraft?.('@' + name.trim() + ' ' + pendingPrompt); }
    } catch (failure) { if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'MCP belum dapat dihubungkan.'); else if (mounted.current && controller.signal.reason instanceof Error && controller.signal.reason.message.includes('30 detik')) setError(controller.signal.reason.message); }
    finally { clearTimeout(timer); await connection?.close(); if (request.current === controller) { request.current = null; if (mounted.current) setBusy(false); } }
  }
  function existing(plugin: PluginTemplate) { return store.data.mcp.find(profile => profile.catalogId === plugin.id || sameUrl(profile.url, plugin.url)); }
  function details(plugin: PluginTemplate, profile?: McpProfile) { push({ kind: 'detail', plugin, profileId: profile?.id }); }
  function builtin(plugin: PluginTemplate) {
    if (plugin.id === 'pages') onLibrary?.('spaces');
    else if (plugin.id === 'plugin-management') push({ kind: 'catalog' });
    else if (plugin.id === 'browser') { const next = { ...loadMainAi(), enabled: true, web: true }; saveMainAi(next); setAi(next); onDraft?.(plugin.examples?.[0] || 'Cari informasi di web.'); }
    else onDraft?.(plugin.examples?.[0] || 'Bantu saya memulai tugas baru.');
  }
  function example(plugin: PluginTemplate, text: string) {
    if (plugin.auth === 'builtin') { if (plugin.id === 'browser') { const next = { ...loadMainAi(), enabled: true, web: true }; saveMainAi(next); setAi(next); } onDraft?.(text); }
    else { const profile = existing(plugin); if (profile?.enabled) onDraft?.('@' + profile.name + ' ' + text); else configure(plugin, profile, text); }
  }
  function row(plugin: PluginTemplate) {
    const profile = existing(plugin);
    return <div className="m-plugin-catalog-row" key={plugin.id}><button className="m-plugin-row-open" onClick={() => details(plugin, profile)}><PluginIcon {...plugin}/><span><strong>{plugin.name}</strong><small>{plugin.description}</small></span></button><button className="m-plugin-row-add" aria-label={(profile ? 'Atur ' : 'Tambahkan ') + plugin.name} onClick={() => profile ? details(plugin, profile) : configure(plugin)}><Icon name={profile ? 'dots' : 'plus'} size={22}/></button></div>;
  }
  const title = view.kind === 'detail' ? view.plugin!.name : view.kind === 'connection' ? 'Koneksi plugin' : view.kind === 'category' ? view.category! : 'Plugin';
  async function share() {
    const plugin = view.plugin; if (!plugin) return;
    // Share public catalog information, never a private MCP URL or token.
    const text = plugin.name + ': ' + plugin.description + (plugin.docs || plugin.website ? '\n' + (plugin.docs || plugin.website) : '');
    try { if (navigator.share) await navigator.share({ title: plugin.name, text }); else { await navigator.clipboard.writeText(text); onNotice('Informasi plugin disalin.'); } } catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) onNotice('Informasi plugin belum dapat dibagikan.'); }
  }
  return <MobilePageTransition identity={'plugins/' + pageId} active directionHint={direction}><div className={'m-library-screen m-mcp-screen m-plugin-view-' + view.kind} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); } }}>
    <header className="m-page-header m-plugin-header"><button className="m-page-back" aria-label={path.length > 1 ? 'Kembali ke plugin' : backLabel} onClick={back}><Icon name="arrow"/></button>
      {view.kind === 'catalog' || view.kind === 'category' ? <button className="m-plugin-heading-menu" aria-label="Pilih halaman plugin" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><h1>{title}</h1><Icon name="down" size={15}/></button> : <h1>{title}</h1>}
      {view.kind === 'detail' ? <button className="m-page-add" aria-label="Bagikan informasi plugin" onClick={() => void share()}><Icon name="share"/></button> : <span/>}
    </header>
    {menu && <><button className="m-plugin-menu-dismiss" aria-label="Tutup pilihan halaman" onClick={() => setMenu(false)}/><div className="m-plugin-page-menu" role="menu"><button role="menuitem" onClick={() => push({ kind: 'catalog' })}>Semua plugin</button><button role="menuitem" onClick={() => push({ kind: 'installed' })}>Ditambahkan</button><button role="menuitem" onClick={() => configure()}>Server MCP sendiri</button></div></>}
    <div className="m-plugin-body" ref={element => { if (element) scroll.current = element; }} key={pageId}>
      {view.kind === 'installed' ? <><h2 className="m-plugin-installed-label">Ditambahkan</h2><section className="m-plugin-installed-card">{installed.map(({ plugin, profile }) => <button key={profile?.id || plugin.id} onClick={() => details(plugin, profile)}><PluginIcon {...plugin}/><span>{profile?.name || plugin.name}</span>{profile && !profile.enabled && <small>Nonaktif</small>}</button>)}</section><button className="m-plugin-explore" onClick={() => push({ kind: 'catalog' })}><Icon name="settings-plugins" size={24}/><span>Jelajahi plugin</span></button><button className="m-plugin-own-link" onClick={() => configure()}>Tambahkan MCP sendiri</button></>
      : view.kind === 'catalog' || view.kind === 'category' ? <>
        {!query && view.kind === 'catalog' && <section className="m-plugin-installed-strip"><button className="m-plugin-section-title" onClick={() => push({ kind: 'installed' })}>Sudah Terinstal<Icon name="chevron-right" size={15}/></button><div>{installed.slice(0, installed.length > 6 ? 5 : 6).map(({ plugin, profile }) => <button aria-label={'Buka ' + (profile?.name || plugin.name)} key={profile?.id || plugin.id} onClick={() => details(plugin, profile)}><PluginIcon {...plugin}/></button>)}{installed.length > 6 && <button className="m-plugin-overflow-count" aria-label={'Lihat semua ' + installed.length + ' plugin yang ditambahkan'} onClick={() => push({ kind: 'installed' })}>+{installed.length - 5}</button>}</div></section>}
        {query || view.kind === 'category' ? <section className="m-plugin-category"><h2>{query ? 'Hasil pencarian' : view.category}</h2>{filterPlugins(query, view.category).map(row)}{!filterPlugins(query, view.category).length && <p className="m-plugin-empty">Tidak ada plugin yang cocok.</p>}</section>
        : pluginCategories.map(category => <section className="m-plugin-category" key={category}><button className="m-plugin-section-title" onClick={() => push({ kind: 'category', category })}>{category}<Icon name="chevron-right" size={15}/></button>{filterPlugins('', category).slice(0, 4).map(row)}</section>)}
        <button className="m-plugin-own-link" onClick={() => configure()}>Tambahkan MCP sendiri</button>
      </>
      : view.kind === 'detail' && view.plugin ? <Suspense fallback={<MobilePluginSkeleton/>}><PluginDetail plugin={view.plugin} profile={selectedProfile} onExample={text => example(view.plugin!, text)} onOpen={() => view.plugin!.auth === 'builtin' ? builtin(view.plugin!) : configure(view.plugin, selectedProfile)}/></Suspense>
      : <form className="m-plugin-connect-form" onSubmit={event => { event.preventDefault(); void connect(); }}>
        {view.plugin && <div className="m-plugin-connect-title"><PluginIcon {...view.plugin}/><h2>{view.plugin.name}</h2></div>}
        {view.plugin?.auth === 'oauth' ? <p>Layanan ini meminta OAuth. Login otomatis belum tersedia. Kamu bisa memakai gateway MCP milikmu yang sudah mengelola login, atau membaca petunjuk resmi di bawah.</p> : <p>{view.plugin?.auth === 'public' ? 'Server publik sudah diisi. Kami akan memeriksa koneksi dan tools sebelum menambahkannya.' : view.plugin?.auth === 'token' ? 'Masukkan bearer token untuk server resmi ini. Token hanya dikirim ke URL yang tertera.' : 'Masukkan URL server MCP untuk layanan ini. Entri katalog belum berarti layanan sudah tersambung.'}</p>}
        {view.plugin?.docs && <a href={view.plugin.docs} target="_blank" rel="noreferrer">Petunjuk koneksi resmi <Icon name="window" size={16}/></a>}
        <label>Nama<input required maxLength={80} disabled={busy} value={name} onChange={event => setName(event.target.value)}/></label>
        <label>URL server MCP<input required type="url" disabled={busy} placeholder="https://server.example/mcp" value={url} onChange={event => setUrl(event.target.value)}/></label>
        <label>Bearer token (opsional)<input type="password" disabled={busy} autoComplete="off" maxLength={4096} value={token} onChange={event => setToken(event.target.value)}/></label>
        <p className="m-plugin-form-caption">Token disimpan selama sesi aplikasi. Setelah terhubung, model Custom Endpoint dapat memakai tools dengan persetujuanmu. Mendukung MCP Streamable HTTP.</p>
        {error && <p role="alert" className="m-plugin-error">{error}</p>}
        {busy && <div role="status" className="m-plugin-connecting"><span/>Memeriksa koneksi dan daftar tool…</div>}
        <button className="m-plugin-primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Uji & sambungkan'}</button>
        {busy && <button type="button" onClick={() => request.current?.abort()}>Batalkan pemeriksaan</button>}
        {selectedProfile && <div className="m-plugin-connection-actions"><button type="button" disabled={busy} onClick={() => store.setData(previous => ({ ...previous, mcp: previous.mcp.map(item => item.id === selectedProfile.id ? { ...item, enabled: false } : item) }))}>Nonaktifkan</button><button type="button" disabled={busy} onClick={() => { mcpToken(selectedProfile.id, ''); store.setData(previous => ({ ...previous, mcp: previous.mcp.filter(item => item.id !== selectedProfile.id) })); setDirection('back'); setPath([{ kind: 'installed' }]); }}>Hapus koneksi</button></div>}
      </form>}
    </div>
    {(view.kind === 'catalog' || view.kind === 'category') && <footer className="m-plugin-search-footer"><label><Icon name="search" size={22}/><input aria-label="Cari plugin" placeholder="Cari plugin" value={query} onChange={event => { setQuery(event.target.value); if (scroll.current) scroll.current.scrollTop = 0; }}/>{query && <button aria-label="Hapus pencarian plugin" onClick={() => setQuery('')}><Icon name="close" size={18}/></button>}</label></footer>}
    {view.kind === 'detail' && view.plugin && <footer className="m-plugin-install-footer"><button onClick={() => view.plugin!.auth === 'builtin' ? builtin(view.plugin!) : configure(view.plugin, selectedProfile)}>{view.plugin.auth === 'builtin' ? view.plugin.id === 'pages' ? 'Buka Pages' : view.plugin.id === 'plugin-management' ? 'Jelajahi plugin' : 'Gunakan di chat' : selectedProfile ? 'Atur koneksi' : 'Instal plugin'}</button></footer>}
  </div></MobilePageTransition>;
}
