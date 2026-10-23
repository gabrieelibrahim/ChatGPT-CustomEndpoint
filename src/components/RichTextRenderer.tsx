import { createContext, lazy, memo, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters, richMarkdownBlocks } from './richMarkdown';
import { Markdown, useParseMarkdownPre } from '@openai/apps-sdk-ui/components/Markdown';
import { CodeBlockBase } from '@openai/apps-sdk-ui/components/CodeBlock';
import { Check, Copy } from '@openai/apps-sdk-ui/components/Icon';
import { UiBlock, FileCard } from '../rich/UiBlock';
import { ChartBlock } from '../rich/ChartBlock';
import { mimeFor, parseFileInfo } from '../rich/schema';

const MermaidBlock = lazy(() => import('../rich/MermaidBlock').then(module => ({ default: module.MermaidBlock })));
// True only for the block still being streamed, so unfinished rich blocks show a placeholder, not an error.
const Live = createContext(false);
const languageNames: Record<string, string> = { js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX', py: 'Python', python: 'Python', json: 'JSON', html: 'HTML', css: 'CSS', sql: 'SQL', sh: 'Bash', bash: 'Bash', shell: 'Shell', zsh: 'Zsh', powershell: 'PowerShell', ps1: 'PowerShell', java: 'Java', kotlin: 'Kotlin', kt: 'Kotlin', go: 'Go', rust: 'Rust', rs: 'Rust', c: 'C', cpp: 'C++', 'c++': 'C++', csharp: 'C#', cs: 'C#', php: 'PHP', yaml: 'YAML', yml: 'YAML', xml: 'XML', md: 'Markdown', markdown: 'Markdown', swift: 'Swift', ruby: 'Ruby', rb: 'Ruby', dart: 'Dart', diff: 'Diff', dockerfile: 'Dockerfile', text: 'Teks' };

// Provider output is untrusted. Never execute HTML or accept active URL schemes.
export function richTextUrl(url: string): string {
  if (url.startsWith('#')) return url;
  try { const parsed = new URL(url); return !parsed.username && !parsed.password && ['https:', 'http:', 'mailto:', 'tel:', 'sms:'].includes(parsed.protocol) ? parsed.href : ''; }
  catch { return ''; }
}

function MessageImage({ src, alt = '' }: { src?: string; alt?: string }) {
  const [shown, setShown] = useState(false), [failed, setFailed] = useState(false);
  if (!src || !/^https?:/i.test(src)) return <span>{alt}</span>;
  if (!shown || failed) return <button className="d-rich-image-load" onClick={() => { setFailed(false); setShown(true); }}>{failed ? 'Coba muat gambar lagi' : 'Tampilkan gambar'}{alt ? ': ' + alt : ''}</button>;
  return <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/></a>;
}

function MessageCode({ children, meta }: { children?: ReactNode; meta?: string }) {
  const { code, language } = useParseMarkdownPre(children);
  const live = useContext(Live), lang = (language || '').toLowerCase();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle'), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Rich fences: ```ui (components), ```chart (data), ```mermaid (diagram), ````file name=… (download).
  if (lang === 'ui' || lang === 'supergpt-ui') return <UiBlock source={code} streaming={live}/>;
  if (lang === 'chart') return <ChartBlock source={code} streaming={live}/>;
  if (lang === 'mermaid') return <Suspense fallback={<div className="r-skeleton" role="status" aria-label="Menyiapkan diagram"><span/><span/></div>}><MermaidBlock source={code} streaming={live}/></Suspense>;
  const file = lang === 'file' || lang.startsWith('file:') ? parseFileInfo(language + ' ' + (meta || '')) : null;
  if (file && !live) return <FileCard name={file.name} description={file.description} content={code.replace(/\n$/, '')} mime={mimeFor(file.name)}/>;
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(code); setStatus('copied'); }
    catch { setStatus('failed'); }
    timer.current = setTimeout(() => setStatus('idle'), 1800);
  }
  return <CodeBlockBase><div className="d-rich-code-header"><span>{languageNames[lang] || language || 'Teks'}</span><button type="button" className="r-code-copy" aria-label={status === 'copied' ? 'Disalin' : status === 'failed' ? 'Gagal menyalin, coba lagi' : 'Salin kode'} onClick={() => void copy()}>{status === 'copied' ? <Check/> : <Copy/>}</button></div>{code.length <= 40000 ? <CodeBlockBase.Code language={language}>{code}</CodeBlockBase.Code> : <pre><code>{code}</code></pre>}</CodeBlockBase>;
}
type HastNode = { children?: { data?: { meta?: string }; properties?: { metastring?: string } }[] };

const components = {
  a: ({ children, node: _node, ...props }: { children?: React.ReactNode; node?: unknown; href?: string }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
  img: ({ node: _node, ...props }: { node?: unknown; src?: string; alt?: string }) => <MessageImage key={props.src} {...props}/>,
  pre: ({ children, node }: { children?: ReactNode; node?: HastNode }) => <MessageCode meta={node?.children?.[0]?.data?.meta}>{children}</MessageCode>,
};

const math = [[remarkMath, { singleDollarTextMath: true }]] as Parameters<typeof Markdown>[0]['remarkPlugins'];
const katex = [[rehypeKatex, { trust: false, strict: 'warn', throwOnError: false, maxExpand: 500, maxSize: 20 }]] as Parameters<typeof Markdown>[0]['rehypePlugins'];
const MarkdownBlock = memo(function MarkdownBlock({ text, live }: { text: string; live: boolean }) {
  return <Live.Provider value={live}><Markdown className="d-rich-block" remarkPlugins={math} rehypePlugins={katex} skipHtml urlTransform={richTextUrl} components={components}>{text}</Markdown></Live.Provider>;
});
export default memo(function RichTextRenderer({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => richMarkdownBlocks(normalizeMathDelimiters(text)), [text]);
  return <>{blocks.map((block, index) => <MarkdownBlock key={block.key} text={block.text} live={streaming && index === blocks.length - 1}/>)}</>;
});
