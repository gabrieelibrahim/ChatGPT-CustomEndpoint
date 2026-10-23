import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Checkbox } from '@openai/apps-sdk-ui/components/Checkbox';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import { RadioGroup } from '@openai/apps-sdk-ui/components/RadioGroup';
import { Select } from '@openai/apps-sdk-ui/components/Select';
import { Slider } from '@openai/apps-sdk-ui/components/Slider';
import { SegmentedControl } from '@openai/apps-sdk-ui/components/SegmentedControl';
import { Popover } from '@openai/apps-sdk-ui/components/Popover';
import { Copy, Check, Info, Share, Download, Calendar, ChevronDown, Plus, Minus } from '@openai/apps-sdk-ui/components/Icon';
import { parseUiBlock, type Field, type Tone, type UiNode } from './schema';
import { RichIcon } from './RichIcon';
import { richCopy, richDownload, richShare, richCompose } from './richActions';
import { InlineMarkdown } from './InlineMarkdown';

const badgeColor = (tone: Tone) => ({ default: 'secondary', outline: 'secondary', success: 'success', danger: 'danger', warning: 'warning', info: 'info' } as const)[tone];
const RichBadge = ({ label, tone }: { label: string; tone: Tone }) => <Badge color={badgeColor(tone)} variant={tone === 'outline' ? 'outline' : 'soft'} size="sm">{label}</Badge>;

function useStatus() {
  const [status, setStatus] = useState(''), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return [status, (text: string) => { clearTimeout(timer.current); setStatus(text); timer.current = setTimeout(() => setStatus(''), 1800); }] as const;
}

function Counter({ node }: { node: Extract<UiNode, { type: 'counter' }> }) {
  const [value, setValue] = useState(node.value), clamp = (next: number) => Math.min(node.max ?? Infinity, Math.max(node.min ?? -Infinity, Number(next.toPrecision(12))));
  return <div className="r-panel r-counter"><div className="r-counter-head"><span>{node.label}</span><strong aria-live="polite">{value}</strong></div>
    <div className="r-actions"><Button color="primary" pill size="sm" onClick={() => setValue(clamp(value + node.step))}><Plus/>Tambah</Button><Button color="secondary" variant="outline" pill size="sm" onClick={() => setValue(clamp(value - node.step))}><Minus/>Kurangi</Button><Button color="secondary" variant="ghost" pill size="sm" onClick={() => setValue(node.value)}>Reset</Button></div></div>;
}

function FieldControl({ field, value, onChange }: { field: Field; value: string | number | boolean; onChange: (value: string | number | boolean) => void }) {
  if (field.type === 'checkbox') return <Checkbox label={field.label} checked={value === true} onCheckedChange={next => onChange(next)}/>;
  const label = <span className="r-field-label">{field.label}</span>;
  if (field.type === 'text') return <label className="r-field">{label}<Input size="lg" placeholder={field.placeholder} value={String(value)} onChange={event => onChange(event.target.value)}/></label>;
  if (field.type === 'textarea') return <label className="r-field">{label}<Textarea placeholder={field.placeholder} rows={3} value={String(value)} onChange={event => onChange(event.target.value)}/></label>;
  if (field.type === 'radio') return <div className="r-field">{label}<RadioGroup aria-label={field.label} direction="col" value={String(value)} onChange={next => onChange(next)}>{field.options.map(option => <RadioGroup.Item key={option.value} value={option.value}>{option.label}</RadioGroup.Item>)}</RadioGroup></div>;
  if (field.type === 'select') return <div className="r-field">{label}<Select options={field.options} value={String(value)} onChange={option => onChange(option.value)} size="lg" block/></div>;
  if (field.type === 'slider') return <div className="r-field r-slider"><Slider label={field.label} value={Number(value)} min={field.min} max={field.max} step={field.step} unit={field.unit} onChange={next => onChange(next)}/></div>;
  // Native date input: Android WebView opens the system calendar dialog.
  return <label className="r-field">{label}<span className="r-date"><Calendar/><input type="date" value={String(value)} onChange={event => onChange(event.target.value)} aria-label={field.label}/><ChevronDown/></span></label>;
}

function Form({ node }: { node: Extract<UiNode, { type: 'form' }> }) {
  const initial = useMemo(() => Object.fromEntries(node.fields.map(field => [field.name, field.type === 'checkbox' ? field.value === true : field.type === 'slider' ? field.value : field.type === 'date' ? field.value ?? new Date().toISOString().slice(0, 10) : field.value ?? ''])), [node]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(initial), [result, setResult] = useState('');
  const summary = () => node.fields.map(field => { const value = values[field.name], option = 'options' in field ? field.options.find(item => item.value === value) : undefined; return `${field.label}: ${field.type === 'checkbox' ? (value ? 'Ya' : 'Tidak') : option?.label ?? value}`; }).join('\n');
  function submit() {
    // {name} placeholders take the submitted values; nothing is sent anywhere without the user pressing Send.
    const message = node.submit?.message ? node.submit.message.replace(/\{([\w-]+)\}/g, (_, key: string) => { const field = node.fields.find(item => item.name === key), value = values[key]; return field && 'options' in field ? field.options.find(item => item.value === value)?.label ?? String(value ?? '') : String(value ?? ''); }) : 'Terkirim.\n' + summary();
    setResult(message);
    if (node.submit?.compose) richCompose(summary());
  }
  return <form className="r-panel r-form" onSubmit={event => { event.preventDefault(); submit(); }}>
    {node.title && <strong className="r-panel-title">{node.title}</strong>}
    {node.fields.map(field => <FieldControl key={field.name} field={field} value={values[field.name]} onChange={value => setValues(previous => ({ ...previous, [field.name]: value }))}/>)}
    {node.submit && <Button type="submit" color="primary" pill block size="lg">{node.submit.label}</Button>}
    {result && <p className="r-form-result" role="status">{result}</p>}
  </form>;
}

function Segmented({ node }: { node: Extract<UiNode, { type: 'segmented' }> }) {
  const [index, setIndex] = useState('0');
  return <div className="r-segmented"><SegmentedControl aria-label="Pilihan tampilan" value={index} onChange={setIndex} block pill size="md">{node.options.map((option, i) => <SegmentedControl.Option key={i} value={String(i)}>{option.label}</SegmentedControl.Option>)}</SegmentedControl>
    {node.options[Number(index)]?.content && <div className="r-panel r-segment-content"><InlineMarkdown text={node.options[Number(index)].content}/></div>}</div>;
}

function Accordion({ node }: { node: Extract<UiNode, { type: 'accordion' }> }) {
  return <div className="r-accordion">{node.items.map((item, index) => <details key={index}><summary>{item.title}<ChevronDown/></summary><div><InlineMarkdown text={item.content}/></div></details>)}</div>;
}

function Carousel({ node }: { node: Extract<UiNode, { type: 'carousel' }> }) {
  const track = useRef<HTMLDivElement>(null);
  return <div className="r-carousel" ref={track} role="list">{node.items.map((item, index) => <article key={index} role="listitem" className="r-panel r-slide">{item.icon && <span className="r-slide-icon"><RichIcon name={item.icon}/></span>}<strong>{item.title}</strong>{item.text && <p>{item.text}</p>}</article>)}</div>;
}

function RichPopover({ node }: { node: Extract<UiNode, { type: 'popover' }> }) {
  return <Popover><Popover.Trigger><Button color="secondary" variant="outline" pill size="sm"><Info/>{node.label}</Button></Popover.Trigger>
    <Popover.Content side="bottom" align="start" minWidth={240}><div className="r-popover">{node.title && <strong>{node.title}</strong>}<p>{node.content}</p></div></Popover.Content></Popover>;
}

function Images({ node }: { node: Extract<UiNode, { type: 'images' }> }) {
  // Remote images load only after a tap, without a referrer, like images in Markdown answers.
  const [shown, setShown] = useState(false);
  return <div className="r-images">{node.items.map((image, index) => <figure key={index}>{shown ? <a href={image.src} target="_blank" rel="noopener noreferrer"><img src={image.src} alt={image.alt} loading="lazy" referrerPolicy="no-referrer"/></a> : <button type="button" className="r-image-load" onClick={() => setShown(true)}><RichIcon name="image" size={24}/><span>Ketuk untuk memuat</span></button>}{(image.caption || image.alt) && <figcaption>{image.caption || image.alt}</figcaption>}</figure>)}</div>;
}

function Writing({ node }: { node: Extract<UiNode, { type: 'writing' }> }) {
  const [status, flash] = useStatus(), full = (node.title ? node.title + '\n\n' : '') + node.text;
  return <section className="r-writing"><header><span><RichIcon name="file" size={16}/>{node.label}</span><span className="r-icon-buttons">
    <button type="button" aria-label="Salin teks" onClick={() => void richCopy(full).then(() => flash('Disalin'), () => flash('Gagal menyalin'))}>{status === 'Disalin' ? <Check/> : <Copy/>}</button>
    <button type="button" aria-label="Bagikan teks" onClick={() => void richShare(full).catch(() => flash('Tidak dapat membagikan'))}><Share/></button></span></header>
    {node.title && <h4>{node.title}</h4>}<InlineMarkdown text={node.text}/>{status && status !== 'Disalin' && <small role="status">{status}</small>}</section>;
}

export function FileCard({ name, description, content, mime }: { name: string; description?: string; content: string; mime: string }) {
  const [status, flash] = useStatus(), size = new Blob([content]).size;
  const label = size >= 1024 ? (size / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' KB' : size + ' B', ext = name.split('.').pop()?.toUpperCase() || 'File';
  return <div className="r-file"><div className="r-file-main"><span className="r-file-icon" aria-hidden="true">{/\.(md|txt)$/i.test(name) ? <RichIcon name="file" size={26}/> : <RichIcon name="code" size={26}/>}</span><span><strong>{name}</strong><small>{[label, description || ext].join(' • ')}</small></span></div>
    <button type="button" className="r-file-download" onClick={() => void richDownload(name, content, mime).then(result => flash(result === 'cancelled' ? '' : 'Tersimpan'), () => flash('Gagal menyimpan'))}><Download/><span>Download {ext === 'MD' ? 'File Markdown' : name}</span></button>{status && <small role="status">{status}</small>}</div>;
}

function Card({ node }: { node: Extract<UiNode, { type: 'card' }> }) {
  return <article className="r-panel r-card">{node.icon && <span className="r-card-icon"><RichIcon name={node.icon}/></span>}<strong>{node.title}</strong>{node.subtitle && <small>{node.subtitle}</small>}{node.badge && <RichBadge {...node.badge}/>}{node.text && <p>{node.text}</p>}{node.children.length > 0 && <div className="r-stack">{node.children.map((child, index) => <Node key={index} node={child}/>)}</div>}</article>;
}

function Node({ node }: { node: UiNode }): ReactNode {
  switch (node.type) {
    case 'stack': return <div className="r-stack">{node.children.map((child, index) => <Node key={index} node={child}/>)}</div>;
    case 'row': return <div className="r-row">{node.children.map((child, index) => <Node key={index} node={child}/>)}</div>;
    case 'grid': return <div className="r-grid" style={{ ['--r-columns' as string]: node.columns }}>{node.children.map((child, index) => <Node key={index} node={child}/>)}</div>;
    case 'title': return <h4 className="r-title">{node.text}</h4>;
    case 'text': return <p className={'r-text' + (node.tone ? ' r-text-' + node.tone : '') + (node.size === 'sm' ? ' r-text-sm' : '')}>{node.text}</p>;
    case 'markdown': return <InlineMarkdown text={node.text}/>;
    case 'divider': return <hr className="r-divider"/>;
    case 'badge': return <RichBadge {...node}/>;
    case 'badges': return <div className="r-badges">{node.items.map((item, index) => <RichBadge key={index} {...item}/>)}</div>;
    case 'card': return <Card node={node}/>;
    case 'callout': return <div className={'r-callout r-callout-' + node.tone} role="note">{node.title && <strong>{node.title}</strong>}<p>{node.text}</p></div>;
    case 'counter': return <Counter node={node}/>;
    case 'form': return <Form node={node}/>;
    case 'segmented': return <Segmented node={node}/>;
    case 'accordion': return <Accordion node={node}/>;
    case 'carousel': return <Carousel node={node}/>;
    case 'popover': return <RichPopover node={node}/>;
    case 'icons': return <div className="r-icons">{node.items.map((name, index) => <span key={index}><RichIcon name={name} size={22}/><small>{name}</small></span>)}</div>;
    case 'images': return <Images node={node}/>;
    case 'writing': return <Writing node={node}/>;
    case 'file': return <FileCard {...node}/>;
    case 'sources': return <ol className="r-sources">{node.items.map((item, index) => <li key={index}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a><small>{new URL(item.url).hostname}{item.description ? ' — ' + item.description : ''}</small></li>)}</ol>;
  }
}

/** A ```ui fence. While streaming an unfinished block shows a placeholder instead of an error. */
export const UiBlock = memo(function UiBlock({ source, streaming }: { source: string; streaming: boolean }) {
  const result = useMemo(() => parseUiBlock(source), [source]);
  if (result.ok) return <div className="r-ui"><Node node={result.node}/></div>;
  if (streaming) return <div className="r-skeleton" role="status" aria-label="Menyiapkan komponen"><span/><span/></div>;
  return <div className="r-invalid" role="note"><strong>Komponen tidak dapat ditampilkan</strong><small>{result.error}</small><pre>{source.slice(0, 2000)}</pre></div>;
});
