// Versioned rich-content protocol for ```ui blocks. Model output is untrusted: only the components and props
// listed here survive, every string is length-capped, URLs are allowlisted, and nothing executes.
export const RICH_UI_VERSION = '1.0';
export const RICH_LIMITS = { json: 100_000, depth: 8, nodes: 200, items: 50, text: 50_000 };

export type Tone = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'outline';
export type Option = { label: string; value: string };
export type Field =
  | { type: 'text' | 'textarea'; name: string; label: string; placeholder?: string; value?: string }
  | { type: 'radio' | 'select'; name: string; label: string; options: Option[]; value?: string }
  | { type: 'checkbox'; name: string; label: string; value?: boolean }
  | { type: 'slider'; name: string; label: string; min: number; max: number; step: number; value: number; unit?: string }
  | { type: 'date'; name: string; label: string; value?: string };
export type UiNode =
  | { type: 'stack' | 'row'; children: UiNode[] }
  | { type: 'grid'; columns: number; children: UiNode[] }
  | { type: 'title'; text: string }
  | { type: 'text'; text: string; tone?: 'muted' | 'success' | 'danger'; size?: 'sm' | 'md' }
  | { type: 'markdown'; text: string }
  | { type: 'divider' }
  | { type: 'badge'; label: string; tone: Tone }
  | { type: 'badges'; items: { label: string; tone: Tone }[] }
  | { type: 'card'; title: string; subtitle?: string; icon?: string; badge?: { label: string; tone: Tone }; text?: string; children: UiNode[] }
  | { type: 'callout'; tone: Tone; title?: string; text: string }
  | { type: 'counter'; label: string; value: number; step: number; min?: number; max?: number }
  | { type: 'form'; title?: string; fields: Field[]; submit?: { label: string; message?: string; compose?: boolean } }
  | { type: 'segmented'; options: { label: string; content: string }[] }
  | { type: 'accordion'; items: { title: string; content: string }[] }
  | { type: 'carousel'; items: { title: string; text?: string; icon?: string }[] }
  | { type: 'popover'; label: string; title?: string; content: string }
  | { type: 'icons'; items: string[] }
  | { type: 'images'; items: { src: string; alt: string; caption?: string }[] }
  | { type: 'writing'; label: string; title?: string; text: string }
  | { type: 'file'; name: string; description?: string; content: string; mime: string }
  | { type: 'sources'; items: { title: string; url: string; description?: string }[] };
export type UiResult = { ok: true; node: UiNode } | { ok: false; error: string };

import { ICON_NAMES } from './iconNames';
export { ICON_NAMES };
const tones: Tone[] = ['default', 'success', 'danger', 'warning', 'info', 'outline'];
const blocked = new Set(['__proto__', 'prototype', 'constructor']);

/** http(s)/mailto/tel only, no credentials. Returns '' when unsafe. */
export function safeUrl(value: string, images = false): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) return '';
    if (images ? !['https:', 'http:'].includes(url.protocol) : !['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return '';
    return url.href;
  } catch { return ''; }
}

class Invalid extends Error {}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function parseUiBlock(source: string): UiResult {
  if (source.length > RICH_LIMITS.json) return { ok: false, error: 'Komponen terlalu besar.' };
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { return { ok: false, error: 'Format komponen belum lengkap atau tidak valid.' }; }
  return validateUi(raw);
}

export function validateUi(raw: unknown): UiResult {
  let nodes = 0, characters = 0;
  const fail = (message: string): never => { throw new Invalid(message); };
  const own = (value: Record<string, unknown>) => { for (const key of Object.keys(value)) if (blocked.has(key)) fail('Properti komponen tidak diizinkan.'); return value; };
  const str = (value: unknown, max = 2000, field = 'teks'): string => {
    if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
    if (typeof value !== 'string') fail(`Nilai ${field} tidak valid.`);
    const text = (value as string).slice(0, max); characters += text.length;
    if (characters > RICH_LIMITS.text) fail('Isi komponen terlalu panjang.');
    return text;
  };
  const opt = (value: unknown, max = 2000) => value === undefined || value === null || value === '' ? undefined : str(value, max);
  const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const list = (value: unknown, name: string): unknown[] => { if (!Array.isArray(value)) fail(`Daftar ${name} tidak valid.`); if ((value as unknown[]).length > RICH_LIMITS.items) fail(`Daftar ${name} terlalu panjang.`); return value as unknown[]; };
  const tone = (value: unknown): Tone => tones.includes(value as Tone) ? value as Tone : 'default';
  const name = (value: unknown, index: number) => { const text = opt(value, 60) || 'field' + (index + 1); return /^[\w-]+$/.test(text) ? text : 'field' + (index + 1); };
  const options = (value: unknown): Option[] => list(value, 'pilihan').map(item => record(item) ? { label: str(own(item).label ?? item.value, 200), value: str(item.value ?? item.label, 200) } : { label: str(item, 200), value: str(item, 200) });
  const icon = (value: unknown) => { const text = opt(value, 40); return text && (ICON_NAMES as readonly string[]).includes(text) ? text : undefined; };

  function field(value: unknown, index: number): Field {
    if (!record(value)) fail('Field form tidak valid.');
    const f = own(value as Record<string, unknown>), type = f.type, label = str(f.label ?? f.name ?? '', 200), key = name(f.name, index);
    if (type === 'text' || type === 'textarea') return { type, name: key, label, placeholder: opt(f.placeholder, 200), value: opt(f.value, 4000) };
    if (type === 'radio' || type === 'select') { const items = options(f.options); if (!items.length) fail('Pilihan form kosong.'); const chosen = opt(f.value, 200); return { type, name: key, label, options: items, value: items.some(item => item.value === chosen) ? chosen : items[0].value }; }
    if (type === 'checkbox') return { type, name: key, label, value: f.value === true };
    if (type === 'slider') { const min = num(f.min, 0), max = Math.max(min + 1, num(f.max, 100)), step = Math.max(Math.abs(num(f.step, 1)) || 1, (max - min) / 1000); return { type, name: key, label, min, max, step, value: Math.min(max, Math.max(min, num(f.value, min))), unit: opt(f.unit, 12) }; }
    if (type === 'date') { const date = opt(f.value, 10); return { type, name: key, label, value: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined }; }
    return fail(`Field ${String(type).slice(0, 30)} belum didukung.`);
  }

  function visit(value: unknown, depth: number): UiNode {
    if (++nodes > RICH_LIMITS.nodes) fail('Komponen terlalu banyak.');
    if (depth > RICH_LIMITS.depth) fail('Komponen bersarang terlalu dalam.');
    if (!record(value)) fail('Komponen tidak valid.');
    const n = own(value as Record<string, unknown>), props = record(n.props) ? own(n.props) : n;
    const children = () => n.children === undefined && props.children === undefined ? [] : list(n.children ?? props.children, 'komponen').map(child => visit(child, depth + 1));
    switch (n.type) {
      case 'stack': case 'row': return { type: n.type, children: children() };
      case 'grid': return { type: 'grid', columns: Math.min(4, Math.max(1, Math.round(num(props.columns, 2)))), children: children() };
      case 'title': return { type: 'title', text: str(props.text ?? props.value, 300) };
      case 'text': return { type: 'text', text: str(props.text ?? props.value, 4000), tone: ['muted', 'success', 'danger'].includes(props.tone as string) ? props.tone as 'muted' : undefined, size: props.size === 'sm' ? 'sm' : undefined };
      case 'markdown': return { type: 'markdown', text: str(props.text ?? props.value, 20000) };
      case 'divider': return { type: 'divider' };
      case 'badge': return { type: 'badge', label: str(props.label ?? props.text, 80), tone: tone(props.tone) };
      case 'badges': return { type: 'badges', items: list(props.items, 'badge').map(item => record(item) ? { label: str(own(item).label, 80), tone: tone(item.tone) } : { label: str(item, 80), tone: 'default' as Tone }) };
      case 'card': return { type: 'card', title: str(props.title, 200), subtitle: opt(props.subtitle ?? props.description, 300), icon: icon(props.icon), badge: record(props.badge) ? { label: str(own(props.badge).label, 80), tone: tone(props.badge.tone) } : typeof props.badge === 'string' ? { label: str(props.badge, 80), tone: 'default' } : undefined, text: opt(props.text, 4000), children: children() };
      case 'callout': return { type: 'callout', tone: tone(props.tone), title: opt(props.title, 200), text: str(props.text, 4000) };
      case 'counter': { const min = props.min === undefined ? undefined : num(props.min, 0), max = props.max === undefined ? undefined : num(props.max, 100); return { type: 'counter', label: str(props.label ?? 'Counter', 120), value: num(props.value, 0), step: Math.abs(num(props.step, 1)) || 1, min, max }; }
      case 'form': { const submit = record(props.submit) ? own(props.submit) : undefined; return { type: 'form', title: opt(props.title, 200), fields: list(props.fields, 'field').map(field), submit: submit ? { label: str(submit.label ?? 'Submit', 80), message: opt(submit.message, 1000), compose: submit.compose === true } : undefined }; }
      case 'segmented': case 'tabs': { const items = list(props.options ?? props.items, 'tab').map(item => { if (!record(item)) fail('Tab tidak valid.'); const i = own(item as Record<string, unknown>); return { label: str(i.label ?? i.title, 60), content: str(i.content ?? i.text ?? '', 4000) }; }); if (!items.length) fail('Tab kosong.'); return { type: 'segmented', options: items.slice(0, 6) }; }
      case 'accordion': return { type: 'accordion', items: list(props.items, 'bagian').map(item => { if (!record(item)) fail('Bagian accordion tidak valid.'); const i = own(item as Record<string, unknown>); return { title: str(i.title, 200), content: str(i.content ?? i.text, 4000) }; }) };
      case 'carousel': return { type: 'carousel', items: list(props.items, 'slide').map(item => { if (!record(item)) fail('Slide tidak valid.'); const i = own(item as Record<string, unknown>); return { title: str(i.title, 120), text: opt(i.text ?? i.description, 600), icon: icon(i.icon) }; }) };
      case 'popover': case 'tooltip': return { type: 'popover', label: str(props.label ?? 'Info', 80), title: opt(props.title, 120), content: str(props.content ?? props.text, 1000) };
      case 'icons': return { type: 'icons', items: list(props.items, 'ikon').map(item => icon(item)).filter((item): item is string => !!item) };
      case 'images': case 'gallery': return { type: 'images', items: list(props.items, 'gambar').map(item => { if (!record(item)) fail('Gambar tidak valid.'); const i = own(item as Record<string, unknown>), src = safeUrl(str(i.src ?? i.url, 2000), true); if (!src) fail('Alamat gambar tidak aman.'); return { src, alt: str(i.alt ?? '', 200), caption: opt(i.caption, 200) }; }) };
      case 'writing': return { type: 'writing', label: str(props.label ?? 'Pesan', 40), title: opt(props.title, 200), text: str(props.text ?? props.content, 20000) };
      case 'file': { const fileName = str(props.name, 120).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_'); return { type: 'file', name: fileName || 'file.txt', description: opt(props.description, 200), content: str(props.content, 40000), mime: mimeFor(fileName) }; }
      case 'sources': return { type: 'sources', items: list(props.items, 'sumber').map(item => { if (!record(item)) fail('Sumber tidak valid.'); const i = own(item as Record<string, unknown>), url = safeUrl(str(i.url, 2000)); if (!url) fail('Alamat sumber tidak aman.'); return { title: str(i.title, 200), url, description: opt(i.description, 300) }; }) };
      default: return fail(`Komponen ${String(n.type).slice(0, 30)} belum didukung.`);
    }
  }
  try {
    const root = record(raw) && raw.version !== undefined && raw.version !== RICH_UI_VERSION ? fail('Versi komponen belum didukung.') : raw;
    return { ok: true, node: Array.isArray(root) ? visit({ type: 'stack', children: root }, 0) : visit(root, 0) };
  } catch (error) { return { ok: false, error: error instanceof Invalid ? error.message : 'Komponen tidak valid.' }; }
}

export function mimeFor(name: string) {
  const ext = name.toLowerCase().split('.').pop() || '';
  return ({ md: 'text/markdown', txt: 'text/plain', json: 'application/json', csv: 'text/csv', html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', ts: 'text/plain', py: 'text/x-python', xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml', sql: 'text/plain', svg: 'image/svg+xml' } as Record<string, string>)[ext] || 'text/plain';
}

/** ````file name="report.md" description="…"  — parse the fence info string of a downloadable file block. */
export function parseFileInfo(info: string): { name: string; description?: string } | null {
  const match = /^file(?::(\S+))?(.*)$/i.exec(info.trim()); if (!match) return null;
  const attrs: Record<string, string> = {};
  for (const [, key, quoted, bare] of match[2].matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)) attrs[key.toLowerCase()] = quoted ?? bare;
  const name = (match[1] || attrs.name || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);
  return name ? { name, description: attrs.description?.slice(0, 200) || attrs.desc?.slice(0, 200) } : null;
}
