import { useEffect, useState } from 'react';
import { clearDiagnosticLog, diagnosticReport, loadDiagnosticLog, type DiagnosticEntry } from '../lib/diagnosticLog';
import { downloadFile } from '../desktop/ClientCollections';
import { shareNativeDiagnostic } from './openAttachment';
import { Group, Row } from './SettingsCard';
import './logs.css';

export async function exportDiagnosticLog(onNotice: (message: string) => void) {
  try { const report = diagnosticReport(); if (!await shareNativeDiagnostic(report)) downloadFile('SuperGPT-logs.json', report, 'application/json'); }
  catch { onNotice('Ekspor log gagal. Coba salin log.'); }
}

const AREAS: [DiagnosticEntry['area'] | 'all', string][] = [['all', 'Semua'], ['chat', 'Chat dan API'], ['speech', 'Suara'], ['files', 'Lampiran'], ['app', 'Aplikasi']];
const areaName = (area: DiagnosticEntry['area']) => AREAS.find(([value]) => value === area)?.[1] ?? area;

export function MobileLogs({ onNotice }: { onNotice(message: string): void }) {
  const [entries, setEntries] = useState(loadDiagnosticLog), [filter, setFilter] = useState<DiagnosticEntry['area'] | 'all'>('all');
  const nativeFiles = !!(window as unknown as { SuperGPTFile?: unknown }).SuperGPTFile;
  useEffect(() => { const refresh = () => setEntries(loadDiagnosticLog()); window.addEventListener('client-log-changed', refresh); return () => window.removeEventListener('client-log-changed', refresh); }, []);
  const visible = entries.filter(e => filter === 'all' || e.area === filter).slice().reverse();
  const errors = visible.filter(e => e.level === 'error').length;
  return <div className="m-logs">
    <div className="m-log-chips" role="radiogroup" aria-label="Kategori log">{AREAS.map(([value, label]) => <button key={value} role="radio" aria-checked={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <Group>
      <Row icon="copy" title="Salin log" onClick={async () => { try { await navigator.clipboard.writeText(diagnosticReport()); onNotice('Log disalin.'); } catch { onNotice('Penyalinan tidak tersedia. Gunakan ekspor log.'); } }}/>
      <Row icon={nativeFiles ? 'share' : 'download'} title={nativeFiles ? 'Bagikan log' : 'Unduh log'} onClick={() => void exportDiagnosticLog(onNotice)}/>
      <Row icon="trash" title="Bersihkan log" disabled={!entries.length} onClick={clearDiagnosticLog}/>
    </Group>
    <Group title={`${visible.length} kejadian${errors ? ` · ${errors} error` : ''}`}>
      <ol className="m-log-list">{visible.map(entry => <li key={entry.id} className="m-setting-row" data-level={entry.level}>
        <i aria-label={entry.level === 'error' ? 'Error' : 'Info'}/>
        <span className="m-setting-label"><strong>{areaName(entry.area)} · {entry.event}</strong>
          <time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
          {Object.keys(entry.detail).length > 0 && <code>{Object.entries(entry.detail).map(([k, v]) => `${k}=${v}`).join(' · ')}</code>}</span>
      </li>)}</ol>
      {!visible.length && <p className="m-setting-empty">Belum ada log untuk kategori ini.</p>}
    </Group>
    <p className="m-setting-caption">300 kejadian terakhir di perangkat ini. Log tidak menyimpan API key, isi chat, rekaman suara, atau nama file.</p>
  </div>;
}
