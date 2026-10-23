const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
function load(entry, name) {
  const result = buildSync({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'mermaid'] });
  const mod = new Module(path.join(__dirname, name), module); mod.filename = path.join(__dirname, name); mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename); return mod.exports;
}
const schema = load('src/rich/schema.ts', 'rich-schema-fixture.cjs');
const chart = load('src/rich/chart.ts', 'rich-chart-fixture.cjs');
const { default: Renderer } = load('src/components/RichTextRenderer.tsx', 'rich-renderer-fixture.cjs');
const render = (text, streaming = false) => renderToStaticMarkup(React.createElement(Renderer, { text, streaming }));
const ui = value => '```ui\n' + JSON.stringify(value) + '\n```';

test('ui schema keeps allowlisted components and props only', () => {
  const result = schema.parseUiBlock(JSON.stringify({ version: '1.0', type: 'card', props: { title: 'Sakelar API', description: 'AI Gateway', status: 'active', onClick: 'alert(1)', badge: { label: 'Online', tone: 'success' }, icon: 'cpu' } }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.node, { type: 'card', title: 'Sakelar API', subtitle: 'AI Gateway', icon: 'cpu', badge: { label: 'Online', tone: 'success' }, text: undefined, children: [] });
  const form = schema.parseUiBlock(JSON.stringify({ type: 'form', fields: [{ type: 'slider', name: 'x', label: 'X', min: 0, max: 10, value: 99 }, { type: 'radio', name: 'm', label: 'M', options: ['A', 'B'], value: 'Z' }, { type: 'date', name: 'd', label: 'D', value: 'tomorrow' }] }));
  assert.equal(form.node.fields[0].value, 10); assert.equal(form.node.fields[1].value, 'A'); assert.equal(form.node.fields[2].value, undefined);
});

test('ui schema rejects scripts in URLs, prototype keys, unknown components, deep or oversized trees and other versions', () => {
  const bad = value => schema.parseUiBlock(typeof value === 'string' ? value : JSON.stringify(value));
  assert.match(bad({ type: 'images', items: [{ src: 'javascript:alert(1)', alt: 'x' }] }).error, /tidak aman/);
  assert.match(bad({ type: 'images', items: [{ src: 'data:image/svg+xml,<svg onload=alert(1)>', alt: 'x' }] }).error, /tidak aman/);
  assert.match(bad({ type: 'sources', items: [{ title: 'x', url: 'https://user:pass@example.com' }] }).error, /tidak aman/);
  assert.match(bad('{"type":"text","text":"x","__proto__":{"polluted":true}}').error, /tidak diizinkan/);
  assert.equal({}.polluted, undefined);
  assert.match(bad({ type: 'script', text: 'alert(1)' }).error, /belum didukung/);
  let deep = { type: 'text', text: 'leaf' }; for (let i = 0; i < 12; i++) deep = { type: 'stack', children: [deep] };
  assert.match(bad(deep).error, /terlalu dalam/);
  assert.match(bad({ type: 'stack', children: Array.from({ length: 50 }, () => ({ type: 'row', children: Array.from({ length: 5 }, () => ({ type: 'divider' })) })) }).error, /terlalu banyak/);
  assert.match(bad('x'.repeat(100001)).error, /terlalu besar/);
  assert.match(bad({ version: '9.0', type: 'divider' }).error, /Versi/);
  assert.match(bad('{"type":"card","title":').error, /belum lengkap/);
});

test('chart data is validated and axis values are rounded and formatted', () => {
  const line = chart.parseChart(JSON.stringify({ type: 'line', labels: ['Sen', 'Sel'], series: [{ name: 'Token', data: [1200000, '4700000'] }] }));
  assert.equal(line.ok, true); assert.deepEqual(line.chart.series[0].data, [1200000, 4700000]);
  const rows = chart.parseChart(JSON.stringify({ type: 'pie', data: [{ label: 'A', value: 3 }, { label: 'B', value: 1 }] }));
  assert.deepEqual(rows.chart.labels, ['A', 'B']);
  assert.equal(chart.parseChart(JSON.stringify({ type: 'pie', labels: ['A'], series: [{ data: [-1] }] })).ok, false);
  assert.equal(chart.parseChart('{"type":"bar"').ok, false);
  assert.equal(chart.parseChart(JSON.stringify({ type: 'scatter', points: [[1, 2], ['x', 3]] })).chart.points.length, 1);
  assert.deepEqual(chart.niceTicks(0, 4700000, 5), [0, 2000000, 4000000, 6000000]); assert.deepEqual(chart.niceTicks(0, 510, 5), [0, 200, 400, 600]);
  assert.equal(chart.formatChartValue(4700000).replace(/\s/g, ' '), '4,7 jt');
  assert.equal(chart.formatChartValue(55, '%'), '55%');
});

test('file fences name a safe download', () => {
  assert.deepEqual(schema.parseFileInfo('file name="Laporan Q3.md" description="Ringkasan"'), { name: 'Laporan Q3.md', description: 'Ringkasan' });
  assert.deepEqual(schema.parseFileInfo('file:../../etc/passwd'), { name: '.._.._etc_passwd', description: undefined });
  assert.equal(schema.parseFileInfo('file'), null);
});

test('rich fences render components, charts and files inside a normal Markdown answer', () => {
  const html = render('Halo **dunia**\n\n' + ui({ type: 'counter', label: 'Counter', value: 3 }) + '\n\n```chart\n{"type":"bar","labels":["A","B"],"series":[{"name":"N","data":[1,2]}]}\n```\n\n````file name="catatan.md" description="Contoh"\n# Judul\n````\n');
  assert.ok(html.includes('<strong>dunia</strong>'));
  assert.ok(html.includes('r-counter') && html.includes('>3<'));
  assert.ok(html.includes('r-chart-svg') && html.includes('aria-label="Grafik: N A 1, B 2"'));
  assert.ok(html.includes('catatan.md') && html.includes('Download File Markdown'));
});

test('an unfinished rich block shows a placeholder while streaming and a readable error afterwards', () => {
  const partial = 'Berikut kartunya:\n\n```ui\n{"type":"card","title":"Sak';
  assert.ok(render(partial, true).includes('r-skeleton'));
  const done = render(partial, false); assert.ok(done.includes('r-invalid') && done.includes('Komponen tidak dapat ditampilkan'));
  // Only the block still being written is treated as live.
  const earlier = render('```ui\n{"type":\n```\n\nTeks lanjutan', true); assert.ok(earlier.includes('r-invalid'));
});

test('component text cannot inject HTML or active links', () => {
  const html = render(ui([{ type: 'text', text: '<img src=x onerror=alert(1)>' }, { type: 'markdown', text: '[klik](javascript:alert(1)) <b>tebal</b>' }, { type: 'writing', label: 'Pesan', text: '<script>alert(1)</script>' }]));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('javascript:') && !html.includes('<b>') && !html.includes('<script>'));
});
