import { ClientSwitch } from '../components/SDKPrimitives';
import { updateAction, useAppUpdates } from './appUpdates';
import { Group, Row } from './SettingsCard';
import './updates.css';

const STATUS: Record<string, string> = { idle: 'Belum diperiksa', checking: 'Memeriksa rilis terbaru…', current: 'Versi terbaru sudah terpasang', available: 'Pembaruan tersedia', downloading: 'Mengunduh pembaruan…', installing: 'Memasang pembaruan…', ready: 'Siap dipasang', error: 'Pembaruan gagal' };

export function MobileUpdates() {
  const state = useAppUpdates();
  const busy = state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing';
  const toggle = (key: 'autoCheck' | 'autoDownload' | 'autoInstall' | 'wifiOnly', label: string) => <Row title={label}><ClientSwitch label={label} value={state[key]} change={value => updateAction('configure', { [key]: value })}/></Row>;
  const action = state.phase === 'ready' ? { label: 'Pasang pembaruan', run: () => updateAction('install') }
    : state.phase === 'available' || (state.phase === 'error' && state.version) ? { label: 'Unduh ' + state.version, run: () => updateAction('download') }
    : { label: busy ? STATUS[state.phase] : 'Periksa pembaruan', run: () => updateAction('check') };
  return <section className="m-updates">
    <div className="m-update-hero" data-phase={state.phase}>
      <img src="/supergpt-logo.png" alt=""/>
      <h2>SuperGPT</h2>
      <p>{state.native ? 'Versi ' + (state.currentVersion || '—') : 'Preview browser'}</p>
      {state.native && <span className="m-update-status">{busy && <i aria-hidden="true"/>}{STATUS[state.phase]}{(state.phase === 'available' || state.phase === 'ready') && state.version ? ' · ' + state.version : ''}</span>}
      {state.native ? <button className="m-update-primary" disabled={busy} onClick={action.run}>{action.label}</button>
        : <p className="m-update-note">Pembaruan otomatis tersedia di aplikasi Android. Preview browser tidak memasang aplikasi.</p>}
      {state.native && state.message && state.phase !== 'checking' && <p className="m-update-note" role="status">{state.message}</p>}
      {state.lastChecked > 0 && <p className="m-update-note">Diperiksa {new Date(state.lastChecked).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
    </div>
    {state.native && <Group title="Otomatis">{toggle('autoCheck', 'Periksa otomatis')}{toggle('autoDownload', 'Unduh otomatis')}{toggle('autoInstall', 'Pasang otomatis')}{toggle('wifiOnly', 'Hanya lewat Wi-Fi')}</Group>}
    <Group title="Sumber"><Row icon="globe" title="Rilis stabil GitHub" detail="SuperGPT.apk"/></Group>
    <p className="m-setting-caption">Pemeriksaan dan unduhan berjalan di latar belakang. Pemasangan otomatis dicoba di Android 12+ saat aplikasi tidak digunakan dan tidak ada chat aktif; Android tetap bisa meminta konfirmasi. Sebelum dipasang, APK diperiksa ukuran, SHA-256, versi, identitas paket, dan sertifikatnya.</p>
  </section>;
}
export function MobileUpdateBanner() {
  const state = useAppUpdates();
  if (state.phase !== 'ready') return null;
  return <aside className="m-update-banner" aria-label="Pembaruan tersedia"><span>SuperGPT {state.version} siap dipasang</span><button onClick={() => updateAction('install')}>Pasang</button></aside>;
}
