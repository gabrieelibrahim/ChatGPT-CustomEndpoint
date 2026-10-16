import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { B, I } from './Desktop';

export type HistoryListProps = {
  titles: string[]; pinned: string[]; archived: string[]; active: string;
  projects?: string[]; showPinned?: boolean;
  onNew: () => void; onOpen: (title: string) => void; onPin: (title: string) => void;
  onArchive: (title: string) => void; onCreateProject?: () => void; onProject?: (title: string) => void;
};

export function HistoryList({ titles, pinned, archived, active, onNew, onOpen, onPin, onArchive,
  showPinned = true, projects = [], onCreateProject, onProject }: HistoryListProps) {
  const [hover, setHover] = useState<{ title: string; top: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false), [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [options, setOptions] = useState<'Projects' | 'Recents' | null>(null), [alphabetical, setAlphabetical] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), optionsRef = useRef<HTMLDivElement>(null);
  function cancel() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  function leave() { cancel(); timer.current = setTimeout(() => setHover(null), 120); }
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    if (!options) return;
    const close = (event: PointerEvent) => { if (!optionsRef.current?.contains(event.target as Node)) setOptions(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOptions(null); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [options]);
  function enter(title: string, element: HTMLElement) {
    cancel();
    const root = document.querySelector<HTMLElement>('.d-root'); if (!root) return;
    const bounds = root.getBoundingClientRect(), rect = element.getBoundingClientRect(), scale = bounds.width / root.offsetWidth;
    timer.current = setTimeout(() => setHover({ title, top: Math.min((rect.top - bounds.top) / scale, root.offsetHeight - 110) }), 350);
  }
  function row(title: string) {
    return <div key={title} className={'d-history-row ' + (active === title ? 'd-selected' : '')}
      onMouseEnter={event => enter(title, event.currentTarget)} onMouseLeave={leave}
      onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) enter(title, event.currentTarget); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) leave(); }}>
      <button className="d-history-open" onClick={() => { cancel(); setHover(null); onOpen(title); }}>{title}</button>
      <div className="d-history-actions"><B icon="pin" label={pinned.includes(title) ? 'Unpin chat' : 'Pin chat'} onClick={() => onPin(title)}/>
        <B icon="archive" label="Archive chat" onClick={() => { cancel(); setHover(null); onArchive(title); }}/></div>
    </div>;
  }
  const visibleTitles = titles.filter(title => (!showPinned || !pinned.includes(title)) && !archived.includes(title));
  const sortedTitles = alphabetical ? [...visibleTitles].sort((a, b) => a.localeCompare(b)) : visibleTitles;
  const root = typeof document === 'undefined' ? null : document.querySelector('.d-root');
  return <div className="d-history-list">
    <B icon="edit" label="New chat" className="d-navrow" onClick={onNew}>New chat</B>
    <div className="d-history-scroll" onScroll={() => { cancel(); setHover(null); }}>
      {showPinned && pinned.some(title => !archived.includes(title)) && <><h3>Pinned</h3>{pinned.filter(title => !archived.includes(title)).map(row)}</>}
      <div className="d-history-section"><button aria-expanded={!projectsCollapsed} className="d-section-toggle" onClick={() => { setProjectsCollapsed(!projectsCollapsed); setHover(null); }}><span>Projects</span><I name="down" size={15}/></button>
        <div className="d-section-tools"><B icon="dots" label="Project options" onClick={() => setOptions(options === 'Projects' ? null : 'Projects')}/><B icon="plus" label="New project" onClick={onCreateProject}/></div>
      </div>
      {!projectsCollapsed && (projects.length ? projects.map(project => <button key={project} className="d-project-row" onClick={() => onProject?.(project)}><I name="folder" size={21}/>{project}</button>) : <p className="d-empty">No projects</p>)}
      <div className="d-history-section d-recents-section"><button className="d-section-toggle" aria-expanded={!collapsed} onClick={() => { setCollapsed(!collapsed); setHover(null); }}><span>Recents</span><I name="down" size={15}/></button>
        <div className="d-section-tools"><B icon="dots" label="Recent chat options" onClick={() => setOptions(options === 'Recents' ? null : 'Recents')}/><B icon="edit" label="New chat" onClick={onNew}/></div>
      </div>
      {!collapsed && sortedTitles.map(row)}
    </div>
    {options && <div className="d-history-options" ref={optionsRef} role="menu" aria-label={options + ' options'}>{options === 'Projects' ? <button role="menuitem" onClick={() => { onCreateProject?.(); setOptions(null); }}>New project</button> : <><button role="menuitemradio" aria-checked={!alphabetical} onClick={() => { setAlphabetical(false); setOptions(null); }}>Recent first{!alphabetical && <I name="check" size={18}/>}</button><button role="menuitemradio" aria-checked={alphabetical} onClick={() => { setAlphabetical(true); setOptions(null); }}>Alphabetical{alphabetical && <I name="check" size={18}/>}</button></>}</div>}
    {hover && root && createPortal(<div className="d-history-preview" style={{ top: hover.top }} onMouseEnter={cancel} onMouseLeave={leave}>
      <div><b>{hover.title}</b><I name="computer" size={18}/><time>Local</time></div><p><I name="comment" size={20}/>Chat</p>
    </div>, root)}
  </div>;
}
