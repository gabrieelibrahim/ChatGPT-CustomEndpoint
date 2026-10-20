import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters, richMarkdownBlocks } from './richMarkdown';
import { Markdown, useParseMarkdownPre } from '@openai/apps-sdk-ui/components/Markdown';
import { CodeBlockBase } from '@openai/apps-sdk-ui/components/CodeBlock';
import { Button } from '@openai/apps-sdk-ui/components/Button';

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

function MessageCode({ children }: { children?: ReactNode }) {
  const { code, language } = useParseMarkdownPre(children);
  const [status, setStatus] = useState('Copy code'), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(code); setStatus('Copied'); }
    catch { setStatus('Copy failed — retry'); }
    timer.current = setTimeout(() => setStatus('Copy code'), 1800);
  }
  return <CodeBlockBase><div className="d-rich-code-header"><span>{language || 'text'}</span><Button aria-label="Copy code" variant="ghost" color="secondary" size="sm" onClick={() => void copy()}><span aria-live="polite">{status}</span></Button></div>{code.length <= 40000 ? <CodeBlockBase.Code language={language}>{code}</CodeBlockBase.Code> : <pre><code>{code}</code></pre>}</CodeBlockBase>;
}

const components = {
  a: ({ children, node: _node, ...props }: { children?: React.ReactNode; node?: unknown; href?: string }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
  img: ({ node: _node, ...props }: { node?: unknown; src?: string; alt?: string }) => <MessageImage key={props.src} {...props}/>,
  pre: ({ children }: { children?: ReactNode }) => <MessageCode>{children}</MessageCode>,
};

const math = [[remarkMath, { singleDollarTextMath: true }]] as Parameters<typeof Markdown>[0]['remarkPlugins'];
const katex = [[rehypeKatex, { trust: false, strict: 'warn', throwOnError: false, maxExpand: 500, maxSize: 20 }]] as Parameters<typeof Markdown>[0]['rehypePlugins'];
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return <Markdown className="d-rich-block" remarkPlugins={math} rehypePlugins={katex} skipHtml urlTransform={richTextUrl} components={components}>{text}</Markdown>;
});
export default memo(function RichTextRenderer({ text }: { text: string }) {
  const blocks = useMemo(() => richMarkdownBlocks(normalizeMathDelimiters(text)), [text]);
  return <>{blocks.map(block => <MarkdownBlock key={block.key} text={block.text}/>)}</>;
});
