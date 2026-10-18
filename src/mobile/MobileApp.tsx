import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { UIIcon as Icon } from '../components/UIIcon';
import { RichText } from '../components/RichText';
import { EndpointSettings } from '../desktop/EndpointSettings';
import { MobileSpeech } from './MobileSpeech';
import { useClientSettings } from '../desktop/useClientSettings';
import { loadLocalProfile, saveLocalProfile } from '../lib/localProfile';
import { loadEndpointKeys, saveEndpointStore } from '../lib/endpointProfiles';
import { saveLibraryFile, type FileRef } from '../lib/fileLibrary';
import { useMobileConversation } from '../lib/useMobileConversation';
import { initialComposerState, focusComposer, blurComposer, resizeComposer } from './composerState';
import { MobileResponseActions, shareMobileResponse } from './MobileResponseActions';
import { MobilePresence } from './MobilePresence';
import { MobileHomeHeader } from './MobileHomeHeader';
import { MobileComposer } from './MobileComposer';
import { MobileTemporaryHome } from './MobileTemporaryHome';
import { MobileControlIcon } from './MobileControlIcon';
import { MobileSidebar, type MobileDestination } from './MobileSidebar';
import { MobileSettings } from './MobileSettings';
import { MobileLibrary } from './MobileLibrary';
import { useClientData } from '../desktop/ClientCollections';
import { smartPunctuation } from '../lib/clientSettings';
import { signOutMobileProfile } from '../lib/mobileProfile';

function Button({ icon, label, onClick, children, ...props }: { icon?: string; label: string; onClick: () => void; children?: ReactNode; disabled?: boolean; className?: string; 'aria-pressed'?: boolean }) {
  return <button type="button" aria-label={label} onClick={onClick} {...props}>{icon && <Icon name={icon} size={22}/ >}{children}</button>;
}

export function MobileApp() {
  const chat = useMobileConversation();
  const [profile, setProfile] = useState(loadLocalProfile), [name, setName] = useState('');
  const [page, setPage] = useState<'chat' | 'settings' | 'endpoints' | MobileDestination>('chat');
  const [returnPage, setReturnPage] = useState<'chat' | 'settings'>('chat');
  const [searchProject, setSearchProject] = useState('');
  const [drawer, setDrawer] = useState(false), [sheet, setSheet] = useState('');
  const [speechMode, setSpeechMode] = useState<'' | 'dictation' | 'voice'>('');
  const [draft, setDraft] = useState(''), [files, setFiles] = useState<FileRef[]>([]), [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(''), [mode, setMode] = useState<'Chat' | 'Work'>(() => localStorage.getItem('desktop-chat-mode') === 'Work' ? 'Work' : 'Chat');
  const preferences = useClientSettings(setNotice);
  const remindersEnabled = useRef(preferences.settings.notifications);
  remindersEnabled.current = preferences.settings.notifications;
  const clientData = useClientData(message => { if (!message.startsWith('Pengingat:') || remindersEnabled.current) setNotice(message); });
  const [archived, setArchived] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('desktop-archived') || '[]'); return Array.isArray(value) ? value.filter((title): title is string => typeof title === 'string') : []; } catch { return []; } });
  function archive(titles: string[]) { try { localStorage.setItem('desktop-archived', JSON.stringify(titles)); setArchived(titles); } catch { setNotice('Arsip belum tersimpan.'); } }
  function openChat(title: string) { chat.open(title); setPage('chat'); setDrawer(false); setAboveBottom(false); }
  const [height, setHeight] = useState(window.visualViewport?.height || window.innerHeight);
  const [composerState, setComposerState] = useState(() => initialComposerState(window.visualViewport?.height || window.innerHeight, window.innerWidth));
  const [aboveBottom, setAboveBottom] = useState(false);
  const [personalization, setPersonalization] = useState({ memories: false, instructions: true });
  const responseArticle = useRef<HTMLElement | null>(null);
  const [responseText, setResponseText] = useState('');
  const footer = useRef<HTMLElement>(null), cameraPicker = useRef<HTMLInputElement>(null), photoPicker = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), picker = useRef<HTMLInputElement>(null), closeDrawer = useRef<HTMLButtonElement>(null), closeSheet = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const resize = () => { const nextHeight = window.visualViewport?.height || window.innerHeight; setHeight(nextHeight); setComposerState(state => resizeComposer(state, nextHeight, window.innerWidth, document.activeElement === textarea.current)); };
    window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!aboveBottom) scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [chat.messages, aboveBottom]);
  useEffect(() => { if (drawer) closeDrawer.current?.focus({ preventScroll: true }); else if (sheet) closeSheet.current?.focus({ preventScroll: true }); }, [drawer, sheet]);
  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const measure = () => {
      const messages = scroll.current;
      if (!messages) return;
      messages.style.setProperty('--m-footer-height', element.getBoundingClientRect().height + 'px');
      if (!aboveBottom) messages.scrollTo({ top: messages.scrollHeight });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element, { box: 'border-box' }); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [page, chat.messages.length === 0, aboveBottom, speechMode]);
  function closeSpeech() { if (speechMode === 'voice') chat.stop(); setSpeechMode(''); }
  async function voiceReply(value: string) {
    let reply = '';
    const accepted = await chat.send(value, [], false, personalization, answer => { reply = answer; });
    if (!accepted || !reply.trim()) throw Error('Penyedia belum mengembalikan jawaban. Periksa endpoint dan model yang dipilih.');
    return reply;
  }
  function newChat(temp = false) { setSpeechMode(''); chat.reset(temp); setDraft(''); setFiles([]); setDrawer(false); setPage('chat'); setSheet(''); setAboveBottom(false); setPersonalization({ memories: false, instructions: true }); }
  function navigate(next: typeof page) { setSpeechMode(''); if (next !== 'chat' && next !== 'settings') setReturnPage(page === 'settings' ? 'settings' : 'chat'); if (next === 'settings') setName(profile?.name || ''); chat.stop(); setPage(next); setDrawer(false); setSheet(''); }
  function temporaryChat() { const temp = !chat.temporary; newChat(temp); if (temp && localStorage.getItem('client-temporary-intro-v1') !== 'seen') setSheet('temporary'); }
  async function send() {
    if (uploading || chat.busy || (!draft.trim() && !files.length)) return;
    const value = draft, attached = files;
    setDraft(''); setFiles([]); setAboveBottom(false);
    if (!await chat.send(value, attached, false, personalization)) { setDraft(value); setFiles(attached); }
  }
  async function attach(incoming: FileList | null) {
    if (!incoming) return;
    setUploading(true);
    try { const added: FileRef[] = []; for (const file of Array.from(incoming)) added.push(await saveLibraryFile(file)); setFiles(previous => [...previous, ...added]); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Lampiran gagal disimpan.'); }
    finally { setUploading(false); for (const input of [picker.current, cameraPicker.current, photoPicker.current]) if (input) input.value = ''; }
  }
  const home = !chat.messages.length;
  let pinned: string[] = [];
  try { const value = JSON.parse(localStorage.getItem('desktop-pinned') || '[]'); if (Array.isArray(value)) pinned = value.filter(title => typeof title === 'string'); } catch { /* Empty lists are safe. */ }

  return <div className={`m-app${page === 'chat' && home ? ' m-home' : ''}${chat.temporary ? ' m-temporary' : ''}`} style={{ height, '--m-action': preferences.settings.accent === '#2b6bca' ? '#2861df' : preferences.settings.accent } as CSSProperties} onKeyDown={event => {
    if (event.key === 'Escape') { setDrawer(false); setSheet(''); closeSpeech(); }
    if (event.key === 'Tab' && (drawer || sheet || speechMode === 'voice')) {
      const dialog = event.currentTarget.querySelector<HTMLElement>('[role="dialog"]');
      const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]');
      if (controls?.length) { const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }
  }}>
    <div className="m-content" inert={drawer || !!sheet || speechMode === 'voice' || !profile}>
      {page === 'endpoints' ? <header className="m-page-header"><button type="button" className="m-page-back" aria-label={returnPage === 'settings' ? 'Back to Settings' : 'Back to chat'} onClick={() => navigate(returnPage)}><Icon name="arrow"/></button><h1>Custom Endpoint</h1><span/></header> : page !== 'chat' ? null : home ? <MobileHomeHeader mode={mode} temporary={chat.temporary} onSidebar={() => setDrawer(true)} onTemporary={temporaryChat} onMode={value => { setMode(value); localStorage.setItem('desktop-chat-mode', value); }}/ > : <header className="m-header m-conversation-header">
        <Button icon="mobile-menu" label="Open sidebar" className="m-round" onClick={() => setDrawer(true)}/>
        <span/>
        <div className="m-header-pill"><Button icon="edit" label="New chat" onClick={() => newChat()}/><Button icon="dots" label="Conversation options" onClick={() => setSheet('conversation')}/></div>
      </header>}
      {page === 'endpoints' ? <div className="m-endpoints d-mobile"><EndpointSettings onSaved={() => { setNotice('Endpoint tersimpan.'); navigate(returnPage); }} onNotice={setNotice}/></div> : page === 'settings' ? <MobileSettings profile={profile} settings={preferences.settings} provider={chat.endpoint?.name} model={chat.endpoint?.model} titles={chat.titles} archived={archived} update={preferences.update} onProfile={setProfile} onEndpoint={() => navigate('endpoints')} onModels={() => setSheet('models')} onPlugins={() => navigate('plugins')} onOpen={openChat} onArchive={archive} onNotice={setNotice} onClose={() => navigate('chat')} onSignOut={() => { try { chat.stop(); signOutMobileProfile(); newChat(); setName(''); setProfile(null); } catch { setNotice('Profil belum dapat dilepas.'); } }}/>
      : page !== 'chat' ? <MobileLibrary page={page} store={clientData} titles={chat.titles} initialProject={searchProject} onClose={() => { setSearchProject(''); navigate(returnPage); }} onOpen={openChat} onDraft={text => { newChat(); setDraft(text); }} onNotice={setNotice}/> : <>
        <div className="m-messages" ref={scroll} onScroll={() => { const el = scroll.current; if (el) setAboveBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 40); }}>
          {home && chat.temporary && <MobileTemporaryHome onLearnMore={() => setSheet('temporary')} onPersonalization={() => setSheet('personalization')} personalized={personalization.instructions || personalization.memories}/>}
          {chat.messages.map((message, index) => <article key={index} className={'m-message m-' + message.role}>
            {message.role === 'user' ? <div className="m-bubble">{message.text}{message.attachments?.map(file => <div key={file.id} className="m-attached"><Icon name="page" size={16}/>{file.name}</div>)}</div> : <><RichText text={chat.answerText(message)}/>{chat.answerText(message) && !(chat.busy && index === chat.messages.length - 1) && <MobileResponseActions text={chat.answerText(message)} onNotice={setNotice} onMore={article => { responseArticle.current = article; setResponseText(chat.answerText(message)); setSheet('response-actions'); }}/>}</>}
          </article>)}
          {chat.busy && (!chat.messages.at(-1) || chat.messages.at(-1)?.role === 'user' || !chat.answerText(chat.messages.at(-1)!)) && <div className="m-waiting" role="status" aria-label="Menunggu jawaban"><span/></div>}
        </div>
        <footer ref={footer} className={`m-footer${home ? ' m-footer-home' : ''}${composerState.focused || composerState.keyboardOpen ? ' m-composer-engaged' : ''}${composerState.phase === 'first-focus' ? ' m-composer-expanded' : ''}`}>
          {aboveBottom && <Button icon="arrow" label="Scroll to latest" className="m-to-bottom" onClick={() => { setAboveBottom(false); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }}/ >}
          {home && !chat.temporary && preferences.settings.suggestions && <div className="m-suggestions">{['Summarize the files in my project', 'Review my code for bugs', 'Help me plan the next feature'].map(value => <button key={value} onClick={() => { setDraft(value); textarea.current?.focus(); }}><Icon name="github" size={20}/><span>{value}</span></button>)}</div>}
          {chat.error && <div className="m-error" role="alert">{chat.error}<div><button onClick={() => navigate('endpoints')}>Pengaturan</button>{!chat.busy && chat.messages.at(-1)?.role === 'user' && <button onClick={() => void chat.send('', [], true, personalization)}>Coba lagi</button>}</div></div>}
          {files.length > 0 && <div className="m-attachments">{files.map(file => <button key={file.id} aria-label={'Remove ' + file.name} onClick={() => setFiles(previous => previous.filter(item => item.id !== file.id))}>{file.name} ×</button>)}</div>}
          {speechMode === 'dictation' ? <MobileSpeech mode="dictation" onClose={closeSpeech} onDictation={value => { setDraft(previous => (previous + ' ' + value).trim()); setSpeechMode(''); }} onReply={voiceReply}/> : <MobileComposer input={textarea} value={draft} expanded={composerState.phase === 'first-focus'} engaged={composerState.focused || composerState.keyboardOpen} uploading={uploading} busy={chat.busy} hasFiles={!!files.length} idleSend={chat.temporary || mode === 'Work'}
            onChange={value => setDraft(preferences.settings.smartPunctuation ? smartPunctuation(value) : value)} onFocus={() => setComposerState(focusComposer)} onBlur={() => setComposerState(blurComposer)} onAttach={() => setSheet('attachments')}
            onDictate={() => setSpeechMode('dictation')} onSend={() => void send()} onStop={chat.stop} onVoice={() => setSpeechMode('voice')}/>}

        </footer>
      </>}
    </div>
    <input hidden type="file" accept="image/*" capture="environment" ref={cameraPicker} onChange={event => void attach(event.target.files)}/>
    <input hidden type="file" accept="image/*" multiple ref={photoPicker} onChange={event => void attach(event.target.files)}/>
    <input hidden type="file" multiple ref={picker} onChange={event => void attach(event.target.files)}/>
    <MobilePresence show={drawer}><MobileSidebar closeRef={closeDrawer} name={profile?.name || 'Profil'} activeTitle={chat.title} titles={chat.titles} pinned={pinned} archived={archived} documents={clientData.data.documents} onProject={id => { setSearchProject(id); navigate('projects'); }} onClose={() => setDrawer(false)} onOpen={openChat} onNew={() => newChat()} onSettings={() => navigate('settings')} onNavigate={next => { setSearchProject(''); navigate(next); }}/></MobilePresence>

    <MobilePresence show={!!sheet || !profile}><div className="m-overlay"><button className="m-backdrop" aria-label="Close dialog" disabled={!profile} onClick={() => setSheet('')}/><section className={`m-sheet${sheet === 'temporary' ? ' m-temporary-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={!profile ? 'Welcome' : sheet === 'attachments' ? 'Add attachments' : sheet === 'response-actions' ? 'Response options' : sheet === 'models' ? 'Select model' : sheet === 'temporary' ? 'Temporary chat' : sheet === 'personalization' ? 'Personalization' : 'Conversation options'}>{profile && <button className="m-sheet-close" ref={closeSheet} aria-label="Close dialog" onClick={() => setSheet('')}><Icon name="close"/></button>}
      {!profile ? <form onSubmit={event => { event.preventDefault(); try { setProfile(saveLocalProfile(name)); setName(''); } catch (error) { setNotice(String(error)); } }}><img className="m-brand" src="/supergpt-logo.png" alt=""/><h1>SuperGPT by Sakelar</h1><p>Masukkan namamu untuk mulai.</p><label>Nama kamu<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label><button className="m-primary">Lanjut</button></form> : sheet === 'attachments' ? <><h2>Tambahkan ke chat</h2><div className="m-attachment-choices"><button onClick={() => { setSheet(''); cameraPicker.current?.click(); }}><MobileControlIcon name="camera"/><span>Kamera</span></button><button onClick={() => { setSheet(''); photoPicker.current?.click(); }}><MobileControlIcon name="photo"/><span>Foto</span></button><button onClick={() => { setSheet(''); picker.current?.click(); }}><Icon name="folder"/><span>File</span></button></div><p>Tambahkan foto atau file dari perangkatmu.</p></> : sheet === 'models' ? <><h2>Pilih model</h2>{chat.store.profiles.map(endpoint => <section key={endpoint.id}><h3>{endpoint.name}</h3>{[...new Set([endpoint.model, ...endpoint.models])].filter(Boolean).map(model => <button className="m-model-option" key={model} aria-pressed={chat.endpoint?.id === endpoint.id && chat.endpoint.model === model} onClick={() => { try { saveEndpointStore({ ...chat.store, selectedId: endpoint.id, profiles: chat.store.profiles.map(p => p.id === endpoint.id ? { ...p, model } : p) }, loadEndpointKeys(chat.store.profiles)); setSheet(''); } catch { setNotice('Pilihan model belum tersimpan.'); } }}>{model}</button>)}</section>)}<button onClick={() => navigate('endpoints')}>Kelola endpoint</button></> : sheet === 'temporary' ? <><div className="m-temporary-art"><MobileControlIcon name="temporary-checked"/></div><h2>Temporary chat</h2><p>Chat ini tidak disimpan dalam riwayat perangkat. Penyedia API menentukan penyimpanan permintaan di servernya.</p><button className="m-primary" onClick={() => { localStorage.setItem('client-temporary-intro-v1', 'seen'); setSheet(''); }}>Continue</button></> : sheet === 'personalization' ? <><h2>Personalization</h2><p>Pilih konteks lokal untuk chat sementara ini. Pilihan ini tidak mengubah pengaturan global.</p><label className="m-personalization-option"><span>Saved memories</span><input type="checkbox" checked={personalization.memories} onChange={event => { chat.stop(); setPersonalization(previous => ({ ...previous, memories: event.target.checked })); }}/></label><label className="m-personalization-option"><span>Custom instructions</span><input type="checkbox" checked={personalization.instructions} onChange={event => { chat.stop(); setPersonalization(previous => ({ ...previous, instructions: event.target.checked })); }}/></label><button className="m-primary" onClick={() => setSheet('')}>Done</button></> : sheet === 'response-actions' ? <><h2>Respons</h2><button onClick={() => { setSheet(''); requestAnimationFrame(() => { const body = responseArticle.current?.querySelector('.d-rich-text'); if (body) window.getSelection()?.selectAllChildren(body); }); }}>Pilih teks</button><button onClick={async () => { try { await navigator.clipboard.writeText(responseText); setSheet(''); setNotice('Disalin.'); } catch { setNotice('Penyalinan tidak tersedia.'); } }}>Salin teks</button><button onClick={() => { void shareMobileResponse(responseText, setNotice); }}>Bagikan</button></> : sheet === 'delete' ? <><h2>Hapus percakapan?</h2><p>Riwayat lokal percakapan ini akan dihapus dari perangkat.</p><button onClick={() => setSheet('conversation')}>Batal</button><button onClick={() => { chat.remove(chat.title); setSheet(''); }}>Hapus percakapan</button></> : <><h2>{chat.title}</h2><button onClick={temporaryChat}><Icon name="temporary"/>Temporary chat</button><button onClick={() => { if (!chat.temporary) { const next = pinned.includes(chat.title) ? pinned.filter(t => t !== chat.title) : [...pinned, chat.title]; localStorage.setItem('desktop-pinned', JSON.stringify(next)); } setSheet(''); }}>Pin / unpin chat</button><button onClick={() => setSheet('delete')}>Hapus percakapan</button></>}
    </section></div></MobilePresence>
    {speechMode === 'voice' && <MobileSpeech mode="voice" onClose={closeSpeech} onDictation={() => {}} onReply={voiceReply}/>}
    {notice && <div className="m-notice" role="status">{notice}</div>}
  </div>;
}
