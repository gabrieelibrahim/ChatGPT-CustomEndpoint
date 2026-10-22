import { useEffect, useMemo, useState } from 'react';
import { clearUsage, loadUsage, type UsageEntry } from '../lib/clientSettings';
import { loadEndpointKeys, loadEndpointStore } from '../lib/endpointProfiles';
import { fetchAccountLimits, publishesAccountLimits, type AccountLimits } from '../lib/accountLimits';
import { Group, Row } from './SettingsCard';
import './usage.css';

const DAY = 86_400_000;
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('id-ID');
const tokens = (n: number) => compact.format(n) + ' token';
const total = (e: UsageEntry) => (e.input ?? 0) + (e.output ?? 0);
const reported = (e: UsageEntry) => e.input !== undefined || e.output !== undefined;
const startOfDay = (time: number) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Real token counts the providers reported for each answer on this device, plus the account's own limits when the
 * endpoint publishes them (Sakelar). Nothing is estimated. */
export function MobileUsage({ onEndpoint }: { onEndpoint(): void }) {
  const [entries, setEntries] = useState(loadUsage);
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => { const refresh = () => setEntries(loadUsage()); window.addEventListener('client-usage-changed', refresh); return () => window.removeEventListener('client-usage-changed', refresh); }, []);

  const store = loadEndpointStore(), endpoint = store.profiles.find(p => p.id === store.selectedId);
  const [limits, setLimits] = useState<AccountLimits | null>(null), [limitsError, setLimitsError] = useState(''), [loading, setLoading] = useState(false);
  const loadLimits = () => {
    if (!endpoint || !publishesAccountLimits(endpoint)) return () => {};
    const controller = new AbortController(); setLoading(true); setLimitsError('');
    fetchAccountLimits(endpoint, loadEndpointKeys(store.profiles)[endpoint.id] || '', AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(setLimits, error => { if (!controller.signal.aborted) setLimitsError(error instanceof Error ? error.message : 'Data batasan belum dapat dimuat.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  };
  useEffect(loadLimits, [endpoint?.id]);

  const today = startOfDay(Date.now());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const from = today - (6 - i) * DAY, items = entries.filter(e => e.time >= from && e.time < from + DAY);
    return { from, tokens: items.reduce((sum, e) => sum + total(e), 0), runs: items.length };
  }), [entries, today]);
  const week = entries.filter(e => e.time >= today - 6 * DAY);
  const weekIn = week.reduce((s, e) => s + (e.input ?? 0), 0), weekOut = week.reduce((s, e) => s + (e.output ?? 0), 0);
  const peak = Math.max(1, ...days.map(d => d.tokens));
  const picked = days.find(d => d.from === day) ?? null;
  const models = useMemo(() => {
    const map = new Map<string, { tokens: number; runs: number }>();
    for (const e of week) { const m = map.get(e.model) ?? { tokens: 0, runs: 0 }; m.tokens += total(e); m.runs++; map.set(e.model, m); }
    return [...map].sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 8);
  }, [week]);
  const unreported = week.filter(e => !reported(e)).length;
  const weekday = (time: number) => new Date(time).toLocaleDateString('id-ID', { weekday: 'short' }).replace('.', '');

  return <div className="m-usage">
    <section className="m-usage-hero" aria-label="Ringkasan 7 hari">
      <span>{picked ? new Date(picked.from).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) : '7 hari terakhir'}</span>
      <strong>{full.format(picked ? picked.tokens : weekIn + weekOut)}<small> token</small></strong>
      <p>{picked ? `${picked.runs} jawaban` : `${full.format(weekIn)} input · ${full.format(weekOut)} output · ${week.length} jawaban`}</p>
      <div className="m-usage-bars" role="list" aria-label="Token per hari">
        {days.map(d => <button key={d.from} role="listitem" aria-pressed={d.from === day} aria-label={`${weekday(d.from)}: ${full.format(d.tokens)} token`} onClick={() => setDay(d.from === day ? null : d.from)}>
          <i style={{ height: d.tokens ? Math.max(6, d.tokens / peak * 100) + '%' : '2px' }}/><span>{d.from === today ? 'Hari ini' : weekday(d.from)}</span>
        </button>)}
      </div>
    </section>

    {endpoint && publishesAccountLimits(endpoint) ? <Group title="Batasan akun Sakelar">
      {limits ? <>
        <Row icon="lightning" title="Sisa kuota" detail={tokens(limits.balanceTokens)}/>
        <Row icon="clock" title="Berlaku sampai" detail={limits.expiresAt ? new Date(limits.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}/>
        <Row icon="bars" title="Terpakai 24 jam" detail={tokens(limits.billedTokens24h)}/>
        <Row icon="refresh" title={loading ? 'Memperbarui…' : 'Perbarui'} onClick={loading ? undefined : () => void loadLimits()}/>
      </> : <Row icon={limitsError ? 'info' : 'refresh'} title={limitsError || 'Memuat batasan akun…'} onClick={limitsError ? () => void loadLimits() : undefined}/>}
    </Group> : <Group title="Batasan">
      <Row icon="globe" title="Kuota dan tagihan" detail={endpoint ? 'Dikelola ' + endpoint.name : 'Belum ada endpoint'} onClick={onEndpoint}/>
    </Group>}
    {limits?.stale && <p className="m-setting-caption">Angka kuota dari pembacaan terakhir; server penyedia sedang lambat.</p>}

    <Group title="Model teratas · 7 hari">
      {models.map(([model, m]) => <div className="m-setting-row m-usage-model" key={model}><span className="m-setting-label">{model}<small>{m.runs} jawaban</small></span><span className="m-setting-detail">{tokens(m.tokens)}</span><i style={{ width: m.tokens / Math.max(1, models[0][1].tokens) * 100 + '%' }} aria-hidden="true"/></div>)}
      {!models.length && <p className="m-setting-empty">Belum ada jawaban dalam 7 hari terakhir.</p>}
    </Group>

    <Group title="Terbaru">
      {entries.slice(-12).reverse().map(e => <div className="m-setting-row m-usage-run" key={e.id}><span className="m-setting-label">{e.model}<small>{new Date(e.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.status !== 'completed' ? ' · ' + (e.status === 'failed' ? 'gagal' : e.status === 'interrupted' ? 'dihentikan' : e.status) : ''}</small></span><span className="m-setting-detail">{reported(e) ? `${full.format(e.input ?? 0)} / ${full.format(e.output ?? 0)}` : 'Tidak dilaporkan'}</span></div>)}
      {!entries.length && <p className="m-setting-empty">Belum ada penggunaan tercatat.</p>}
    </Group>

    <p className="m-setting-caption">Token dihitung dari laporan penyedia di setiap jawaban (input / output), untuk semua endpoint. {unreported ? `${unreported} jawaban minggu ini tidak menyertakan laporan token dan tidak dihitung.` : 'Tidak ada angka yang diperkirakan.'}</p>
    {entries.length > 0 && <Group><Row icon="trash" title="Hapus riwayat penggunaan" onClick={clearUsage}/></Group>}
  </div>;
}
