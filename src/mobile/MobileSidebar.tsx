import { useEffect, useRef, useState, type RefObject } from 'react';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';

export type MobileDestination = 'spaces' | 'projects' | 'scheduled' | 'plugins';
type Props = {
  closeRef: RefObject<HTMLButtonElement | null>; name: string; titles: string[]; pinned: string[]; archived: string[];
  onClose: () => void; onOpen: (title: string) => void; onNew: () => void;
  onSettings: () => void; onNavigate: (page: MobileDestination) => void;
};

export function MobileSidebar(props: Props) {
  const [searching, setSearching] = useState(false), [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<{ source: string[]; archived: string[]; query: string; titles: string[] } | null>(null);
  // Prepare history after the drawer can paint. No minimum delay or invented
  // network activity: cached/empty results replace the skeleton as soon as ready.
  useEffect(() => {
    const prepare = () => setHistory({ source: props.titles, archived: props.archived, query, titles: props.titles.filter(title => !props.archived.includes(title) && title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) });
    if (typeof window.requestIdleCallback === 'function') { const id = window.requestIdleCallback(prepare, { timeout: 150 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(prepare, 0); return () => clearTimeout(id);
  }, [props.titles, props.archived, query]);
  const loading = !history || history.source !== props.titles || history.archived !== props.archived || history.query !== query;
  const titles = loading ? [] : history.titles;
  const groups = [['Disematkan', titles.filter(title => props.pinned.includes(title))], ['Terkini', titles.filter(title => !props.pinned.includes(title))]] as const;
  return <div className="m-overlay m-sidebar-overlay">
    <button className="m-backdrop" aria-label="Close sidebar" onClick={props.onClose}/>
    <aside className="m-drawer m-sidebar" role="dialog" aria-modal="true" aria-label="Sidebar">
      <header><strong>SuperGPT</strong><button ref={props.closeRef} className="m-sidebar-search" aria-label={searching ? 'Close search' : 'Search chats'} onClick={() => { setSearching(!searching); setQuery(''); requestAnimationFrame(() => input.current?.focus()); }}><Icon name={searching ? 'close' : 'search'}/></button></header>
      {searching && <label className="m-sidebar-query"><Icon name="search" size={18}/><input ref={input} aria-label="Search chats" placeholder="Cari obrolan" value={query} onChange={event => setQuery(event.target.value)}/></label>}
      <div className="m-sidebar-scroll">
        {!searching && <nav aria-label="Menu utama">
          <button onClick={() => props.onNavigate('spaces')}><Icon name="spaces"/>Ruang</button>
          <button onClick={() => props.onNavigate('projects')}><Icon name="folder"/>Proyek</button>
          <button disabled aria-label="Codex sementara nonaktif"><Icon name="codex"/>Codex</button>
          <button onClick={() => props.onNavigate('scheduled')}><Icon name="clock"/>Terjadwal</button>
          <button onClick={() => props.onNavigate('plugins')}><Icon name="plugin"/>Plugin</button>
        </nav>}
        <div className="m-sidebar-history" aria-busy={loading}>{loading ? <div className="m-sidebar-skeleton" role="status" aria-label="Menyiapkan daftar obrolan">{[0, 1, 2].map(row => <div className="m-sidebar-skeleton-row" key={row} aria-hidden="true"><span/></div>)}</div> : <>{groups.map(([label, items]) => items.length > 0 && <section key={label}><h2>{label}</h2>{items.map(title => <button key={title} onClick={() => props.onOpen(title)}>{label === 'Disematkan' && <Icon name="comment"/>}<span>{title}</span></button>)}</section>)}
          {!titles.length && <p>{query ? 'Obrolan tidak ditemukan.' : 'Belum ada obrolan.'}</p>}</>}
        </div>
      </div>
      <footer><button className="m-sidebar-new" onClick={props.onNew}><Icon name="edit"/>Obrolan</button><button className="m-sidebar-account" aria-label={'Settings — ' + props.name} onClick={props.onSettings}><Icon name="profile"/></button></footer>
    </aside>
  </div>;
}
