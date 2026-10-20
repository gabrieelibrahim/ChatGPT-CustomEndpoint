import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { UIIcon as Icon } from '../components/UIIcon';
import { AgentMessageExtras } from '../agent/AgentMessageExtras';
import { MobileStreamingReply } from './MobileStreamingReply';
import { MobileEndPull } from './MobileEndPull';
import { mobileComposerKeyboard } from './composerKeyboard';
import { EndpointSettings } from '../desktop/EndpointSettings';
import { MobileConversationMenu } from './MobileConversationMenu';
import { bindHomeShortcut, pinHomeShortcut } from './homeShortcut';
import { logDiagnostic } from '../lib/diagnosticLog';
import { MobileAttachment } from './MobileAttachment';
import { MobileAttachmentMenu } from './MobileAttachmentMenu';
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
import { bindSettingsBack } from './settingsBack';
import { MobilePageTransition } from './MobilePageTransition';
import { MobileLibrary } from './MobileLibrary';
import { useClientData } from '../desktop/ClientCollections';
import { smartPunctuation } from '../lib/clientSettings';
import { endpointVaultState } from '../lib/mobileEndpointVault';
import { signOutMobileProfile } from '../lib/mobileProfile';

function Button({ icon, label, onClick, children, ...props }: { icon?: string; label: string; onClick: () => void; children?: ReactNode; disabled?: boolean; className?: string; 'aria-pressed'?: boolean }) {
  return <button type="button" aria-label={label} onClick={onClick} {...props}>{icon && <Icon name={icon} size={22}/ >}{children}</button>;
}

export function MobileApp() {
  const chat = useMobileConversation();
  const [profile, setProfile] = useState(loadLocalProfile), [name, setName] = useState('');
  const [page, setPage] = useState<'chat' | 'settings' | 'endpoints' | MobileDestination>('chat');
  const [returnPage, setReturnPage] = useState<'chat' | 'settings'>('chat');
  const [settingsScreen, setSettingsScreen] = useState('root');
  const [searchProject, setSearchProject] = useState('');
  const [drawer, setDrawer] = useState(false), [sheet, setSheet] = useState('');
  const [mediaPreview, setMediaPreview] = useState(false), mediaClose = useRef<(() => void) | null>(null);
  const [chatSearch, setChatSearch] = useState<string | null>(null), [searchHit, setSearchHit] = useState(0);
  const [pinRevision, setPinRevision] = useState(0);
  const [thinkHarder, setThinkHarder] = useState(false);
  const [speechMode, setSpeechMode] = useState<'' | 'dictation' | 'voice'>('');
  const [draft, setDraft] = useState(''), [files, setFiles] = useState<FileRef[]>([]), [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(''), [mode, setMode] = useState<'Chat' | 'Work'>(() => localStorage.getItem('desktop-chat-mode') === 'Work' ? 'Work' : 'Chat');
  const preferences = useClientSettings(setNotice);
  const remindersEnabled = useRef(preferences.settings.notifications);
  remindersEnabled.current = preferences.settings.notifications;
  const clientData = useClientData(message => { if (!message.startsWith('Pengingat:') || remindersEnabled.current) setNotice(message); });
  const [archived, setArchived] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('desktop-archived') || '[]'); return Array.isArray(value) ? value.filter((title): title is string => typeof title === 'string') : []; } catch { return []; } });
  function archive(titles: string[]) { try { localStorage.setItem('desktop-archived', JSON.stringify(titles)); setArchived(titles); } catch { setNotice('Arsip belum tersimpan.'); } }
  function openChat(title: string) { setChatSearch(null); setThinkHarder(false); chat.open(title); setPage('chat'); setDrawer(false); setAboveBottom(false); }
  const [height, setHeight] = useState(window.visualViewport?.height || window.innerHeight);
  const [composerState, setComposerState] = useState(() => initialComposerState(window.visualViewport?.height || window.innerHeight, window.innerWidth));
  const [aboveBottom, setAboveBottom] = useState(false);
  const [personalization, setPersonalization] = useState({ memories: false, instructions: true });
  const responseArticle = useRef<HTMLElement | null>(null);
  const [responseText, setResponseText] = useState('');
  const footer = useRef<HTMLElement>(null), cameraPicker = useRef<HTMLInputElement>(null), photoPicker = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), picker = useRef<HTMLInputElement>(null), closeDrawer = useRef<HTMLButtonElement>(null), closeSheet = useRef<HTMLButtonElement>(null);
  const streamContent = useRef<HTMLDivElement>(null);
  const initialKeyboard = useRef(false);
  useEffect(() => {
    const preview = (event: Event) => { const close = (event as CustomEvent<unknown>).detail; mediaClose.current = typeof close === 'function' ? close as () => void : null; setMediaPreview(!!mediaClose.current); };
    window.addEventListener('client-media-preview', preview); return () => window.removeEventListener('client-media-preview', preview);
  }, []);
  useEffect(() => {
    if (initialKeyboard.current || !profile || page !== 'chat') return;
    initialKeyboard.current = true;
    const frame = requestAnimationFrame(() => { textarea.current?.focus({ preventScroll: true }); mobileComposerKeyboard('show'); });
    return () => cancelAnimationFrame(frame);
  }, [profile, page]);
  useEffect(() => {
    const resize = () => { const nextHeight = window.visualViewport?.height || window.innerHeight; setHeight(nextHeight); setComposerState(state => resizeComposer(state, nextHeight, window.innerWidth, document.activeElement === textarea.current)); };
    window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    const vaultChanged = () => { if (endpointVaultState() === 'error') setNotice('API key belum tersimpan aman. Buka Custom Endpoint dan simpan ulang.'); };
    const toast = (event: Event) => { const message = (event as CustomEvent<unknown>).detail; if (typeof message === 'string') setNotice(message); };
    vaultChanged(); window.addEventListener('client-endpoint-vault-changed', vaultChanged); window.addEventListener('client-toast', toast);
    return () => { window.removeEventListener('client-endpoint-vault-changed', vaultChanged); window.removeEventListener('client-toast', toast); };
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
  useEffect(() => {
    const content = streamContent.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (!aboveBottom) scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); });
    observer.observe(content);
    return () => observer.disconnect();
  }, [page, aboveBottom]);
  const requestContext = { ...personalization, reasoningEffort: thinkHarder ? 'high' : undefined };
  function closeSpeech() { if (speechMode === 'voice') chat.stop(); setSpeechMode(''); }
  async function voiceReply(value: string) {
    let reply = '';
    const accepted = await chat.send(value, [], false, requestContext, answer => { reply = answer; });
    if (!accepted || !reply.trim()) throw Error('Penyedia belum mengembalikan jawaban. Periksa endpoint dan model yang dipilih.');
    return reply;
  }
  function newChat(temp = false) { setChatSearch(null); setThinkHarder(false); setSpeechMode(''); chat.reset(temp); setDraft(''); setFiles([]); setDrawer(false); setPage('chat'); setSheet(''); setAboveBottom(false); setPersonalization({ memories: false, instructions: true }); }
  function navigate(next: typeof page) { setSpeechMode(''); if (next !== 'chat' && next !== 'settings') setReturnPage(page === 'settings' ? 'settings' : 'chat'); if (next === 'settings') { setName(profile?.name || ''); if (page === 'chat') setSettingsScreen('root'); } setPage(next); setDrawer(false); setSheet(''); }
  function backFromSettings() {
    if (!window.dispatchEvent(new Event('client-settings-back', { cancelable: true }))) return;
    if (sheet) { setSheet(''); return; }
    if (page !== 'settings') { navigate('settings'); return; }
    if (settingsScreen !== 'root') setSettingsScreen('root'); else navigate('chat');
  }
  const settingsBack = useRef(backFromSettings); settingsBack.current = () => {
    if (mediaClose.current) { mediaClose.current(); return; }
    if (speechMode) { closeSpeech(); return; }
    if (sheet) { setSheet(''); return; }
    if (drawer) { setDrawer(false); return; }
    if (chatSearch !== null) { setChatSearch(null); return; }
    backFromSettings();
  };
  const inSettings = page === 'settings' || (page !== 'chat' && returnPage === 'settings');
  useEffect(() => inSettings || sheet || drawer || speechMode || mediaPreview || chatSearch !== null ? bindSettingsBack(() => settingsBack.current()) : undefined, [inSettings, sheet, drawer, speechMode, mediaPreview, chatSearch !== null]);
  function temporaryChat() { const temp = !chat.temporary; newChat(temp); if (temp && localStorage.getItem('client-temporary-intro-v1') !== 'seen') setSheet('temporary'); }
  async function send() {
    if (uploading || chat.busy || (!draft.trim() && !files.length)) return;
    const value = draft, attached = files;
    textarea.current?.blur(); mobileComposerKeyboard('hide'); setComposerState(blurComposer);
    setDraft(''); setFiles([]); setAboveBottom(false);
    if (!await chat.send(value, attached, false, requestContext)) { setDraft(value); setFiles(attached); }
  }
  async function attach(incoming: FileList | null) {
    if (!incoming) return;
    setUploading(true);
    try { const added: FileRef[] = []; for (const file of Array.from(incoming)) added.push(await saveLibraryFile(file)); setFiles(previous => [...previous, ...added]); logDiagnostic('files', 'attached', { count: added.length }); }
    catch (error) { logDiagnostic('files', 'attach-failed', {}, 'error'); setNotice(error instanceof Error ? error.message : 'Lampiran gagal disimpan.'); }
    finally { setUploading(false); for (const input of [picker.current, cameraPicker.current, photoPicker.current]) if (input) input.value = ''; }
  }
  const shortcutOpen = useRef(openChat); shortcutOpen.current = openChat;
  useEffect(() => bindHomeShortcut(title => shortcutOpen.current(title), setNotice), []);
  useEffect(() => { logDiagnostic('app', 'opened', { native: '__TAURI_INTERNALS__' in window }); }, []);
  const matches = chatSearch?.trim() ? chat.messages.flatMap((message, index) => message.text.toLocaleLowerCase().includes(chatSearch.trim().toLocaleLowerCase()) ? [index] : []) : [];
  useEffect(() => { if (matches.length) { setAboveBottom(true); scroll.current?.querySelectorAll<HTMLElement>('article.m-message')[matches[searchHit % matches.length]]?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, [chatSearch, searchHit]);
  const home = !chat.messages.length;
  let pinned: string[] = [];
  try { const value = JSON.parse(localStorage.getItem('desktop-pinned') || '[]'); if (Array.isArray(value)) pinned = value.filter(title => typeof title === 'string'); } catch { /* Empty lists are safe. */ }

  return <div className={`m-app${page === 'chat' && home ? ' m-home' : ''}${chat.temporary ? ' m-temporary' : ''}`} style={{ height, '--m-action': preferences.settings.accent === '#2b6bca' ? '#2861df' : preferences.settings.accent } as CSSProperties} onKeyDown={event => {
    if (event.key === 'Escape') { if (inSettings && !drawer && !speechMode) backFromSettings(); else { setDrawer(false); setSheet(''); closeSpeech(); } }
    if (event.key === 'Tab' && (drawer || sheet || speechMode === 'voice' || mediaPreview)) {
      const dialog = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="dialog"],[role="menu"]')].at(-1);
      const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]');
      if (controls?.length) { const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }
  }}>
    <div className="m-content" inert={drawer || !!sheet || speechMode === 'voice' || mediaPreview || !profile}>
      <MobilePageTransition active={inSettings} identity={page === 'settings' ? 'settings/' + settingsScreen : page}>
      {page === 'endpoints' ? <header className="m-page-header"><button type="button" className="m-page-back" aria-label={returnPage === 'settings' ? 'Back to Settings' : 'Back to chat'} onClick={() => navigate(returnPage)}><Icon name="arrow"/></button><h1>Custom Endpoint</h1><span/></header> : page !== 'chat' ? null : home ? <MobileHomeHeader mode={mode} temporary={chat.temporary} onSidebar={() => setDrawer(true)} onTemporary={temporaryChat} onMode={value => { setMode(value); localStorage.setItem('desktop-chat-mode', value); }}/ > : <header className="m-header m-conversation-header">
        <Button icon="mobile-menu" label="Open sidebar" className="m-round" onClick={() => setDrawer(true)}/>
        <span/>
        <div className="m-header-pill"><Button icon="edit" label="New chat" onClick={() => newChat()}/><Button icon="dots" label="Conversation options" onClick={() => setSheet('conversation')}/></div>
      </header>}
      {page === 'endpoints' ? <div className="m-endpoints d-mobile"><EndpointSettings onSaved={() => { setNotice('Endpoint tersimpan.'); navigate(returnPage); }} onNotice={setNotice}/></div> : page === 'settings' ? <MobileSettings screen={settingsScreen} onScreen={setSettingsScreen} profile={profile} settings={preferences.settings} provider={chat.endpoint?.name} model={chat.endpoint?.model} titles={chat.titles} archived={archived} update={preferences.update} onProfile={setProfile} onEndpoint={() => navigate('endpoints')} onModels={() => setSheet('models')} onPlugins={() => navigate('plugins')} onOpen={openChat} onArchive={archive} onNotice={setNotice} onClose={() => navigate('chat')} onSignOut={() => { try { chat.stop(); signOutMobileProfile(); newChat(); setName(''); setProfile(null); } catch { setNotice('Profil belum dapat dilepas.'); } }}/>
      : page !== 'chat' ? <MobileLibrary backLabel={returnPage === 'settings' ? 'Back to Settings' : 'Back to chat'} page={page} store={clientData} titles={chat.titles} initialProject={searchProject} onClose={() => { setSearchProject(''); navigate(returnPage); }} onOpen={openChat} onDraft={text => { newChat(); setDraft(text); }} onNotice={setNotice}/> : <>
        {chatSearch !== null && <div className="m-chat-search"><Icon name="search" size={20}/><input autoFocus aria-label="Cari di chat" placeholder="Cari di chat" value={chatSearch} onChange={event => { setChatSearch(event.target.value); setSearchHit(0); }}/><span>{matches.length ? (searchHit % matches.length) + 1 : 0}/{matches.length}</span><button aria-label="Hasil berikutnya" disabled={!matches.length} onClick={() => setSearchHit(value => value + 1)}><Icon name="down" size={18}/></button><button aria-label="Tutup pencarian chat" onClick={() => setChatSearch(null)}><Icon name="close" size={20}/></button></div>}
        <div className="m-messages" ref={scroll} onScroll={() => { const el = scroll.current; if (el) setAboveBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 40); }}>
          <div className="m-message-stack" ref={streamContent}>
          {home && chat.temporary && <MobileTemporaryHome onLearnMore={() => setSheet('temporary')} onPersonalization={() => setSheet('personalization')} personalized={personalization.instructions || personalization.memories}/>}
          {chat.messages.map((message, index) => <article key={index} className={'m-message m-' + message.role + (matches.includes(index) ? ' m-chat-match' : '')}>
            {message.role === 'user' ? <div className="m-user-stack">{!!message.attachments?.length && <div className="m-message-files">{message.attachments.map(file => <MobileAttachment key={file.id} file={file}/>)}</div>}{message.text && <div className="m-bubble">{message.text}</div>}</div> : <><MobileStreamingReply text={chat.answerText(message)} streaming={chat.busy && index === chat.messages.length - 1}>{chat.answerText(message) && !(chat.busy && index === chat.messages.length - 1) && <MobileResponseActions text={chat.answerText(message)} onNotice={setNotice} onMore={article => { responseArticle.current = article; setResponseText(chat.answerText(message)); setSheet('response-actions'); }}/>}</MobileStreamingReply><AgentMessageExtras state={message.agent} streaming={chat.busy && index === chat.messages.length - 1}/></>}
          </article>)}
          {chat.busy && chat.messages.at(-1)?.role !== 'assistant' && <div className="m-waiting" role="status" aria-label="Menunggu jawaban"><span/></div>}
          <MobileEndPull scroll={scroll} enabled={!home && !chat.busy && !drawer && !sheet && !speechMode} conversation={chat.title} onNew={() => { newChat(); requestAnimationFrame(() => { textarea.current?.focus({ preventScroll: true }); mobileComposerKeyboard('show'); }); }}/>
          </div>
        </div>
        <footer ref={footer} className={`m-footer${home ? ' m-footer-home' : ''}${composerState.focused || composerState.keyboardOpen ? ' m-composer-engaged' : ''}${composerState.phase === 'first-focus' ? ' m-composer-expanded' : ''}`}>
          {aboveBottom && <Button icon="arrow" label="Scroll to latest" className="m-to-bottom" onClick={() => { setAboveBottom(false); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }}/ >}
          {home && !files.length && !chat.temporary && preferences.settings.suggestions && <div className="m-suggestions">{['Summarize the files in my project', 'Review my code for bugs', 'Help me plan the next feature'].map(value => <button key={value} onClick={() => { setDraft(value); textarea.current?.focus(); }}><Icon name="github" size={20}/><span>{value}</span></button>)}</div>}
          {chat.error && <div className="m-error" role="alert">{chat.error}<div><button onClick={() => navigate('endpoints')}>Pengaturan</button>{!chat.busy && chat.messages.at(-1)?.role === 'user' && <button onClick={() => void chat.send('', [], true, requestContext)}>Coba lagi</button>}</div></div>}
          {speechMode === 'dictation' ? <MobileSpeech mode="dictation" onClose={closeSpeech} onDictation={value => { setDraft(previous => (previous + ' ' + value).trim()); setSpeechMode(''); }} onReply={voiceReply}/> : <MobileComposer input={textarea} value={draft} expanded={composerState.phase === 'first-focus'} engaged={composerState.focused || composerState.keyboardOpen} uploading={uploading} busy={chat.busy} hasFiles={!!files.length} idleSend={chat.temporary || mode === 'Work'} attachments={files.length > 0 ? <div className="m-attachments">{files.map(file => <MobileAttachment key={file.id} file={file} pending onRemove={() => setFiles(previous => previous.filter(item => item.id !== file.id))}/>)}</div> : undefined}
            onChange={value => setDraft(preferences.settings.smartPunctuation ? smartPunctuation(value) : value)} onFocus={() => setComposerState(focusComposer)} onBlur={() => { setComposerState(blurComposer); mobileComposerKeyboard('hide'); }} onAttach={() => setSheet('attachments')}
            onDictate={() => setSpeechMode('dictation')} onSend={() => void send()} onStop={chat.stop} onVoice={() => setSpeechMode('voice')}/>}

        </footer>
      </>}
      </MobilePageTransition>
    </div>
    <input hidden type="file" accept="image/*" capture="environment" ref={cameraPicker} onChange={event => void attach(event.target.files)}/>
    <input hidden type="file" accept="image/*,video/*" multiple ref={photoPicker} onChange={event => void attach(event.target.files)}/>
    <input hidden type="file" multiple ref={picker} onChange={event => void attach(event.target.files)}/>
    <MobilePresence show={drawer}><MobileSidebar closeRef={closeDrawer} name={profile?.name || 'Profil'} activeTitle={chat.title} titles={chat.titles} pinned={pinned} archived={archived} onRename={(title, name) => { const failure = chat.rename(title, name); if (!failure) setArchived(previous => previous.map(value => value === title ? name.trim() : value)); return failure; }} onArchive={title => archive([...new Set([...archived, title])])} onRemove={title => { const failure = chat.remove(title); if (!failure) setArchived(previous => previous.filter(value => value !== title)); return failure; }} onNotice={setNotice} documents={clientData.data.documents} onProject={id => { setSearchProject(id); navigate('projects'); }} onClose={() => setDrawer(false)} onOpen={openChat} onNew={() => newChat()} onSettings={() => navigate('settings')} onNavigate={next => { setSearchProject(''); navigate(next); }}/></MobilePresence>

    <MobilePresence show={sheet === 'attachments'}><MobileAttachmentMenu firstRef={closeSheet} thinkHarder={thinkHarder} onClose={() => setSheet('')} onCamera={() => { setSheet(''); cameraPicker.current?.click(); }} onPhoto={() => { setSheet(''); photoPicker.current?.click(); }} onFile={() => { setSheet(''); picker.current?.click(); }} onPlugins={() => navigate('plugins')} onThink={() => { if (!thinkHarder && !chat.endpoint?.sendReasoning) { setNotice('Aktifkan Kirim reasoning_effort di Custom Endpoint untuk model yang mendukung.'); setSheet(''); return; } setThinkHarder(value => !value); setSheet(''); }}/></MobilePresence>
    <MobilePresence show={sheet === 'conversation'}><MobileConversationMenu title={chat.title} messages={chat.messages} temporary={chat.temporary} busy={chat.busy} pinned={pinned.includes(chat.title)} onClose={() => setSheet('')} onNotice={setNotice}
      onPin={() => { try { const next = pinned.includes(chat.title) ? pinned.filter(t => t !== chat.title) : [...pinned, chat.title]; localStorage.setItem('desktop-pinned', JSON.stringify(next)); setPinRevision(pinRevision + 1); setSheet(''); } catch { setNotice('Sematan belum tersimpan.'); } }}
      onSearch={() => { setSheet(''); setChatSearch(''); setSearchHit(0); }} onHome={() => { setSheet(''); if (!pinHomeShortcut(chat.title)) setNotice('Pintasan layar utama tersedia pada APK Android dengan launcher yang mendukung.'); }}
      onArchive={() => { archive([...new Set([...archived, chat.title])]); newChat(); setNotice('Percakapan diarsipkan.'); }} onRemove={() => chat.remove(chat.title)}/></MobilePresence>
    <MobilePresence show={(!!sheet && sheet !== 'attachments' && sheet !== 'conversation') || !profile}><div className="m-overlay"><button className="m-backdrop" aria-label="Close dialog" disabled={!profile} onClick={() => setSheet('')}/><section className={`m-sheet${sheet === 'temporary' ? ' m-temporary-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={!profile ? 'Welcome' : sheet === 'attachments' ? 'Add attachments' : sheet === 'response-actions' ? 'Response options' : sheet === 'models' ? 'Select model' : sheet === 'temporary' ? 'Temporary chat' : sheet === 'personalization' ? 'Personalization' : 'Conversation options'}>{profile && <button className="m-sheet-close" ref={closeSheet} aria-label="Close dialog" onClick={() => setSheet('')}><Icon name="close"/></button>}
      {!profile ? <form onSubmit={event => { event.preventDefault(); try { setProfile(saveLocalProfile(name)); setName(''); } catch (error) { setNotice(String(error)); } }}><img className="m-brand" src="/supergpt-logo.png" alt=""/><h1>SuperGPT by Sakelar</h1><p>Masukkan namamu untuk mulai.</p><label>Nama kamu<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label><button className="m-primary">Lanjut</button></form> : sheet === 'models' ? <><h2>Pilih model</h2>{chat.store.profiles.map(endpoint => <section key={endpoint.id}><h3>{endpoint.name}</h3>{[...new Set([endpoint.model, ...endpoint.models])].filter(Boolean).map(model => <button className="m-model-option" key={model} aria-pressed={chat.endpoint?.id === endpoint.id && chat.endpoint.model === model} onClick={() => { try { saveEndpointStore({ ...chat.store, selectedId: endpoint.id, profiles: chat.store.profiles.map(p => p.id === endpoint.id ? { ...p, model } : p) }, loadEndpointKeys(chat.store.profiles)); setSheet(''); } catch { setNotice('Pilihan model belum tersimpan.'); } }}>{model}</button>)}</section>)}<button onClick={() => navigate('endpoints')}>Kelola endpoint</button></> : sheet === 'temporary' ? <><div className="m-temporary-art"><MobileControlIcon name="temporary-checked"/></div><h2>Temporary chat</h2><p>Chat ini tidak disimpan dalam riwayat perangkat. Penyedia API menentukan penyimpanan permintaan di servernya.</p><button className="m-primary" onClick={() => { localStorage.setItem('client-temporary-intro-v1', 'seen'); setSheet(''); }}>Continue</button></> : sheet === 'personalization' ? <><h2>Personalization</h2><p>Pilih konteks lokal untuk chat sementara ini. Pilihan ini tidak mengubah pengaturan global.</p><label className="m-personalization-option"><span>Saved memories</span><input type="checkbox" checked={personalization.memories} onChange={event => { chat.stop(); setPersonalization(previous => ({ ...previous, memories: event.target.checked })); }}/></label><label className="m-personalization-option"><span>Custom instructions</span><input type="checkbox" checked={personalization.instructions} onChange={event => { chat.stop(); setPersonalization(previous => ({ ...previous, instructions: event.target.checked })); }}/></label><button className="m-primary" onClick={() => setSheet('')}>Done</button></> : sheet === 'response-actions' ? <><h2>Respons</h2><button onClick={() => { setSheet(''); requestAnimationFrame(() => { const body = responseArticle.current?.querySelector('.d-rich-text'); if (body) window.getSelection()?.selectAllChildren(body); }); }}>Pilih teks</button><button onClick={async () => { try { await navigator.clipboard.writeText(responseText); setSheet(''); setNotice('Disalin.'); } catch { setNotice('Penyalinan tidak tersedia.'); } }}>Salin teks</button><button onClick={() => { void shareMobileResponse(responseText, setNotice); }}>Bagikan</button></> : sheet === 'delete' ? <><h2>Hapus percakapan?</h2><p>Riwayat lokal percakapan ini akan dihapus dari perangkat.</p><button onClick={() => setSheet('conversation')}>Batal</button><button onClick={() => { chat.remove(chat.title); setSheet(''); }}>Hapus percakapan</button></> : <><h2>{chat.title}</h2><button onClick={temporaryChat}><Icon name="temporary"/>Temporary chat</button><button onClick={() => { if (!chat.temporary) { const next = pinned.includes(chat.title) ? pinned.filter(t => t !== chat.title) : [...pinned, chat.title]; localStorage.setItem('desktop-pinned', JSON.stringify(next)); } setSheet(''); }}>Pin / unpin chat</button><button onClick={() => setSheet('delete')}>Hapus percakapan</button></>}
    </section></div></MobilePresence>
    {speechMode === 'voice' && <MobileSpeech mode="voice" onClose={closeSpeech} onDictation={() => {}} onReply={voiceReply}/>}
    {notice && <div className="m-notice" role="status">{notice}</div>}
  </div>;
}
