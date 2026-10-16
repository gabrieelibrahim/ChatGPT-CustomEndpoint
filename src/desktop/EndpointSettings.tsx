import { useEffect, useRef, useState } from 'react';
import { UIIcon as I } from '../components/UIIcon';
import { discoverEndpointModels, loadEndpointKeys, loadEndpointStore, normalizeBaseUrl, saveEndpointStore, type EndpointProfile, type EndpointStore } from '../lib/endpointProfiles';

type Draft = { id: string; name: string; baseUrl: string; model: string; key: string; auth: boolean; models: string[] };
const emptyDraft = (): Draft => ({ id: '', name: '', baseUrl: '', model: '', key: '', auth: true, models: [] });

export function EndpointSettings() {
  const [store, setStore] = useState<EndpointStore>(loadEndpointStore);
  const [keys, setKeys] = useState<Record<string, string>>(() => loadEndpointKeys(store.profiles));
  const [draft, setDraft] = useState<Draft>(() => {
    const selected = store.profiles.find(profile => profile.id === store.selectedId);
    return selected ? { ...selected, key: keys[selected.id] || '', auth: selected.auth === 'bearer' } : emptyDraft();
  });
  const [revealed, setRevealed] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false), [testResult, setTestResult] = useState(''), [deleteId, setDeleteId] = useState('');
  const request = useRef<AbortController | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  function stopTest() { request.current?.abort(); request.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; setTesting(false); }
  useEffect(() => () => { request.current?.abort(); if (timeout.current) clearTimeout(timeout.current); }, []);
  function update(change: Partial<Draft>) { stopTest(); setDraft(previous => ({ ...previous, ...change })); setError(''); setNotice(''); setTestResult(''); }
  function edit(profile?: EndpointProfile) {
    stopTest(); setRevealed(false); setError(''); setNotice(''); setTestResult(''); setDeleteId('');
    setDraft(profile ? { ...profile, key: keys[profile.id] || '', auth: profile.auth === 'bearer' } : emptyDraft());
    requestAnimationFrame(() => nameInput.current?.focus());
  }
  function persist(next: EndpointStore, nextKeys = keys) {
    try { saveEndpointStore(next, nextKeys); setStore(next); setKeys(nextKeys); return true; }
    catch { setError('Pengaturan belum tersimpan. Penyimpanan browser tidak tersedia atau penuh.'); return false; }
  }
  function save() {
    stopTest(); setError(''); setNotice('');
    try {
      if (!draft.name.trim()) throw Error('Isi nama endpoint.');
      const baseUrl = normalizeBaseUrl(draft.baseUrl);
      if (!draft.model.trim()) throw Error('Isi ID model, atau ambil model dari penyedia.');
      if (draft.auth && !draft.key.trim()) throw Error('Isi API key, atau matikan autentikasi untuk server tanpa kunci.');
      if (!draft.id && store.profiles.length >= 50) throw Error('Maksimal 50 profil. Hapus profil yang tidak dipakai.');
      const id = draft.id || crypto.randomUUID();
      const profile: EndpointProfile = { id, name: draft.name.trim(), baseUrl, model: draft.model.trim(), models: [...new Set([draft.model.trim(), ...draft.models])].slice(0, 500), protocol: 'openai-compatible', auth: draft.auth ? 'bearer' : 'none' };
      const profiles = draft.id ? store.profiles.map(item => item.id === id ? profile : item) : [...store.profiles, profile];
      const nextKeys = { ...keys }; if (draft.auth) nextKeys[id] = draft.key.trim(); else delete nextKeys[id];
      if (persist({ version: 1, profiles, selectedId: store.selectedId || id }, nextKeys)) { setDraft(previous => ({ ...previous, id, baseUrl })); setNotice('Endpoint tersimpan.'); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Periksa isian endpoint.'); }
  }
  function remove(id: string) {
    const profiles = store.profiles.filter(profile => profile.id !== id), nextKeys = { ...keys }; delete nextKeys[id];
    if (persist({ version: 1, profiles, selectedId: store.selectedId === id ? profiles[0]?.id || null : store.selectedId }, nextKeys)) { if (draft.id === id) edit(); setDeleteId(''); setNotice('Endpoint dihapus dari perangkat ini.'); }
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
      setTestResult(models.length ? 'Koneksi berhasil. ' + models.length + ' model tersedia.' : 'Koneksi berhasil, tetapi daftar model kosong. Isi ID model secara manual.');
    } catch (failure) {
      if (request.current !== controller) return;
      setError(controller.signal.aborted ? 'Tes melewati batas 15 detik. Periksa koneksi dan alamat penyedia.' : failure instanceof TypeError ? 'Tidak bisa menghubungi endpoint. Periksa alamat, jaringan, dan dukungan CORS penyedia.' : failure instanceof Error ? failure.message : 'Koneksi belum berhasil.');
    } finally { if (request.current === controller) { request.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; setTesting(false); } }
  }
  const editing = store.profiles.find(profile => profile.id === draft.id);
  return <section className="d-endpoint-page" aria-labelledby="endpoint-heading">
    <header><div><p className="d-endpoint-eyebrow">AI CONNECTIONS</p><h1 id="endpoint-heading">Custom Endpoint</h1><p>Simpan koneksi dan model dari penyedia AI pilihanmu.</p></div><button className="d-endpoint-primary" onClick={() => edit()}><I name="plus" size={20}/>Tambah endpoint</button></header>
    <div className="d-endpoint-layout"><aside className="d-endpoint-profiles" aria-label="Endpoint tersimpan"><h2>Endpoint tersimpan <span>{store.profiles.length}</span></h2>
      {!store.profiles.length && <div className="d-endpoint-empty"><I name="globe" size={30}/><b>Belum ada endpoint</b><p>Tambahkan koneksi pertamamu di formulir sebelah.</p></div>}
      {store.profiles.map(profile => <div key={profile.id} className={'d-endpoint-card ' + (draft.id === profile.id ? 'd-is-editing' : '')}>
        <button className="d-endpoint-open" onClick={() => edit(profile)}><span className="d-endpoint-mark"><I name="globe" size={22}/></span><span><b>{profile.name}</b><small>{new URL(profile.baseUrl).host}</small></span>{store.selectedId === profile.id && <span className="d-endpoint-badge">Pilihan</span>}</button>
        <p>{profile.model}{profile.auth === 'bearer' && !keys[profile.id] && <small className="d-endpoint-key-needed">Masukkan ulang API key untuk sesi ini</small>}</p><div className="d-endpoint-card-actions"><button disabled={store.selectedId === profile.id} onClick={() => { setError(''); if (persist({ ...store, selectedId: profile.id })) setNotice('Profil ' + profile.name + ' dipilih.'); }}>{store.selectedId === profile.id ? <><I name="check" size={16}/>Dipilih</> : 'Pilih profil'}</button><button aria-label={'Hapus ' + profile.name} onClick={() => setDeleteId(deleteId === profile.id ? '' : profile.id)}>Hapus</button></div>
        {deleteId === profile.id && <div className="d-endpoint-delete"><p>Hapus endpoint ini?</p><button onClick={() => remove(profile.id)}>Hapus endpoint</button><button onClick={() => setDeleteId('')}>Batal</button></div>}
      </div>)}
    </aside><form className="d-endpoint-form" onSubmit={event => { event.preventDefault(); save(); }} autoComplete="off">
      <div className="d-endpoint-form-heading"><span className="d-endpoint-mark"><I name="terminal" size={25}/></span><div><h2>{editing ? 'Edit endpoint' : 'Tambah endpoint'}</h2><p>OpenAI-compatible API</p></div></div>
      <label htmlFor="endpoint-name">Nama endpoint<input ref={nameInput} id="endpoint-name" maxLength={80} placeholder="Contoh: Gateway saya" value={draft.name} onChange={event => update({ name: event.target.value })} required/></label>
      <label htmlFor="endpoint-base-url">Base URL<input id="endpoint-base-url" type="url" maxLength={2048} spellCheck={false} placeholder="https://api.example.com/v1" value={draft.baseUrl} onChange={event => update({ baseUrl: event.target.value, models: [] })} required/><small>Masukkan alamat API, termasuk /v1 jika penyedia memerlukannya.</small></label>
      <label className="d-endpoint-auth"><input type="checkbox" checked={draft.auth} onChange={event => { setRevealed(false); update({ auth: event.target.checked, key: event.target.checked ? draft.key : '' }); }}/><span>Gunakan API key</span></label>
      {draft.auth && <label htmlFor="endpoint-api-key">API key<div className="d-endpoint-secret"><input id="endpoint-api-key" type={revealed ? 'text' : 'password'} maxLength={4096} autoComplete="new-password" spellCheck={false} autoCapitalize="none" placeholder="Masukkan API key" value={draft.key} onChange={event => update({ key: event.target.value })} required/><button type="button" aria-label={revealed ? 'Sembunyikan API key' : 'Tampilkan API key'} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? 'Sembunyikan' : 'Tampilkan'}</button></div><small>Kunci hanya disimpan selama sesi tab ini. Tidak masuk ke riwayat chat atau penyimpanan profil permanen.</small></label>}
      {!draft.auth && <p className="d-endpoint-hint">Gunakan tanpa kunci hanya jika servermu tidak memerlukan autentikasi.</p>}
      <div className="d-endpoint-model-heading"><label htmlFor="endpoint-model">Model ID</label><button type="button" className="d-endpoint-test" disabled={testing || !draft.baseUrl.trim()} onClick={() => void test()}><I name="refresh" size={17}/>{testing ? 'Menguji koneksi…' : 'Tes & ambil model'}</button></div>
      <input id="endpoint-model" list="endpoint-models" maxLength={160} spellCheck={false} placeholder="Masukkan ID model dari penyedia" value={draft.model} onChange={event => update({ model: event.target.value })} required/><datalist id="endpoint-models">{draft.models.map(model => <option key={model} value={model}/>)}</datalist>
      <p className="d-endpoint-hint">Model bisa diisi manual. Tes mengakses /models langsung ke alamat yang kamu masukkan; penyedia harus mengizinkan CORS.</p>
      {error && <p className="d-endpoint-status d-error" role="alert">{error}</p>}{(notice || testResult) && <p className="d-endpoint-status" role="status"><I name="check" size={18}/>{notice || testResult}</p>}
      <footer><button type="button" className="d-endpoint-secondary" onClick={() => edit(editing)}>Reset</button><button className="d-endpoint-primary" type="submit">Simpan endpoint</button></footer>
    </form></div><p className="d-endpoint-scope"><I name="shield" size={18}/>Halaman ini menyimpan pengaturan koneksi. Percakapan desktop masih memakai mode demo.</p>
  </section>;
}
