import { useEffect, useRef, useState, type RefObject } from 'react';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';
import { loadMobileProjects } from './searchData';
import './session-menu.css';

export type SessionMenuTarget = { title: string; x: number; y: number; trigger: HTMLButtonElement };
type Props = { target: SessionMenuTarget; pinned: boolean; container: RefObject<HTMLDivElement | null>; onClose: () => void; onPin: () => void; onRename: (name: string) => string | undefined; onArchive: () => void; onRemove: () => string | undefined; onNotice: (message: string) => void };
export function MobileSessionMenu({ target, pinned, container, onClose, onPin, onRename, onArchive, onRemove, onNotice }: Props) {
  const [page, setPage] = useState<'menu' | 'rename' | 'projects' | 'delete'>('menu');
  const [name, setName] = useState(target.title), [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const rect = container.current?.getBoundingClientRect();
  const width = rect?.width || window.innerWidth, height = rect?.height || window.innerHeight;
  const menuWidth = Math.min(294, width - 24), menuHeight = 261;
  const left = Math.max(12, Math.min(target.x - (rect?.left || 0), width - menuWidth - 12));
  const top = Math.max(12, Math.min(target.y - (rect?.top || 0), height - menuHeight - 12));
  useEffect(() => {
    window.getSelection()?.removeAllRanges();
    if (page === 'rename') { input.current?.focus({ preventScroll: true }); input.current?.select(); }
    else panel.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [page]);
  useEffect(() => () => { requestAnimationFrame(() => {
    // Pinning/renaming can replace the original row while the menu disappears.
    const restore = target.trigger.isConnected ? target.trigger : container.current?.querySelector<HTMLButtonElement>('.m-sidebar-search');
    restore?.focus({ preventScroll: true });
  }); }, [target, container]);
  const close = () => { onClose(); };
  return <div className="m-session-layer" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input') || [])];
    if (event.key === 'Tab' || (page === 'menu' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))) {
      event.preventDefault(); const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + ((event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) ? -1 : 1) + controls.length) % controls.length;
      controls[next]?.focus();
    }
  }}>
    <button className="m-session-dismiss" aria-label="Tutup menu percakapan" onClick={close}/>
    <div ref={panel} className={`m-session-menu${page !== 'menu' ? ' m-session-dialog' : ''}`} role={page === 'menu' ? 'menu' : 'dialog'} aria-modal={page === 'menu' ? undefined : true} aria-label={page === 'menu' ? 'Menu percakapan' : page === 'rename' ? 'Ganti nama' : page === 'delete' ? 'Hapus percakapan?' : 'Tambahkan ke proyek'} style={page === 'menu' ? { width: menuWidth, left, top } : undefined}>
      {page === 'menu' ? <>
        <button role="menuitem" onClick={() => { onPin(); close(); }}><Icon name="pin"/>{pinned ? 'Lepas sematan' : 'Sematkan'}</button>
        <button role="menuitem" onClick={() => setPage('rename')}><Icon name="edit"/>Ganti nama</button>
        <button role="menuitem" onClick={() => setPage('projects')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10V7a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M2 9h18M18 14v8M14 18h8" strokeLinecap="round" strokeLinejoin="round"/></svg>Tambahkan ke proyek<Icon name="chevron"/></button>
        <button role="menuitem" onClick={() => { onArchive(); close(); }}><Icon name="archive"/>Arsipkan</button>
        <button role="menuitem" className="m-session-danger" onClick={() => setPage('delete')}><Icon name="trash"/>Hapus</button>
      </> : page === 'rename' ? <form onSubmit={event => { event.preventDefault(); const failure = onRename(name); if (failure) setError(failure); else close(); }}>
        <h2>Ganti nama</h2><label>Nama baru<input ref={input} value={name} maxLength={120} onChange={event => { setName(event.target.value); setError(''); }}/></label>
        {error && <p role="alert">{error}</p>}<footer><button type="button" onClick={close}>Batalkan</button><button type="submit" disabled={!name.trim() || name.trim() === target.title}>Ganti nama</button></footer>
      </form> : page === 'delete' ? <><h2>Hapus percakapan?</h2><p>Ini akan menghapus “{target.title}” dari riwayat perangkat.</p>{error && <p role="alert">{error}</p>}<footer><button onClick={close}>Batalkan</button><button className="m-session-danger" onClick={() => { const failure = onRemove(); if (failure) setError(failure); else close(); }}>Hapus</button></footer></> : <>
        <h2>Tambahkan ke proyek</h2>{loadMobileProjects().map(project => <button key={project.id} className="m-session-project" onClick={() => { try { const projects = loadMobileProjects().map(item => item.id === project.id ? { ...item, chats: [...new Set([...item.chats, target.title])] } : item); localStorage.setItem('client-mobile-projects-v1', JSON.stringify(projects)); onNotice('Ditambahkan ke ' + project.name); close(); } catch { setError('Proyek belum tersimpan.'); } }}><Icon name="folder"/><span>{project.name}</span>{project.chats.includes(target.title) && <Icon name="check"/>}</button>)}
        {!loadMobileProjects().length && <p>Belum ada proyek. Buat proyek melalui menu Proyek.</p>}{error && <p role="alert">{error}</p>}<footer><button onClick={close}>Batalkan</button></footer>
      </>}
    </div>
  </div>;
}
