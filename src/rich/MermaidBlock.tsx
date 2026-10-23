import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Code, Copy, Download, Expand, Minus, Plus, X } from '@openai/apps-sdk-ui/components/Icon';
import { richCopy, richDownload } from './richActions';

type Mermaid = typeof import('mermaid').default;
let loading: Promise<Mermaid> | undefined, queue: Promise<unknown> = Promise.resolve(), counter = 0, configuredTheme = '';
const theme = () => document.documentElement.dataset.clientTheme === 'light' || (document.documentElement.dataset.clientTheme === 'system' && matchMedia('(prefers-color-scheme: light)').matches) ? 'default' : 'dark';

// Strict security: Mermaid sanitizes labels, disables click handlers/scripts and HTML labels.
async function renderMermaid(source: string): Promise<string> {
  const mermaid = await (loading ??= import('mermaid').then(module => module.default));
  const run = queue.then(async () => {
    if (configuredTheme !== theme()) { configuredTheme = theme(); mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: configuredTheme as 'dark', fontFamily: 'inherit', flowchart: { htmlLabels: false }, maxTextSize: 50000 }); }
    await mermaid.parse(source);
    const { svg } = await mermaid.render('supergpt-mermaid-' + ++counter, source);
    return svg;
  });
  queue = run.catch(() => {});
  return run;
}

export const MermaidBlock = memo(function MermaidBlock({ source, streaming }: { source: string; streaming: boolean }) {
  const [svg, setSvg] = useState(''), [error, setError] = useState(''), [view, setView] = useState<'diagram' | 'code'>('diagram'), [copied, setCopied] = useState(false), [full, setFull] = useState(false), [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (streaming) return;
    let live = true; setError('');
    renderMermaid(source.trim()).then(value => { if (live) setSvg(value); }, failure => { if (live) { setSvg(''); setError(failure instanceof Error ? failure.message.split('\n')[0].slice(0, 200) : 'Diagram tidak valid.'); } });
    return () => { live = false; };
  }, [source, streaming]);
  const showCode = view === 'code' || !!error;
  return <figure className="r-mermaid">
    <header><span className="r-mermaid-label"><Code/>Mermaid</span><span className="r-icon-buttons">
      <button type="button" aria-label={copied ? 'Disalin' : 'Salin kode diagram'} onClick={() => void richCopy(source).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? <Check/> : <Copy/>}</button>
      <button type="button" aria-label={view === 'code' ? 'Tampilkan diagram' : 'Tampilkan kode'} aria-pressed={view === 'code'} disabled={!!error} onClick={() => setView(value => value === 'code' ? 'diagram' : 'code')}><Code/></button>
      <button type="button" aria-label="Perbesar diagram" disabled={!svg} onClick={() => { setZoom(1); setFull(true); }}><Expand/></button>
      <button type="button" aria-label="Unduh SVG" disabled={!svg} onClick={() => void richDownload('diagram.svg', svg, 'image/svg+xml').catch(() => {})}><Download/></button>
    </span></header>
    {showCode ? <pre className="r-mermaid-source"><code>{source}</code></pre> : svg ? <div className="r-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }}/> : <div className="r-mermaid-loading" role="status" aria-label="Menggambar diagram"><span/></div>}
    {error && !streaming && <small className="r-mermaid-error" role="note">Diagram belum dapat digambar: {error}</small>}
    {full && createPortal(<div className="r-mermaid-full" role="dialog" aria-modal="true" aria-label="Diagram Mermaid">
      <div className="r-mermaid-full-bar"><button type="button" aria-label="Tutup" onClick={() => setFull(false)}><X/></button><span/><button type="button" aria-label="Perkecil" onClick={() => setZoom(value => Math.max(0.4, value - 0.2))}><Minus/></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Perbesar" onClick={() => setZoom(value => Math.min(4, value + 0.2))}><Plus/></button></div>
      <div className="r-mermaid-full-body"><div style={{ width: zoom * 100 + '%' }} dangerouslySetInnerHTML={{ __html: svg }}/></div>
    </div>, document.querySelector('.m-app') || document.body)}
  </figure>;
});
