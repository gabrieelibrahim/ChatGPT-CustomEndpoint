import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CHART_COLORS, formatChartValue, niceTicks, parseChart, type ChartSpec } from './chart';
import { RichIcon } from './RichIcon';

const H = 260, PAD = { top: 26, right: 12, bottom: 30, left: 44 };

// Monotone cubic (Fritsch–Carlson): smooth like the reference without overshooting the data.
function smoothPath(points: [number, number][]) {
  if (points.length < 3) return points.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
  const n = points.length, dx = [], m = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = points[i + 1][0] - points[i][0]; m[i] = (points[i + 1][1] - points[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = 'M' + points[0][0] + ' ' + points[0][1];
  for (let i = 0; i < n - 1; i++) { const [x0, y0] = points[i], [x1, y1] = points[i + 1], h = dx[i] / 3; d += ` C${x0 + h} ${y0 + h * t[i]} ${x1 - h} ${y1 - h * t[i + 1]} ${x1} ${y1}`; }
  return d;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(340);
  useEffect(() => { const el = ref.current; if (!el) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width)))); observer.observe(el); return () => observer.disconnect(); }, []);
  return [ref, width] as const;
}

function Cartesian({ chart, width }: { chart: ChartSpec; width: number }) {
  const count = chart.labels.length, values = chart.series.flatMap(series => series.data.filter(Number.isFinite));
  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values), 5), lo = ticks[0], hi = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom, bar = chart.kind === 'bar';
  const x = (i: number) => PAD.left + (bar ? (i + 0.5) * plotW / count : count === 1 ? plotW / 2 : i * plotW / (count - 1));
  const y = (v: number) => PAD.top + plotH - (v - lo) / (hi - lo || 1) * plotH;
  const [active, setActive] = useState(count - 1);
  const pick = (clientX: number, rect: DOMRect) => { const px = (clientX - rect.left) / rect.width * width; setActive(Math.max(0, Math.min(count - 1, Math.round(bar ? (px - PAD.left) / (plotW / count) - 0.5 : (px - PAD.left) / (plotW / Math.max(1, count - 1)))))); };
  const every = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 64))));
  return <>
    <div className="r-chart-legend">{chart.series.map((series, s) => <div key={s} style={{ ['--r-series' as string]: series.color || CHART_COLORS[s % CHART_COLORS.length] }}><span>{series.name}</span><strong>{Number.isFinite(series.data[active]) ? formatChartValue(series.data[active], chart.unit) : '–'}</strong></div>)}</div>
    <svg className="r-chart-svg" viewBox={`0 0 ${width} ${H}`} role="img" aria-label={(chart.title || 'Grafik') + ': ' + chart.series.map(series => series.name + ' ' + series.data.map((v, i) => chart.labels[i] + ' ' + v).join(', ')).join('; ')}
      onPointerDown={event => { pick(event.clientX, event.currentTarget.getBoundingClientRect()); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ } }}
      onPointerMove={event => { if (event.buttons || event.pointerType === 'mouse') pick(event.clientX, event.currentTarget.getBoundingClientRect()); }}>
      {ticks.map(tick => <g key={tick}><line className="r-chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)}/><text className="r-chart-axis" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">{formatChartValue(tick, chart.unit === '%' ? '%' : '')}</text></g>)}
      {chart.labels.map((label, i) => (i % every === 0 || i === count - 1) && <text key={i} className={'r-chart-axis' + (i === active ? ' r-chart-axis-active' : '')} x={x(i)} y={H - 8} textAnchor={i === 0 && !bar ? 'start' : i === count - 1 && !bar ? 'end' : 'middle'}>{label}</text>)}
      {!bar && <line className="r-chart-cursor" x1={x(active)} x2={x(active)} y1={PAD.top - 14} y2={PAD.top + plotH}/>}
      {!bar && <text className="r-chart-cursor-label" x={x(active)} y={PAD.top - 16} textAnchor={active === 0 ? 'start' : active === count - 1 ? 'end' : 'middle'}>{chart.labels[active]}</text>}
      {chart.series.map((series, s) => {
        const color = series.color || CHART_COLORS[s % CHART_COLORS.length], points = series.data.map((v, i) => [x(i), y(v)] as [number, number]).filter(([, py]) => Number.isFinite(py));
        if (bar) { const group = plotW / count * 0.7, w = Math.max(2, group / chart.series.length - 2); return <g key={s}>{series.data.map((v, i) => Number.isFinite(v) && <rect key={i} className={i === active ? 'r-bar-active' : undefined} x={x(i) - group / 2 + s * (w + 2)} y={Math.min(y(v), y(0))} width={w} height={Math.abs(y(v) - y(0))} rx={Math.min(4, w / 2)} fill={color}/>)}</g>; }
        const line = smoothPath(points);
        return <g key={s}>{chart.kind === 'area' && <path d={line + ` L${points[points.length - 1][0]} ${y(lo)} L${points[0][0]} ${y(lo)} Z`} fill={color} opacity={0.14}/>}<path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"/>{Number.isFinite(series.data[active]) && <circle cx={x(active)} cy={y(series.data[active])} r={5} fill={color} stroke="var(--r-surface)" strokeWidth={2}/>}</g>;
      })}
    </svg></>;
}

function Pie({ chart, width }: { chart: ChartSpec; width: number }) {
  const data = chart.series[0].data.map(v => Math.max(0, v || 0)), total = data.reduce((a, b) => a + b, 0) || 1, size = Math.min(220, width - 24), r = size / 2 - 4, inner = chart.kind === 'donut' ? r * 0.58 : 0;
  const [active, setActive] = useState(0); let angle = -Math.PI / 2;
  const arc = (start: number, end: number) => { const large = end - start > Math.PI ? 1 : 0, p = (a: number, radius: number) => `${size / 2 + radius * Math.cos(a)} ${size / 2 + radius * Math.sin(a)}`; return inner ? `M${p(start, r)} A${r} ${r} 0 ${large} 1 ${p(end, r)} L${p(end, inner)} A${inner} ${inner} 0 ${large} 0 ${p(start, inner)} Z` : `M${size / 2} ${size / 2} L${p(start, r)} A${r} ${r} 0 ${large} 1 ${p(end, r)} Z`; };
  return <div className="r-pie"><svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={(chart.title || 'Grafik lingkaran') + ': ' + chart.labels.map((label, i) => label + ' ' + data[i]).join(', ')}>
    {data.map((value, i) => { const start = angle, end = angle + (value / total) * Math.PI * 2 * 0.99999; angle = end; return value > 0 && <path key={i} d={arc(start, end)} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={i === active ? 1 : 0.82} stroke="var(--r-surface)" strokeWidth={2} onPointerDown={() => setActive(i)}/>; })}
    {inner > 0 && <text className="r-pie-center" x={size / 2} y={size / 2 + 6} textAnchor="middle">{Math.round(data[active] / total * 100)}%</text>}</svg>
    <ul className="r-pie-legend">{chart.labels.map((label, i) => <li key={i} aria-current={i === active} onClick={() => setActive(i)}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/><span>{label}</span><strong>{formatChartValue(data[i], chart.unit)}</strong><small>{Math.round(data[i] / total * 100)}%</small></li>)}</ul></div>;
}

function Scatter({ chart, width }: { chart: ChartSpec; width: number }) {
  const points = chart.points!, xs = niceTicks(Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0])), 5), ys = niceTicks(Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1])), 5);
  const plotW = width - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const x = (v: number) => PAD.left + (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1) * plotW, y = (v: number) => PAD.top + plotH - (v - ys[0]) / (ys[ys.length - 1] - ys[0] || 1) * plotH;
  return <svg className="r-chart-svg" viewBox={`0 0 ${width} ${H}`} role="img" aria-label={chart.title || 'Grafik sebar'}>
    {ys.map(t => <g key={'y' + t}><line className="r-chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)}/><text className="r-chart-axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{formatChartValue(t)}</text></g>)}
    {xs.map(t => <text key={'x' + t} className="r-chart-axis" x={x(t)} y={H - 8} textAnchor="middle">{formatChartValue(t)}</text>)}
    {points.map(([px, py], i) => <circle key={i} cx={x(px)} cy={y(py)} r={4.5} fill={CHART_COLORS[0]} opacity={0.8}><title>{px}, {py}</title></circle>)}</svg>;
}

export const ChartBlock = memo(function ChartBlock({ source, streaming }: { source: string; streaming: boolean }) {
  const result = useMemo(() => parseChart(source), [source]), [ref, width] = useWidth(), [table, setTable] = useState(false);
  if (!result.ok) return streaming ? <div className="r-skeleton r-chart-skeleton" role="status" aria-label="Menyiapkan grafik"><span/><span/></div> : <div className="r-invalid" role="note"><strong>Grafik tidak dapat ditampilkan</strong><small>{result.error}</small><pre>{source.slice(0, 2000)}</pre></div>;
  const chart = result.chart;
  return <figure className="r-chart" ref={ref}>
    {(chart.title || chart.subtitle) && <figcaption>{chart.title && <strong>{chart.title}</strong>}{chart.subtitle && <small>{chart.subtitle}</small>}</figcaption>}
    {chart.kind === 'pie' || chart.kind === 'donut' ? <Pie chart={chart} width={width}/> : chart.kind === 'scatter' ? <Scatter chart={chart} width={width}/> : <Cartesian chart={chart} width={width}/>}
    {chart.kind !== 'scatter' && <button type="button" className="r-chart-toggle" aria-expanded={table} onClick={() => setTable(value => !value)}><RichIcon name="chart" size={16}/>{table ? 'Sembunyikan data' : 'Lihat data'}</button>}
    {table && <div className="r-chart-table"><table><thead><tr><th/>{chart.series.map((series, s) => <th key={s}>{series.name}</th>)}</tr></thead><tbody>{chart.labels.map((label, i) => <tr key={i}><td>{label}</td>{chart.series.map((series, s) => <td key={s}>{Number.isFinite(series.data[i]) ? formatChartValue(series.data[i], chart.unit) : '–'}</td>)}</tr>)}</tbody></table></div>}
  </figure>;
});
