import { useEffect, useRef, useState } from 'react';
import { libraryFiles, removeLibraryFile, saveLibraryFile, type LibraryFile } from '../lib/fileLibrary';
import { MobileAttachment } from './MobileAttachment';

export function MobileDeviceLibrary({ onNotice }: { onNotice(message: string): void }) {
  const [files, setFiles] = useState<LibraryFile[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void libraryFiles().then(values => { if (active) { setFiles(values.sort((a, b) => b.added - a.added)); setError(''); } }, () => { if (active) setError('Library perangkat belum dapat dibaca.'); }).finally(() => { if (active) setLoading(false); }); };
    refresh(); window.addEventListener('client-files-changed', refresh);
    return () => { active = false; window.removeEventListener('client-files-changed', refresh); };
  }, []);
  return <section className="m-device-library"><p className="m-setting-caption">File yang diimpor atau dilampirkan disimpan di perangkat ini. Ketuk file untuk membukanya.</p>
    <input aria-label="Cari file di perangkat" placeholder="Cari file" value={query} onChange={e => setQuery(e.target.value)}/>
    <button className="m-setting-save" onClick={() => picker.current?.click()}>Impor dari perangkat</button>
    <input ref={picker} type="file" multiple hidden onChange={async event => { const input = event.currentTarget, incoming = Array.from(input.files || []); let imported = 0; try { for (const file of incoming) { await saveLibraryFile(file); imported++; } onNotice(`${imported} file diimpor.`); } catch (failure) { onNotice(`${imported} file diimpor. ${failure instanceof Error ? failure.message : 'Impor gagal.'}`); } finally { input.value = ''; } }}/>
    {loading ? <p role="status">Membaca library…</p> : error ? <p role="alert">{error}</p> : <><p className="m-setting-caption">{files.length} file · {(files.reduce((sum, file) => sum + file.size, 0) / 1048576).toFixed(1)} MB</p>
      {files.filter(file => file.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(file => <div className="m-device-file" key={file.id}><MobileAttachment file={file}/><div className="m-device-file-details"><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · {new Date(file.added).toLocaleDateString('id-ID')}</small></div><button aria-label={'Hapus ' + file.name} onClick={() => { if (window.confirm('Hapus file ini dari perangkat? Lampiran pada obrolan yang memakai file ini juga tidak akan tersedia.')) void removeLibraryFile(file.id).catch(() => onNotice('File belum dapat dihapus.')); }}>Hapus</button></div>)}
      {!files.length && <p className="m-setting-empty">Belum ada file. Impor file atau tambahkan lampiran di chat.</p>}</>}
  </section>;
}
