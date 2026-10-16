import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UIIcon as I } from '../components/UIIcon';
import { agentRequest } from './CodexAgent';

export type LocalProject = { path: string; name: string; branch?: string | null; changes?: string | null };
export function loadLocalProjects(): LocalProject[] {
  try { const values = JSON.parse(localStorage.getItem('client-project-folders-v1') || '[]'); return Array.isArray(values) ? values.filter(item => typeof item?.path === 'string' && typeof item.name === 'string').slice(0, 100) : []; } catch { return []; }
}
function remember(project: LocalProject) {
  localStorage.setItem('client-project-folders-v1', JSON.stringify([project, ...loadLocalProjects().filter(item => item.path !== project.path)].slice(0, 100)));
}

export function LocalDialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { const old = document.activeElement as HTMLElement | null; panel.current?.querySelector<HTMLElement>('input,button,textarea,select')?.focus(); return () => { if (old?.isConnected) old.focus(); }; }, []);
  return <div className="d-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={'d-local-dialog ' + className} role="dialog" aria-modal="true" aria-label={title} ref={panel} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') { const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),textarea,select,button:not(:disabled),a[href]')]; const first = elements[0], last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
  }}><div className="d-local-heading"><h2>{title}</h2><button aria-label={'Close ' + title} onClick={onClose}><I name="close" size={22}/></button></div>{children}</div></div>;
}

export function ProjectChooser({ onSelect, onClose }: { onSelect: (project: LocalProject) => void; onClose: () => void }) {
  const [projects, setProjects] = useState(loadLocalProjects), [path, setPath] = useState(''), [query, setQuery] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function select(value: string) {
    setBusy(true); setError('');
    try { const project = await (await agentRequest({ action: 'projectInfo', cwd: value })).json(); remember(project); onSelect(project); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function browse() {
    setBusy(true); setError('');
    try { const { project } = await (await agentRequest({ action: 'pickFolder' })).json(); if (project) { remember(project); onSelect(project); } }
    catch (failure) { setError((failure as Error).message + ' Kamu juga bisa memasukkan path folder di bawah.'); }
    finally { setBusy(false); }
  }
  return <LocalDialog title="Choose project" onClose={onClose}>
    <p>Pilih folder kerja di komputer ini. File tidak diunggah saat memilih folder.</p>
    <button className="d-local-primary d-local-wide" disabled={busy} onClick={() => void browse()}><I name="folder" size={20}/>{busy ? 'Menunggu pilihan folder…' : 'Browse folders'}</button>
    <form onSubmit={event => { event.preventDefault(); void select(path); }}><label>Path folder<input aria-label="Project folder path" placeholder="D:\Projects\my-app" value={path} onChange={event => setPath(event.target.value)} required/></label><button disabled={busy || !path.trim()}>Open folder</button></form>
    {!!projects.length && <><h3>Recent projects</h3><input aria-label="Search projects" placeholder="Search projects" value={query} onChange={event => setQuery(event.target.value)}/><div className="d-local-list">{projects.filter(project => (project.name + project.path).toLowerCase().includes(query.toLowerCase())).map(project => <div className="d-local-project-row" key={project.path}><button disabled={busy} onClick={() => void select(project.path)}><I name="folder" size={20}/><span><b>{project.name}</b><small>{project.path}</small></span></button><button aria-label={'Forget ' + project.name} onClick={() => { const next = projects.filter(item => item.path !== project.path); localStorage.setItem('client-project-folders-v1', JSON.stringify(next)); setProjects(next); }}><I name="close" size={17}/></button></div>)}</div></>}
    {error && <p className="d-local-error" role="alert">{error}</p>}
  </LocalDialog>;
}

export function ComputerChooser({ folder, onSettings, onClose }: { folder: string; onSettings: () => void; onClose: () => void }) {
  const [computer, setComputer] = useState<{ name: string; platform: string; runtimeAvailable: boolean } | null>(null), [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); void agentRequest({ action: 'computerInfo' }, controller.signal).then(response => response.json()).then(setComputer).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }); return () => controller.abort(); }, []);
  return <LocalDialog title="Execution environment" onClose={onClose}>
    <button className="d-local-environment" onClick={onClose}><I name="computer" size={25}/><span><b>This computer</b><small>{computer ? computer.name + ' · ' + computer.platform : 'Memeriksa komputer…'}</small></span><I name="check" size={20}/></button>
    <dl><dt>Codex runtime</dt><dd>{computer ? computer.runtimeAvailable ? 'Available' : 'Not installed' : 'Checking…'}</dd><dt>Project</dt><dd>{folder || 'Belum dipilih'}</dd></dl>
    <p>Eksekusi berlangsung di komputer ini. Pengaturan agent menentukan akses folder dan koneksi model.</p>
    {error && <p className="d-local-error" role="alert">{error}</p>}
    <button className="d-local-primary d-local-wide" onClick={onSettings}>Agent settings</button>
  </LocalDialog>;
}

export function ProjectFiles({ cwd, onChooseProject, onAttach, onClose }: { cwd: string; onChooseProject: () => void; onAttach: (file: File) => void; onClose: () => void }) {
  const [files, setFiles] = useState<string[]>([]), [query, setQuery] = useState(''), [error, setError] = useState(''), [limited, setLimited] = useState(false), [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  useEffect(() => { if (!cwd) return; const controller = new AbortController(); void agentRequest({ action: 'projectFiles', cwd }, controller.signal).then(response => response.json()).then(data => { setFiles(data.files); setLimited(data.limited); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }); return () => controller.abort(); }, [cwd]);
  async function open(name: string) { try { setError(''); setPreview(await (await agentRequest({ action: 'projectFile', cwd, name })).json()); } catch (failure) { setError((failure as Error).message); } }
  return <LocalDialog title="Project files" onClose={onClose} className="d-local-files"><p>{cwd || 'Pilih folder project untuk mencari file lokal.'}</p>{!cwd ? <button className="d-local-primary" onClick={onChooseProject}>Choose project</button> : <><input aria-label="Search project files" placeholder="Search files" value={query} onChange={event => setQuery(event.target.value)}/>{limited && <p>Menampilkan indeks terbatas; folder dependency dan file tersembunyi dilewati.</p>}<div className="d-file-explorer"><div>{files.filter(name => name.toLowerCase().includes(query.toLowerCase())).slice(0, 250).map(name => <button key={name} onClick={() => void open(name)}>{name}</button>)}{!files.length && <p>Belum ada file yang ditampilkan.</p>}</div><div>{preview ? <><b>{preview.name}</b><pre>{preview.text}</pre><button className="d-local-primary" onClick={() => { onAttach(new File([preview.text], preview.name, { type: 'text/plain' })); onClose(); }}>Attach to chat</button></> : <p>Pilih file untuk preview.</p>}</div></div></>}{error && <p role="alert" className="d-local-error">{error}</p>}</LocalDialog>;
}
