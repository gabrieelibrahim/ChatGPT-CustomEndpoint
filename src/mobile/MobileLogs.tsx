import { useEffect, useState } from 'react';
import { clearDiagnosticLog, diagnosticReport, loadDiagnosticLog } from '../lib/diagnosticLog';
import { downloadFile } from '../desktop/ClientCollections';
import { shareNativeDiagnostic } from './openAttachment';

export async function exportDiagnosticLog(onNotice: (message: string) => void) {
  try { const report = diagnosticReport(); if (!await shareNativeDiagnostic(report)) downloadFile('SuperGPT-logs.json', report, 'application/json'); }
  catch { onNotice('Ekspor log gagal. Coba salin log.'); }
}

export function MobileLogs({ onNotice }: { onNotice(message: string): void }) {
  const [entries, setEntries] = useState(loadDiagnosticLog), [filter, setFilter] = useState('all');
  const nativeFiles = !!(window as unknown as { SuperGPTFile?: unknown }).SuperGPTFile;
  useEffect(() => { const refresh = () => setEntries(loadDiagnosticLog()); window.addEventListener('client-log-changed', refresh); return () => window.removeEventListener('client-log-changed', refresh); }, []);
  const visible = entries.filter(e => filter === 'all' || e.area === filter).slice().reverse();
  return <div className="m-logs"><p className="m-setting-caption">300 kejadian terakhir di perangkat. Log tidak menyimpan API key, isi chat, rekaman suara, atau nama file.</p>
    <label className="m-log-filter">Kategori<select aria-label="Kategori log" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Semua</option><option value="speech">Dikte dan suara</option><option value="chat">Chat dan API</option><option value="files">Lampiran</option><option value="app">Aplikasi</option></select></label>
    <div className="m-log-actions"><button onClick={async () => { try { await navigator.clipboard.writeText(diagnosticReport()); onNotice('Log disalin.'); } catch { onNotice('Penyalinan tidak tersedia. Gunakan ekspor log.'); } }}>Salin</button><button onClick={() => void exportDiagnosticLog(onNotice)}>{nativeFiles ? 'Bagikan log' : 'Unduh'}</button><button disabled={!entries.length} onClick={clearDiagnosticLog}>Bersihkan</button></div>
    <p className="m-setting-caption" role="status">{visible.length} kejadian</p><ol className="m-log-list">{visible.map(entry => <li key={entry.id} data-level={entry.level}><time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleString('id-ID')}</time><strong>{entry.area} · {entry.event}</strong><code>{Object.entries(entry.detail).map(([k, v]) => `${k}=${v}`).join(' · ')}</code></li>)}</ol>{!visible.length && <p className="m-setting-empty">Belum ada log untuk kategori ini.</p>}
  </div>;
}
