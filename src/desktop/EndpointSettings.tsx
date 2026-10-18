import { ClientAlert, ClientBadge, ClientButton, ClientInput, ClientSwitch } from '../components/SDKPrimitives';
import { useEffect, useRef, useState } from 'react';
import { UIIcon as I } from '../components/UIIcon';
import { discoverEndpointModels, loadEndpointKeys, loadEndpointStore, normalizeBaseUrl, saveEndpointStore, type EndpointProfile, type EndpointStore } from '../lib/endpointProfiles';
import { SakelarRecommendation } from './SakelarRecommendation';
import { usesLocalProviderRelay } from '../lib/providerTransport';
import { isNativeDesktop } from '../lib/nativeDesktop';
import { providerErrorMessage } from '../lib/providerErrors';
import { endpointVaultState, flushEndpointKeyPersistence, usesNativeEndpointVault } from '../lib/mobileEndpointVault';

type Draft = { id: string; name: string; baseUrl: string; model: string; key: string; auth: boolean; models: string[]; sendReasoning?: boolean };
const emptyDraft = (): Draft => ({ id: '', name: '', baseUrl: '', model: '', key: '', auth: true, models: [] });

export function EndpointSettings({ setup = false, onSaved, onBack, onNotice }: { setup?: boolean; onSaved?: () => void; onBack?: () => void; onNotice?: (message: string) => void } = {}) {
  const [store, setStore] = useState<EndpointStore>(loadEndpointStore);
  const [keys, setKeys] = useState<Record<string, string>>(() => loadEndpointKeys(store.profiles));
  const [draft, setDraft] = useState<Draft>(() => {
    const selected = store.profiles.find(profile => profile.id === store.selectedId);
    return selected ? { ...selected, key: keys[selected.id] || '', auth: selected.auth === 'bearer' } : emptyDraft();
  });
  const [revealed, setRevealed] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false), [testResult, setTestResult] = useState(''), [deleteId, setDeleteId] = useState('');
  const [saving, setSaving] = useState(false), [vaultState, setVaultState] = useState(endpointVaultState);
  const secureVault = usesNativeEndpointVault();
  const credentialScope = secureVault ? 'API key dienkripsi di perangkat menggunakan Android Keystore dan tetap tersedia setelah aplikasi dibuka ulang. Keluar dari profil akan menghapus kunci.' : 'API key hanya disimpan selama sesi tab ini. Tidak masuk ke riwayat chat atau penyimpanan profil permanen.';
  const [modelQuery, setModelQuery] = useState(''), [modelLimit, setModelLimit] = useState(100);
  const request = useRef<AbortController | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  function notify(message: string) { if (onNotice) onNotice(message); else window.dispatchEvent(new CustomEvent('client-toast', { detail: message })); }
  function stopTest() { request.current?.abort(); request.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; setTesting(false); }
  useEffect(() => () => { request.current?.abort(); if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    const changed = () => setVaultState(endpointVaultState());
    window.addEventListener('client-endpoint-vault-changed', changed);
    return () => window.removeEventListener('client-endpoint-vault-changed', changed);
  }, []);
  function update(change: Partial<Draft>) { stopTest(); setDraft(previous => ({ ...previous, ...change })); setError(''); setNotice(''); setTestResult(''); }
  function edit(profile?: EndpointProfile) {
    stopTest(); setRevealed(false); setError(''); setNotice(''); setTestResult(''); setDeleteId('');
    setDraft(profile ? { ...profile, key: keys[profile.id] || '', auth: profile.auth === 'bearer' } : emptyDraft());
    requestAnimationFrame(() => nameInput.current?.focus());
  }
  async function persist(next: EndpointStore, nextKeys = keys) {
    setSaving(true);
    try { saveEndpointStore(next, nextKeys); setStore(next); setKeys(nextKeys); await flushEndpointKeyPersistence(); return true; }
    catch { setError(secureVault ? 'Profil tersedia untuk sesi ini, tetapi API key belum tersimpan aman. Coba simpan ulang sebelum menutup aplikasi.' : 'Pengaturan belum tersimpan. Penyimpanan browser tidak tersedia atau penuh.'); return false; }
    finally { setSaving(false); }
  }
  async function save() {
    stopTest(); setError(''); setNotice('');
    try {
      if (!draft.name.trim()) throw Error('Isi nama endpoint.');
      const baseUrl = normalizeBaseUrl(draft.baseUrl);
      if (!draft.model.trim()) throw Error('Isi ID model, atau ambil model dari penyedia.');
      if (draft.auth && !draft.key.trim()) throw Error('Isi API key, atau matikan autentikasi untuk server tanpa kunci.');
      if (!draft.id && store.profiles.length >= 50) throw Error('Maksimal 50 profil. Hapus profil yang tidak dipakai.');
      const id = draft.id || crypto.randomUUID();
      const profile: EndpointProfile = { id, name: draft.name.trim(), baseUrl, model: draft.model.trim(), models: [...new Set([draft.model.trim(), ...draft.models])].slice(0, 5000), protocol: 'openai-compatible', auth: draft.auth ? 'bearer' : 'none', sendReasoning: draft.sendReasoning === true };
      const profiles = draft.id ? store.profiles.map(item => item.id === id ? profile : item) : [...store.profiles, profile];
      const nextKeys = { ...keys }; if (draft.auth) nextKeys[id] = draft.key.trim(); else delete nextKeys[id];
      const persisted = await persist({ version: 1, profiles, selectedId: store.selectedId || id }, nextKeys);
      setDraft(previous => ({ ...previous, id, baseUrl }));
      if (persisted) { setNotice('Endpoint tersimpan.'); notify('Endpoint tersimpan'); onSaved?.(); }
    } catch (failure) { const message = failure instanceof Error ? failure.message : 'Periksa isian endpoint.'; setError(message); notify(message); }
  }
  async function remove(id: string) {
    const profiles = store.profiles.filter(profile => profile.id !== id), nextKeys = { ...keys }; delete nextKeys[id];
    if (await persist({ version: 1, profiles, selectedId: store.selectedId === id ? profiles[0]?.id || null : store.selectedId }, nextKeys)) { if (draft.id === id) edit(); setDeleteId(''); setNotice('Endpoint dihapus dari perangkat ini.'); notify('Endpoint dihapus'); }
  }
  async function test() {
    stopTest(); setError(''); setNotice(''); setTestResult('');
    try { normalizeBaseUrl(draft.baseUrl); if (draft.auth && !draft.key.trim()) throw Error('Isi API key terlebih dahulu.'); }
    catch (failure) { setError((failure as Error).message); return; }
    const controller = new AbortController(); request.current = controller; setTesting(true);
    timeout.current = setTimeout(() => controller.abort(), 15000);
    try {
      const models = await discoverEndpointModels(draft.baseUrl, draft.auth ? draft.key.trim() : '', controller.signal);
      if (request.current !== controller) return;
      setDraft(previous => ({ ...previous, models, model: previous.model || models[0] || '' }));
      setModelQuery(''); setModelLimit(100);
      const message = models.length ? 'Koneksi berhasil · ' + models.length + ' model tersedia' : 'Koneksi berhasil · daftar model kosong';
      setTestResult(models.length ? 'Koneksi berhasil. ' + models.length + ' model tersedia.' : 'Koneksi berhasil, tetapi daftar model kosong. Isi ID model secara manual.');
      notify(message);
    } catch (failure) {
      if (request.current !== controller) return;
      const message = controller.signal.aborted ? 'Tes melewati batas 15 detik. Periksa koneksi dan alamat penyedia.' : providerErrorMessage(failure, isNativeDesktop(), 'Koneksi belum berhasil.');
      setError(message); notify(message);
    } finally { if (request.current === controller) { request.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; setTesting(false); } }
  }
  const editing = store.profiles.find(profile => profile.id === draft.id);
  const matchingModels = draft.models.filter(model => model.toLowerCase().includes(modelQuery.toLowerCase()));
  return <section className={'d-endpoint-page' + (setup ? '' : ' d-endpoint-settings')} aria-labelledby={setup ? undefined : 'endpoint-heading'} aria-label={setup ? 'Custom Endpoint' : undefined}>
    {!setup && <header><div><h1 id="endpoint-heading">Custom Endpoint</h1><p>Hubungkan AI pilihanmu.</p></div><ClientButton color="primary" variant="solid" className="d-endpoint-primary" onClick={() => edit()}><I name="plus" size={20}/>Tambah endpoint</ClientButton></header>}
    <div className="d-endpoint-layout">{!setup && <aside className="d-endpoint-profiles" aria-label="Endpoint tersimpan"><h2>Endpoint tersimpan <span>{store.profiles.length}</span></h2>
      {!store.profiles.length && <div className="d-endpoint-empty"><I name="globe" size={30}/><b>Belum ada endpoint</b><p>Tambahkan koneksi pertamamu di bawah.</p></div>}
      {store.profiles.map(profile => <div key={profile.id} className={'d-endpoint-card ' + (draft.id === profile.id ? 'd-is-editing' : '')}>
        <button className="d-endpoint-open" onClick={() => edit(profile)}><span className="d-endpoint-mark"><I name="globe" size={22}/></span><span><b>{profile.name}</b><small>{new URL(profile.baseUrl).host}</small></span>{store.selectedId === profile.id && <ClientBadge>Pilihan</ClientBadge>}</button>
        <p>{profile.model}{profile.auth === 'bearer' && !keys[profile.id] && <small className="d-endpoint-key-needed">Masukkan ulang API key untuk sesi ini</small>}</p><div className="d-endpoint-card-actions"><ClientButton disabled={saving || store.selectedId === profile.id} onClick={async () => { setError(''); if (await persist({ ...store, selectedId: profile.id })) { setNotice('Profil ' + profile.name + ' dipilih.'); notify(profile.name + ' dipilih'); } }}>{store.selectedId === profile.id ? <><I name="check" size={16}/>Dipilih</> : 'Pilih profil'}</ClientButton><ClientButton aria-label={'Hapus ' + profile.name} onClick={() => setDeleteId(deleteId === profile.id ? '' : profile.id)}>Hapus</ClientButton></div>
        {deleteId === profile.id && <div className="d-endpoint-delete"><p>Hapus endpoint ini?</p><ClientButton disabled={saving} onClick={() => void remove(profile.id)}>Hapus endpoint</ClientButton><ClientButton onClick={() => setDeleteId('')}>Batal</ClientButton></div>}
      </div>)}
    </aside>}<form className="d-endpoint-form" onSubmit={event => { event.preventDefault(); if (!saving) void save(); }} autoComplete="off">
      <div className="d-endpoint-form-heading">{setup && <span className="d-endpoint-mark"><I name="terminal" size={25}/></span>}<div><h2>{editing ? 'Pengaturan koneksi' : 'Endpoint baru'}</h2><p>OpenAI-compatible API</p></div></div>
      <label htmlFor="endpoint-name">Nama endpoint<ClientInput ref={nameInput} id="endpoint-name" maxLength={80} placeholder="Contoh: Gateway saya" value={draft.name} onChange={event => update({ name: event.target.value })} required/></label>
      <label htmlFor="endpoint-base-url">Base URL<ClientInput id="endpoint-base-url" type="url" maxLength={2048} spellCheck={false} placeholder="https://api.example.com/v1" value={draft.baseUrl} onChange={event => update({ baseUrl: event.target.value, models: [] })} required/><small>Masukkan alamat API, termasuk /v1 jika penyedia memerlukannya.</small></label>
      <label className="d-endpoint-auth"><ClientSwitch label="Gunakan API key" value={draft.auth} change={checked => { setRevealed(false); update({ auth: checked, key: checked ? draft.key : '' }); }}/><span>Gunakan API key</span></label>
      {draft.auth && <label htmlFor="endpoint-api-key">API key<div className="d-endpoint-secret"><ClientInput id="endpoint-api-key" type={revealed ? 'text' : 'password'} maxLength={4096} autoComplete="new-password" spellCheck={false} autoCapitalize="none" placeholder="Masukkan API key" value={draft.key} onChange={event => update({ key: event.target.value })} required/><ClientButton type="button" aria-label={revealed ? 'Sembunyikan API key' : 'Tampilkan API key'} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? 'Sembunyikan' : 'Tampilkan'}</ClientButton></div><small>{credentialScope}</small></label>}
      {!draft.auth && <p className="d-endpoint-hint">Gunakan tanpa kunci hanya jika servermu tidak memerlukan autentikasi.</p>}
      <div className="d-endpoint-model-heading"><label htmlFor="endpoint-model">Model ID</label><ClientButton type="button" className="d-endpoint-test" loading={testing} disabled={testing || !draft.baseUrl.trim()} onClick={() => void test()}><I name="refresh" size={17}/>{testing ? 'Menguji koneksi…' : 'Tes & ambil model'}</ClientButton></div>
      <ClientInput id="endpoint-model" list="endpoint-models" maxLength={160} spellCheck={false} placeholder="Masukkan ID model dari penyedia" value={draft.model} onChange={event => update({ model: event.target.value })} required/><datalist id="endpoint-models">{draft.models.map(model => <option key={model} value={model}/>)}</datalist>
      {draft.models.length > 0 && <div className="d-discovered-models"><div><b>{draft.models.length} model tersedia</b><input aria-label="Cari model endpoint" placeholder="Cari model…" value={modelQuery} onChange={event => { setModelQuery(event.target.value); setModelLimit(100); }}/></div><div role="listbox" aria-label="Model terdeteksi">{matchingModels.slice(0, modelLimit).map(model => <ClientButton type="button" role="option" aria-selected={draft.model === model} key={model} onClick={() => update({ model })}><span>{model}</span>{draft.model === model && <I name="check" size={16}/>}</ClientButton>)}{!matchingModels.length && <p>Model tidak ditemukan.</p>}{matchingModels.length > modelLimit && <ClientButton type="button" onClick={() => setModelLimit(value => value + 100)}>Tampilkan lebih banyak ({matchingModels.length - modelLimit})</ClientButton>}</div></div>}
      <p className="d-endpoint-hint">{isNativeDesktop() ? 'Koneksi desktop langsung ke penyedia melalui HTTP native. Tidak memerlukan izin CORS dari penyedia.' : usesLocalProviderRelay() ? 'Koneksi preview berjalan lewat proses lokal di komputer ini, lalu ke penyedia pilihanmu. Tidak lewat server Sakelar.' : 'Koneksi langsung ke penyedia. Penyedia harus mengizinkan CORS untuk aplikasi web.'} Model juga bisa diisi manual.</p>
      <label className="d-endpoint-auth"><ClientSwitch label="Kirim reasoning_effort" value={!!draft.sendReasoning} change={checked => update({ sendReasoning: checked })}/><span>Kirim reasoning_effort (jika model mendukung)</span></label>
      {secureVault && vaultState === 'error' && <ClientAlert className="d-endpoint-status d-error">Penyimpanan aman API key belum tersedia. Masukkan kunci dan simpan ulang; jangan tutup aplikasi sebelum penyimpanan berhasil.</ClientAlert>}{error && <ClientAlert className="d-endpoint-status d-error">{error}</ClientAlert>}{(notice || testResult) && <ClientAlert tone="success" className="d-endpoint-status">{notice || testResult}</ClientAlert>}
      <footer><ClientButton type="button" className="d-endpoint-secondary" onClick={setup ? onBack : () => edit(editing)}>{setup ? 'Kembali' : 'Reset'}</ClientButton><ClientButton color="primary" variant="solid" className="d-endpoint-primary" type="submit" disabled={saving} loading={saving}>{setup ? 'Simpan & mulai' : 'Simpan endpoint'}</ClientButton></footer>
    </form></div>{!setup && <><p className="d-endpoint-scope"><I name="shield" size={18}/>{credentialScope}</p><SakelarRecommendation/></>}
  </section>;
}
