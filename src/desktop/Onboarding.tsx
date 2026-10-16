import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UIIcon as I } from '../components/UIIcon';
import { profileInitials, saveLocalProfile, type LocalProfile } from '../lib/localProfile';
import { EndpointSettings } from './EndpointSettings';
import { SakelarRecommendation } from './SakelarRecommendation';

function ProfileOverlay({ children, label, close, fullPage = false }: { children: ReactNode; label: string; close?: () => void; fullPage?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); };
  }, []);
  const content = <div className={'d-setup' + (fullPage ? ' d-auth-page' : '')} onMouseDown={event => { if (close && event.target === event.currentTarget) close(); }}>
    {fullPage && <div className="d-auth-wordmark">Sakelar <span>AI</span></div>}
    <div className="d-setup-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={label}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); if (close) close(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled)') || []).filter(element => !element.closest('[hidden],[inert]'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>{children}</div>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export function Onboarding({ onComplete }: { onComplete: (profile: LocalProfile) => void }) {
  const [step, setStep] = useState(1), [name, setName] = useState(''), [error, setError] = useState('');
  const [endpointOpen, setEndpointOpen] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  function finish() {
    try { const profile = saveLocalProfile(name); onComplete(profile); }
    catch (failure) { setError((failure as Error).message); }
  }
  useEffect(() => {
    if (step === 1) nameInput.current?.focus();
    else if (endpointOpen) document.querySelector<HTMLInputElement>('.d-setup #endpoint-name')?.focus();
    else document.querySelector<HTMLButtonElement>('.d-auth-connect-toggle')?.focus();
    document.querySelector('.d-auth-page')?.scrollTo({ top: 0 });
  }, [step, endpointOpen]);
  return <ProfileOverlay label="Pengaturan awal" fullPage>
    <div className="d-auth-step" role="status">Langkah {step} dari 2</div>
    <div className="d-auth-name-step" hidden={step !== 1} inert={step !== 1}>
      <h1>Selamat datang</h1><p className="d-setup-intro">Masukkan namamu untuk mulai menggunakan Sakelar.</p>
      <form className="d-name-form" onSubmit={event => { event.preventDefault(); if (!name.trim()) { setError('Isi namamu terlebih dahulu.'); return; } setError(''); setStep(2); }}>
        <label htmlFor="setup-name">Nama kamu</label><input ref={nameInput} id="setup-name" maxLength={80} autoComplete="name" placeholder="Masukkan nama" value={name} onChange={event => { setName(event.target.value); setError(''); }} required/>
        {error && step === 1 && <p className="d-setup-error" role="alert">{error}</p>}
        <button className="d-setup-primary" type="submit">Lanjut</button>
      </form>
      <p className="d-auth-footnote">Nama disimpan di perangkat ini dan bisa diubah dari profil.<br/>Sakelar Universal AI Client adalah aplikasi independen.</p>
    </div>
    <div className="d-auth-endpoint-step" hidden={step !== 2} inert={step !== 2}>
      <div className="d-auth-identity"><span>{profileInitials(name)}</span><b>{name.trim()}</b><button aria-label="Ubah nama" onClick={() => { setError(''); setStep(1); }}><I name="edit" size={17}/></button></div>
      <h1>Hubungkan AI pilihanmu</h1><p className="d-setup-intro">Tambahkan custom endpoint, atau atur nanti dari profil.</p>
      <button className="d-auth-connect-toggle" aria-expanded={endpointOpen} aria-controls="setup-endpoint-fields" onClick={() => setEndpointOpen(value => !value)}><span className="d-auth-connect-icon"><I name="globe" size={21}/></span><span><b>Custom endpoint</b><small>Gunakan penyedia AI pilihanmu</small></span><span className="d-auth-connect-chevron"><I name="down" size={18}/></span></button>
      <div id="setup-endpoint-fields" hidden={!endpointOpen} inert={!endpointOpen}>
        <EndpointSettings setup onSaved={finish} onBack={() => setEndpointOpen(false)}/>
      </div>
      {error && step === 2 && <p className="d-setup-error" role="alert">{error}</p>}
      <div className="d-auth-divider"><span>ATAU</span></div>
      <button className="d-setup-skip" onClick={finish}>Lewati endpoint untuk sekarang</button>
      <SakelarRecommendation/>
      <p className="d-auth-footnote">Koneksi ini opsional. Kamu bebas memilih penyedia AI.<br/>Pengaturan tersimpan di perangkat ini.</p>
    </div>
  </ProfileOverlay>;
}

export function ProfileNameDialog({ profile, onSave, onClose }: { profile: LocalProfile; onSave: (profile: LocalProfile) => void; onClose: () => void }) {
  const [name, setName] = useState(profile.name), [error, setError] = useState('');
  return <ProfileOverlay label="Nama profil" close={onClose}>
    <div className="d-profile-edit-heading"><span>{profileInitials(name)}</span><button aria-label="Tutup pengaturan nama" onClick={onClose}><I name="close" size={20}/></button></div>
    <h1>Nama profil</h1><p className="d-setup-intro">Gunakan nama yang ingin kamu tampilkan di aplikasi.</p>
    <form className="d-name-form" onSubmit={event => { event.preventDefault(); try { onSave(saveLocalProfile(name)); } catch (failure) { setError((failure as Error).message); } }}>
      <label htmlFor="profile-name">Nama kamu</label><input id="profile-name" maxLength={80} autoComplete="name" value={name} onChange={event => { setName(event.target.value); setError(''); }} required/>
      {error && <p className="d-setup-error" role="alert">{error}</p>}
      <button className="d-setup-primary" type="submit">Simpan nama</button>
    </form>
  </ProfileOverlay>;
}
