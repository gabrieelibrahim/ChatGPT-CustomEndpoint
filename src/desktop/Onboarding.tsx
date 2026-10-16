import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UIIcon as I } from '../components/UIIcon';
import { profileInitials, saveLocalProfile, type LocalProfile } from '../lib/localProfile';
import { EndpointSettings } from './EndpointSettings';
import { SakelarRecommendation } from './SakelarRecommendation';

function ProfileOverlay({ children, label, close }: { children: ReactNode; label: string; close?: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); };
  }, []);
  const content = <div className="d-setup" onMouseDown={event => { if (close && event.target === event.currentTarget) close(); }}>
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
  const nameInput = useRef<HTMLInputElement>(null);
  function finish() {
    try { const profile = saveLocalProfile(name); onComplete(profile); }
    catch (failure) { setError((failure as Error).message); }
  }
  useEffect(() => {
    if (step === 1) nameInput.current?.focus();
    else document.querySelector<HTMLInputElement>('.d-setup #endpoint-name')?.focus();
  }, [step]);
  return <ProfileOverlay label="Pengaturan awal">
    <div className="d-setup-brand"><span>S</span>Sakelar Universal AI Client</div>
    <div className="d-setup-progress" aria-label={'Langkah ' + step + ' dari 2'}><span className="d-done"/><span className={step === 2 ? 'd-done' : ''}/></div>
    <div hidden={step !== 1} inert={step !== 1}>
      <h1>Selamat datang</h1><p className="d-setup-intro">Kita mulai dari namamu. Nama ini akan tampil di profil aplikasi.</p>
      <form className="d-name-form" onSubmit={event => { event.preventDefault(); if (!name.trim()) { setError('Isi namamu terlebih dahulu.'); return; } setError(''); setStep(2); }}>
        <label htmlFor="setup-name">Nama kamu</label><input ref={nameInput} id="setup-name" maxLength={80} autoComplete="name" placeholder="Masukkan nama" value={name} onChange={event => { setName(event.target.value); setError(''); }} required/>
        <p>Disimpan di perangkat ini. Kamu bisa mengubahnya nanti lewat profil.</p>
        {error && step === 1 && <p className="d-setup-error" role="alert">{error}</p>}
        <button className="d-setup-primary" type="submit">Lanjut <I name="arrow" size={18}/></button>
      </form>
    </div>
    <div hidden={step !== 2} inert={step !== 2}>
      <h1>Hubungkan AI pilihanmu</h1><p className="d-setup-intro">Hai, {name.trim()}. Tambahkan custom endpoint sekarang, atau atur nanti dari menu profil.</p>
      <SakelarRecommendation/>
      <EndpointSettings setup onSaved={finish} onBack={() => { setError(''); setStep(1); }}/>
      {error && step === 2 && <p className="d-setup-error" role="alert">{error}</p>}
      <button className="d-setup-skip" onClick={finish}>Lewati endpoint untuk sekarang</button>
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
