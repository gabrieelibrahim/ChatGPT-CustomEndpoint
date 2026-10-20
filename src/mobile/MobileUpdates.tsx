import { ClientSwitch } from '../components/SDKPrimitives';
import { updateAction, useAppUpdates } from './appUpdates';
import './updates.css';

export function MobileUpdates() {
  const state = useAppUpdates();
  const toggle = (key: 'autoCheck' | 'autoDownload' | 'autoInstall' | 'wifiOnly', label: string) => <label className="m-update-toggle"><span>{label}</span><ClientSwitch label={label} value={state[key]} change={value => updateAction('configure', { [key]: value })}/></label>;
  return <section className="m-updates"><p className="m-setting-caption">Rilis stabil dari GitHub SuperGPT. File pembaruan selalu bernama SuperGPT.apk.</p>
    {state.native ? <><p>Versi terpasang: {state.currentVersion}</p><div className="m-setting-card">{toggle('autoCheck', 'Periksa otomatis')}{toggle('autoDownload', 'Unduh otomatis')}{toggle('autoInstall', 'Pasang otomatis jika diizinkan Android')}{toggle('wifiOnly', 'Unduh hanya lewat Wi-Fi')}</div>
      <p role="status">{state.phase === 'checking' ? 'Memeriksa rilis terbaru…' : state.message || 'Belum ada pemeriksaan.'}</p>
      {state.lastChecked > 0 && <p className="m-setting-caption">Diperiksa {new Date(state.lastChecked).toLocaleString('id-ID')}</p>}
      <div className="m-update-actions"><button disabled={state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing'} onClick={() => updateAction('check')}>Periksa sekarang</button>
      {(state.phase === 'available' || state.phase === 'error' && state.version) && <button onClick={() => updateAction('download')}>Unduh {state.version}</button>}
      {state.phase === 'ready' && <button onClick={() => updateAction('install')}>Pasang pembaruan</button>}</div>
      <p className="m-setting-caption">Pemeriksaan dan unduhan berjalan di latar belakang. Pemasangan otomatis dicoba di Android 12+ saat aplikasi tidak digunakan dan tidak ada chat aktif. Android tetap mengendalikan izin serta dapat meminta konfirmasi installer. APK diperiksa ukuran, SHA-256, versi, identitas paket, dan sertifikatnya sebelum pemasangan.</p>
    </> : <p role="status">Pembaruan otomatis tersedia di APK Android yang mendukung fitur ini. Preview browser tidak memasang aplikasi.</p>}
  </section>;
}
export function MobileUpdateBanner() {
  const state = useAppUpdates();
  if (state.phase !== 'ready') return null;
  return <aside className="m-update-banner" aria-label="Pembaruan tersedia"><span>SuperGPT {state.version} siap dipasang</span><button onClick={() => updateAction('install')}>Pasang</button></aside>;
}
