// ```chart blocks: validated data only. Rendering is plain SVG; no chart code from the model runs.
export type ChartKind = 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'scatter';
export type ChartSeries = { name: string; data: number[]; color?: string };
export type ChartSpec = { kind: ChartKind; title?: string; subtitle?: string; unit?: string; labels: string[]; series: ChartSeries[]; points?: [number, number][] };
export type ChartResult = { ok: true; chart: ChartSpec } | { ok: false; error: string };

export const CHART_COLORS = ['#3b82f6', '#10a37f', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];
const kinds: ChartKind[] = ['line', 'area', 'bar', 'pie', 'donut', 'scatter'];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, max) : undefined;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : NaN;
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;

export function parseChart(source: string): ChartResult {
  if (source.length > 60_000) return { ok: false, error: 'Data grafik terlalu besar.' };
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { return { ok: false, error: 'Data grafik belum lengkap atau tidak valid.' }; }
  if (!record(raw)) return { ok: false, error: 'Data grafik tidak valid.' };
  const kind = kinds.includes(raw.type as ChartKind) ? raw.type as ChartKind : kinds.includes(raw.kind as ChartKind) ? raw.kind as ChartKind : 'line';
  const base = { kind, title: text(raw.title, 160), subtitle: text(raw.subtitle ?? raw.description, 240), unit: text(raw.unit, 16) };
  if (kind === 'scatter') {
    const points = (Array.isArray(raw.points) ? raw.points : Array.isArray(raw.data) ? raw.data : []).slice(0, 500).map(point => Array.isArray(point) ? [number(point[0]), number(point[1])] : record(point) ? [number(point.x), number(point.y)] : [NaN, NaN]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) as [number, number][];
    if (!points.length) return { ok: false, error: 'Grafik sebar belum berisi titik.' };
    return { ok: true, chart: { ...base, labels: [], series: [{ name: text(raw.name, 60) || 'Data', data: [] }], points } };
  }
  let labels = Array.isArray(raw.labels) ? raw.labels.slice(0, 200).map(label => text(label, 40) ?? '') : [];
  let series: ChartSeries[] = [];
  if (Array.isArray(raw.series)) series = raw.series.slice(0, 8).filter(record).map((item, index) => ({ name: text(item.name, 60) || 'Seri ' + (index + 1), data: (Array.isArray(item.data) ? item.data : []).slice(0, 200).map(number), color: color(item.color) }));
  else if (Array.isArray(raw.data)) {
    // [{label, value}] or plain numbers.
    const rows = raw.data.slice(0, 200);
    if (rows.every(record)) { labels = rows.map(row => text((row as Record<string, unknown>).label ?? (row as Record<string, unknown>).name, 40) ?? ''); series = [{ name: text(raw.name, 60) || 'Nilai', data: rows.map(row => number((row as Record<string, unknown>).value)) }]; }
    else series = [{ name: text(raw.name, 60) || 'Nilai', data: rows.map(number) }];
  }
  series = series.filter(item => item.data.some(Number.isFinite));
  if (!series.length) return { ok: false, error: 'Grafik belum berisi data angka.' };
  const length = Math.max(...series.map(item => item.data.length));
  labels = Array.from({ length }, (_, index) => labels[index] ?? String(index + 1));
  if ((kind === 'pie' || kind === 'donut') && series[0].data.some(value => value < 0)) return { ok: false, error: 'Grafik lingkaran tidak menerima nilai negatif.' };
  return { ok: true, chart: { ...base, labels, series } };
}

/** Rounded axis ticks (1/2/2.5/5 × 10^n) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { const pad = Math.abs(min) || 1; min -= pad; max += pad; }
  const raw = (max - min) / Math.max(1, count - 1), power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(value => value >= raw)!;
  const start = Math.floor(min / step) * step, ticks: number[] = [];
  for (let value = start; value <= max + step * 0.5 && ticks.length < 12; value += step) ticks.push(Number(value.toPrecision(12)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(12)));
  return ticks;
}

const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
export function formatChartValue(value: number, unit = '') {
  const body = Math.abs(value) >= 10_000 ? compact.format(value) : plain.format(value);
  return unit === '%' ? body + '%' : unit === '$' || unit === 'Rp' ? (unit === 'Rp' ? 'Rp' + body : '$' + body) : unit ? body + ' ' + unit : body;
}
