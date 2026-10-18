import { useRef, useState, type RefObject } from 'react';
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
  const titles = props.titles.filter(title => !props.archived.includes(title) && title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
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
        <div className="m-sidebar-history">{groups.map(([label, items]) => items.length > 0 && <section key={label}><h2>{label}</h2>{items.map(title => <button key={title} onClick={() => props.onOpen(title)}>{label === 'Disematkan' && <Icon name="comment"/>}<span>{title}</span></button>)}</section>)}
          {!titles.length && <p>{query ? 'Obrolan tidak ditemukan.' : 'Belum ada obrolan.'}</p>}
        </div>
      </div>
      <footer><button className="m-sidebar-new" onClick={props.onNew}><Icon name="edit"/>Obrolan</button><button className="m-sidebar-account" aria-label={'Settings — ' + props.name} onClick={props.onSettings}><Icon name="work"/></button></footer>
    </aside>
  </div>;
}
