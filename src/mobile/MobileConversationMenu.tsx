import { useEffect, useRef, useState } from 'react';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';
import { MobileControlIcon } from './MobileControlIcon';
import { loadMobileProjects } from './searchData';
import { MobileAttachment } from './MobileAttachment';
import type { FileRef } from '../lib/fileLibrary';
import type { MobileMessage } from '../lib/useMobileConversation';
import { shareMobileResponse } from './MobileResponseActions';

type Props = { title: string; messages: MobileMessage[]; pinned: boolean; temporary: boolean; busy: boolean; onClose(): void; onPin(): void; onSearch(): void; onHome(): void; onArchive(): void; onRemove(): string | undefined; onNotice(message: string): void };
export function MobileConversationMenu(p: Props) {
  const [page, setPage] = useState<'menu' | 'projects' | 'files' | 'delete'>('menu'), [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null);
  const files = [...new Map(p.messages.flatMap(m => m.attachments || []).map(f => [f.id, f])).values()] as FileRef[];
  useEffect(() => { panel.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true }); }, [page]);
  return <div className="m-overlay m-conversation-overlay" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); p.onClose(); }
    if (page === 'menu' && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || [])]; const current = items.indexOf(document.activeElement as HTMLElement); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus(); }
  }}><button className="m-backdrop" aria-label="Tutup menu chat" onClick={p.onClose}/>
    <section ref={panel} className={`m-conversation-menu${page !== 'menu' ? ' m-conversation-detail' : ''}`} role={page === 'menu' ? 'menu' : 'dialog'} aria-modal="true" aria-label={page === 'menu' ? 'Opsi percakapan' : page === 'files' ? 'File yang diunggah' : page === 'projects' ? 'Tambahkan ke proyek' : 'Hapus percakapan?'}>
      {page === 'menu' ? <><p className="m-conversation-title">{p.title || 'Obrolan sementara'}</p>
        <button role="menuitem" onClick={() => { void shareMobileResponse(p.messages.map(m => `${m.role === 'user' ? 'Kamu' : 'SuperGPT'}:\n${m.text}`).join('\n\n'), p.onNotice); p.onClose(); }}><MobileControlIcon name="share-android"/>Bagikan</button>
        <button role="menuitem" disabled={p.temporary} onClick={p.onPin}><Icon name="pin"/>{p.pinned ? 'Lepas sematan' : 'Sematkan'}</button>
        <button role="menuitem" disabled={p.temporary} onClick={() => setPage('projects')}><Icon name="folder-plus"/>Tambahkan ke proyek<Icon name="chevron-right" size={18}/></button>
        <button role="menuitem" onClick={() => setPage('files')}><MobileControlIcon name="paperclip"/>File yang diunggah</button>
        <button role="menuitem" onClick={p.onSearch}><Icon name="search"/>Cari di chat</button>
        <button role="menuitem" disabled={p.temporary} onClick={p.onHome}><Icon name="home"/>Tambahkan ke beranda</button>
        <button role="menuitem" disabled={p.temporary} onClick={p.onArchive}><Icon name="archive"/>Arsipkan</button>
        <button role="menuitem" disabled={p.busy} className="m-conversation-danger" onClick={() => setPage('delete')}><Icon name="trash"/>Hapus</button>
      </> : <><header><button aria-label="Kembali ke opsi percakapan" onClick={() => setPage('menu')}><Icon name="arrow"/></button><h2>{page === 'files' ? 'File yang diunggah' : page === 'projects' ? 'Tambahkan ke proyek' : 'Hapus percakapan?'}</h2><button aria-label="Tutup menu chat" onClick={p.onClose}><Icon name="close"/></button></header>
      {page === 'files' ? <div className="m-conversation-files">{files.map(file => <MobileAttachment key={file.id} file={file}/>)}{!files.length && <p>Belum ada file di percakapan ini.</p>}</div> : page === 'projects' ? <>{loadMobileProjects().map(project => <button key={project.id} onClick={() => { try { const projects = loadMobileProjects().map(value => value.id === project.id ? { ...value, chats: [...new Set([...value.chats, p.title])] } : value); localStorage.setItem('client-mobile-projects-v1', JSON.stringify(projects)); p.onNotice('Ditambahkan ke ' + project.name); p.onClose(); } catch { setError('Proyek belum tersimpan.'); } }}><Icon name="folder"/>{project.name}{project.chats.includes(p.title) && <Icon name="check"/>}</button>)}{!loadMobileProjects().length && <p>Buat proyek melalui menu Proyek terlebih dahulu.</p>}</> : <><p>Hapus riwayat lokal percakapan ini dari perangkat?</p><footer><button onClick={p.onClose}>Batal</button><button className="m-conversation-danger" onClick={() => { const failure = p.onRemove(); if (failure) setError(failure); else p.onClose(); }}>Hapus</button></footer></>}{error && <p role="alert">{error}</p>}</>}
    </section>
  </div>;
}
