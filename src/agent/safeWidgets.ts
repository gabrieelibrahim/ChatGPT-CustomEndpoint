export type SafeWidget = { type: string; value?: string; label?: string; key?: string; children?: SafeWidget[]; action?: { type: 'checklist.copy' | 'tool.approve'; text?: string; callId?: string; allow?: boolean } };
const containers = new Set(['Basic', 'Card', 'Box', 'Row', 'Col', 'ListView', 'ListViewItem', 'Table', 'TableRow', 'TableCell']);
const texts = new Set(['Text', 'Title', 'Caption', 'Markdown', 'Badge']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Accept only display data and the two explicitly implemented, user-click actions. */
export function sanitizeWidget(input: unknown): SafeWidget {
  const seen = new WeakSet<object>(); let nodes = 0, characters = 0;
  function visit(value: unknown, depth: number): SafeWidget {
    if (++nodes > 256 || depth > 10 || !record(value) || seen.has(value)) throw Error('Struktur komponen terlalu besar atau tidak valid.');
    seen.add(value);
    const text = (v: unknown, max = 20000) => { if (typeof v !== 'string' || v.length > max) throw Error('Teks komponen tidak valid.'); characters += v.length; if (characters > 100000) throw Error('Isi komponen terlalu besar.'); return v; };
    const type = text(value.type, 80), key = typeof value.key === 'string' ? value.key.slice(0, 100) : undefined;
    if (containers.has(type)) {
      if (value.children !== undefined && !Array.isArray(value.children)) throw Error('Daftar komponen tidak valid.');
      const children = (value.children as unknown[] || []).map(child => visit(child, depth + 1));
      if (type === 'Table' && children.some(child => child.type !== 'TableRow') || type === 'TableRow' && children.some(child => child.type !== 'TableCell')) throw Error('Struktur tabel komponen tidak valid.');
      if (type !== 'Table' && children.some(child => child.type === 'TableRow') || type !== 'TableRow' && children.some(child => child.type === 'TableCell')) throw Error('Posisi baris atau sel tabel tidak valid.');
      return { type, key, children };
    }
    if (texts.has(type)) return { type, key, value: text(value.value ?? value.label) };
    if (type === 'Divider' || type === 'Spacer') return { type, key };
    if (type === 'Button') {
      const label = text(value.label, 300), action = value.onClickAction;
      if (record(action) && record(action.payload)) {
        if (action.type === 'checklist.copy' && typeof action.payload.text === 'string') return { type, key, label, action: { type: 'checklist.copy', text: text(action.payload.text) } };
        if (action.type === 'tool.approve' && typeof action.payload.callId === 'string' && typeof action.payload.allow === 'boolean') return { type, key, label, action: { type: 'tool.approve', callId: text(action.payload.callId, 200), allow: action.payload.allow } };
      }
      return { type, key, label };
    }
    return { type: 'Unsupported', key, label: `Komponen ${type} belum didukung.` };
  }
  try { return visit(input, 0); } catch (error) { return { type: 'Unsupported', label: error instanceof Error ? error.message : 'Komponen tidak valid.' }; }
}
