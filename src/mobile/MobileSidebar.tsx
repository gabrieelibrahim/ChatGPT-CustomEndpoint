import { useEffect, useRef, useState, type RefObject } from 'react';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';
import { MobileSearch } from './MobileSearch';
import type { LocalDocument } from '../desktop/ClientCollections';
import { createSessionPress } from './sessionPress';
import { MobileSessionMenu, type SessionMenuTarget } from './MobileSessionMenu';

export type MobileDestination = 'spaces' | 'projects' | 'scheduled' | 'plugins';
type Props = {
  closeRef: RefObject<HTMLButtonElement | null>; name: string; titles: string[]; pinned: string[]; archived: string[];
  onClose: () => void; onOpen: (title: string) => void; onNew: () => void; activeTitle?: string;
  onSettings: () => void; onNavigate: (page: MobileDestination) => void;
  documents?: LocalDocument[]; onProject?: (id: string) => void;
  onRename: (title: string, name: string) => string | undefined; onArchive: (title: string) => void;
  onRemove: (title: string) => string | undefined; onNotice: (message: string) => void;
};

function SessionRow({ title, active, held, pinned, onOpen, onMenu }: { title: string; active: boolean; held: boolean; pinned: boolean; onOpen: () => void; onMenu: (target: SessionMenuTarget) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const openMenu = (x: number, y: number) => { window.getSelection()?.removeAllRanges(); if (button.current) onMenu({ title, x, y, trigger: button.current }); };
  const latest = useRef(openMenu); latest.current = openMenu;
  const press = useRef<ReturnType<typeof createSessionPress> | null>(null);
  if (!press.current) press.current = createSessionPress((x, y) => latest.current(x, y));
  useEffect(() => () => press.current?.cancel(), []);
  return <button ref={button} className={held ? 'm-session-held' : undefined} aria-current={active ? 'page' : undefined} aria-haspopup="menu" aria-expanded={held}
    onPointerDown={event => { if (event.isPrimary && event.button === 0) press.current?.down(event.clientX, event.clientY); }}
    onPointerMove={event => press.current?.move(event.clientX, event.clientY)} onPointerUp={() => press.current?.cancel()} onPointerCancel={() => press.current?.cancel()} onLostPointerCapture={() => press.current?.cancel()}
    onContextMenu={event => { event.preventDefault(); press.current?.cancel(); openMenu(event.clientX || event.currentTarget.getBoundingClientRect().left + 50, event.clientY || event.currentTarget.getBoundingClientRect().bottom); }}
    onKeyDown={event => { if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.left + 50, rect.bottom); } }}
    onClick={event => { if (event.detail !== 0 && press.current?.consumeClick()) { event.preventDefault(); return; } onOpen(); }}>
    {pinned && <Icon name="comment"/>}<span>{title}</span>
  </button>;
}

export function MobileSidebar(props: Props) {
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<SessionMenuTarget | null>(null), [pins, setPins] = useState(props.pinned);
  const overlay = useRef<HTMLDivElement>(null);
  const pinSignature = JSON.stringify(props.pinned);
  useEffect(() => setPins(JSON.parse(pinSignature)), [pinSignature]);
  const [history, setHistory] = useState<{ source: string[]; archived: string[]; titles: string[] } | null>(null);
  // Prepare history after the drawer can paint. No minimum delay or invented
  // network activity: cached/empty results replace the skeleton as soon as ready.
  useEffect(() => {
    const prepare = () => setHistory({ source: props.titles, archived: props.archived, titles: props.titles.filter(title => !props.archived.includes(title)) });
    if (typeof window.requestIdleCallback === 'function') { const id = window.requestIdleCallback(prepare, { timeout: 150 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(prepare, 0); return () => clearTimeout(id);
  }, [props.titles, props.archived]);
  const loading = !history || history.source !== props.titles || history.archived !== props.archived;
  const titles = loading ? [] : history.titles;
  const groups = [['Disematkan', titles.filter(title => pins.includes(title))], ['Terkini', titles.filter(title => !pins.includes(title))]] as const;
  if (searching) return <div className="m-overlay"><MobileSearch titles={props.titles} archived={props.archived} documents={props.documents || []} onClose={() => { setSearching(false); requestAnimationFrame(() => props.closeRef.current?.focus({ preventScroll: true })); }} onOpen={props.onOpen} onProject={props.onProject || (() => props.onNavigate('projects'))}/></div>;
  return <div ref={overlay} className="m-overlay m-sidebar-overlay">
    <button className="m-backdrop" aria-label="Close sidebar" inert={!!menu} onClick={props.onClose}/>
    <aside className="m-drawer m-sidebar" role="dialog" aria-modal={!menu || undefined} aria-label="Sidebar" inert={!!menu}>
      <header><button className="m-sidebar-brand" aria-label="SuperGPT — Obrolan baru" onClick={props.onNew}>SuperGPT</button><button ref={props.closeRef} className="m-sidebar-search" aria-label="Search chats" onClick={() => setSearching(true)}><Icon name="search"/></button></header>
      <div className="m-sidebar-scroll">
        <nav aria-label="Menu utama">
          <button onClick={() => props.onNavigate('spaces')}><Icon name="spaces"/>Ruang</button>
          <button onClick={() => props.onNavigate('projects')}><Icon name="folder"/>Proyek</button>
          <button disabled aria-label="Codex sementara nonaktif"><Icon name="codex"/>Codex</button>
          <button onClick={() => props.onNavigate('scheduled')}><Icon name="clock"/>Terjadwal</button>
          <button onClick={() => props.onNavigate('plugins')}><Icon name="plugin"/>Plugin</button>
        </nav>
        <div className="m-sidebar-history" aria-busy={loading}>{loading ? <div className="m-sidebar-skeleton" role="status" aria-label="Menyiapkan daftar obrolan">{[0, 1, 2].map(row => <div className="m-sidebar-skeleton-row" key={row} aria-hidden="true"><span/></div>)}</div> : <>{groups.map(([label, items]) => items.length > 0 && <section key={label}><h2>{label}</h2>{items.map(title => <SessionRow key={title} title={title} active={title === props.activeTitle} held={menu?.title === title} pinned={label === 'Disematkan'} onOpen={() => props.onOpen(title)} onMenu={setMenu}/>)}</section>)}
          {!titles.length && <p>Belum ada obrolan.</p>}</>}
        </div>
      </div>
      <footer><button className="m-sidebar-new" onClick={props.onNew}><Icon name="edit"/>Obrolan</button><button className="m-sidebar-account" aria-label={'Settings — ' + props.name} onClick={props.onSettings}><Icon name="profile"/></button></footer>
    </aside>
    {menu && <MobileSessionMenu key={menu.title} target={menu} pinned={pins.includes(menu.title)} container={overlay} onClose={() => setMenu(null)} onNotice={props.onNotice}
      onPin={() => { const next = pins.includes(menu.title) ? pins.filter(value => value !== menu.title) : [...pins, menu.title]; try { localStorage.setItem('desktop-pinned', JSON.stringify(next)); setPins(next); } catch { props.onNotice('Sematan belum tersimpan.'); } }}
      onRename={name => { const failure = props.onRename(menu.title, name); if (!failure) setPins(previous => previous.map(value => value === menu.title ? name.trim() : value)); return failure; }}
      onArchive={() => props.onArchive(menu.title)} onRemove={() => props.onRemove(menu.title)}/>}
  </div>;
}
