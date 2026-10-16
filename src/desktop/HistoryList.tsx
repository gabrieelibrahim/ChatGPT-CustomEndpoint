import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { B, I } from './Desktop';
import { Disclosure, useHoverPreview } from './Motion';

export type HistoryListProps = {
  titles: string[]; pinned: string[]; archived: string[]; active: string;
  projects?: string[]; showPinned?: boolean;
  onNew: () => void; onOpen: (title: string) => void; onPin: (title: string) => void;
  onArchive: (title: string) => void; onCreateProject?: () => void; onProject?: (title: string) => void;
};

export function HistoryList({ titles, pinned, archived, active, onNew, onOpen, onPin, onArchive,
  showPinned = true, projects = [], onCreateProject, onProject }: HistoryListProps) {
  const preview = useHoverPreview<{ title: string; top: number }>(180);
  const [collapsed, setCollapsed] = useState(false), [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [options, setOptions] = useState<'Projects' | 'Recents' | null>(null), [alphabetical, setAlphabetical] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null), optionsAnchor = useRef<HTMLElement | null>(null);
  const [optionsPosition, setOptionsPosition] = useState({ left: 0, top: 0 });
  function toggleOptions(section: 'Projects' | 'Recents', anchor: HTMLElement) {
    optionsAnchor.current = anchor;
    const root = document.querySelector<HTMLElement>('.d-root'); if (!root) return;
    const bounds = root.getBoundingClientRect(), rect = anchor.getBoundingClientRect(), scale = bounds.width / root.offsetWidth || 1;
    setOptionsPosition({ left: Math.min((rect.left - bounds.left) / scale, root.offsetWidth - 300), top: Math.min((rect.bottom - bounds.top) / scale + 6, root.offsetHeight - 150) });
    preview.close(); setOptions(previous => previous === section ? null : section);
  }
  useEffect(() => {
    if (!options) return;
    const close = (event: PointerEvent) => { if (!optionsRef.current?.contains(event.target as Node) && !optionsAnchor.current?.contains(event.target as Node)) setOptions(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOptions(null); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [options]);
  function enter(title: string, element: HTMLElement, immediate = false) {
    const root = document.querySelector<HTMLElement>('.d-root'); if (!root) return;
    const bounds = root.getBoundingClientRect(), rect = element.getBoundingClientRect(), scale = bounds.width / root.offsetWidth;
    preview.show({ title, top: Math.min((rect.top - bounds.top) / scale, root.offsetHeight - 110) }, immediate);
  }
  function row(title: string) {
    return <div key={title} className={'d-history-row ' + (active === title ? 'd-selected' : '')}
      onMouseEnter={event => enter(title, event.currentTarget)} onMouseLeave={preview.leave}
      onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) enter(title, event.currentTarget, true); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) preview.leave(); }}>
      <button className="d-history-open" onClick={() => { preview.close(); onOpen(title); }}>{title}</button>
      <div className="d-history-actions"><B icon="pin" label={pinned.includes(title) ? 'Unpin chat' : 'Pin chat'} onClick={() => onPin(title)}/>
        <B icon="archive" label="Archive chat" onClick={() => { preview.close(); onArchive(title); }}/></div>
    </div>;
  }
  const visibleTitles = titles.filter(title => (!showPinned || !pinned.includes(title)) && !archived.includes(title));
  const sortedTitles = alphabetical ? [...visibleTitles].sort((a, b) => a.localeCompare(b)) : visibleTitles;
  const root = typeof document === 'undefined' ? null : document.querySelector('.d-root');
  return <div className="d-history-list">
    <B icon="edit" label="New chat" className="d-navrow" onClick={onNew}>New chat</B>
    <div className="d-history-scroll" onScroll={() => { preview.close(); setOptions(null); }}>
      {showPinned && pinned.some(title => !archived.includes(title)) && <><div className="d-history-section"><button className="d-section-toggle" aria-expanded={!pinnedCollapsed} onClick={()=>{setPinnedCollapsed(!pinnedCollapsed);preview.close()}}><span>Pinned</span><I name="down" size={15}/></button></div><Disclosure open={!pinnedCollapsed}>{pinned.filter(title => !archived.includes(title)).map(row)}</Disclosure></>}
      <div className="d-history-section"><button aria-expanded={!projectsCollapsed} className="d-section-toggle" onClick={() => { setProjectsCollapsed(!projectsCollapsed); preview.close(); }}><span>Projects</span><I name="down" size={15}/></button>
        <div className="d-section-tools"><B icon="dots" label="Project options" onClick={event => toggleOptions('Projects', event.currentTarget)}/><B icon="plus" label="New project" onClick={onCreateProject}/></div>
      </div>
      <Disclosure open={!projectsCollapsed}>{projects.length ? projects.map(project => <button key={project} className="d-project-row" onClick={() => onProject?.(project)}><I name="folder" size={21}/>{project}</button>) : <p className="d-empty">No projects</p>}</Disclosure>
      <div className="d-history-section d-recents-section"><button className="d-section-toggle" aria-expanded={!collapsed} onClick={() => { setCollapsed(!collapsed); preview.close(); }}><span>Recents</span><I name="down" size={15}/></button>
        <div className="d-section-tools"><B icon="dots" label="Recent chat options" onClick={event => toggleOptions('Recents', event.currentTarget)}/><B icon="edit" label="New chat" onClick={onNew}/></div>
      </div>
      <Disclosure open={!collapsed}>{sortedTitles.map(row)}</Disclosure>
    </div>
    {options && root && createPortal(<div className="d-history-options" style={{ ...optionsPosition, position: 'fixed' }} ref={optionsRef} role="menu" aria-label={options + ' options'}>{options === 'Projects' ? <button role="menuitem" onClick={() => { onCreateProject?.(); setOptions(null); }}>New project</button> : <><button role="menuitemradio" aria-checked={!alphabetical} onClick={() => { setAlphabetical(false); setOptions(null); }}>Recent first{!alphabetical && <I name="check" size={18}/>}</button><button role="menuitemradio" aria-checked={alphabetical} onClick={() => { setAlphabetical(true); setOptions(null); }}>Alphabetical{alphabetical && <I name="check" size={18}/>}</button></>}</div>, root)}
    {preview.data && root && createPortal(<div className="d-history-preview" data-open={preview.open} aria-hidden={!preview.open} style={{ top: preview.data.top }} onMouseEnter={preview.keep} onMouseLeave={preview.leave}>
      <div><b>{preview.data.title}</b><I name="computer" size={18}/><time>Local</time></div><p><I name="comment" size={20}/>Chat</p>
    </div>, root)}
  </div>;
}
