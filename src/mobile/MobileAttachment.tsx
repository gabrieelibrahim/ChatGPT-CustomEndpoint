import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { libraryFile, type FileRef } from '../lib/fileLibrary';
import { MobileControlIcon } from './MobileControlIcon';
import { MobileNavigationIcon } from './MobileNavigationIcon';
import { logDiagnostic } from '../lib/diagnosticLog';
import { openDocumentAttachment } from './openAttachment';
import { videoPoster } from '../lib/attachmentContent';

export function attachmentKind(file: FileRef) {
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name)) return 'Foto';
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name)) return 'Video';
  if (/\.pdf$/i.test(file.name)) return 'PDF';
  if (/\.html?$/i.test(file.name)) return 'HTML';
  return 'Dokumen';
}

// Keep media bytes in IndexedDB. Object URLs live only as long as this card.
export function MobileAttachment({ file, pending = false, onRemove }: { file: FileRef; pending?: boolean; onRemove?: () => void }) {
  const [url, setUrl] = useState(''), [poster, setPoster] = useState(''), [size, setSize] = useState(''), [preview, setPreview] = useState(false), [missing, setMissing] = useState(false), [error, setError] = useState('');
  const kind = attachmentKind(file), media = kind === 'Foto' || kind === 'Video';
  useEffect(() => {
    let disposed = false, objectUrl = '';
    setUrl(''); setPoster(''); setMissing(false); setSize('');
    void libraryFile(file.id).then(value => {
      if (disposed) return;
      if (!value) { setMissing(true); return; }
      setSize(value.size >= 1048576 ? (value.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(value.size / 1024)) + ' KB');
      objectUrl = URL.createObjectURL(value.blob); setUrl(objectUrl);
      if (kind === 'Video') void videoPoster(file.id, value.blob).then(frame => { if (!disposed) setPoster(frame); }, () => {});
    }).catch(() => { if (!disposed) { setMissing(true); logDiagnostic('files', 'read-failed', { kind: media ? 'media' : 'document' }, 'error'); } });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id, media, kind]);
  useEffect(() => {
    if (!preview) return;
    const close = () => setPreview(false);
    window.dispatchEvent(new CustomEvent('client-media-preview', { detail: close }));
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setPreview(false); } };
    window.addEventListener('keydown', escape, true);
    return () => { window.removeEventListener('keydown', escape, true); window.dispatchEvent(new CustomEvent('client-media-preview', { detail: null })); };
  }, [preview]);
  return <div className={`m-file-card${kind === 'Foto' || (kind === 'Video' && (poster || pending)) ? ' m-file-media' : ''}${kind === 'Video' ? poster ? ' m-file-video-thumb' : ' m-file-video' : ''}${pending ? ' m-file-pending' : ''}`}>
    <button type="button" className="m-file-open" aria-label={'Lihat ' + file.name} disabled={!url} onClick={() => { if (media) setPreview(true); else void openDocumentAttachment(file, url).catch(() => { setError('File belum dapat dibuka.'); logDiagnostic('files', 'open-failed', { kind: 'document' }, 'error'); }); }}>
      {url && kind === 'Foto' ? <img src={url} alt={file.name}/> : poster ? <><img src={poster} alt={file.name}/><span className="m-file-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span></> : <><span className="m-file-type"><MobileNavigationIcon name={kind === 'Video' ? 'video-file' : 'document-file'}/></span><span className="m-file-label"><strong>{file.name}</strong>{kind !== 'Video' && <small>{missing ? 'File tidak tersedia' : [kind, size].filter(Boolean).join(' · ')}</small>}</span>{!pending && <MobileNavigationIcon name="chevron-right" size={16}/>}</>}
    </button>
    {error && <span role="alert">{error}</span>}
    {onRemove && <button className="m-file-remove" type="button" aria-label={'Hapus lampiran ' + file.name} onClick={onRemove}><MobileControlIcon name="close"/></button>}
    {preview && createPortal(<div className="m-media-preview" role="dialog" aria-modal="true" aria-label={file.name}>
      <header><button autoFocus type="button" aria-label="Tutup pratinjau" onClick={() => setPreview(false)}><MobileControlIcon name="close"/></button><span>{file.name}</span></header>
      {kind === 'Video' ? <video src={url} controls playsInline/> : <img src={url} alt={file.name}/>}
    </div>, document.querySelector('.m-app') || document.body)}
  </div>;
}
