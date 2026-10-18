import { useEffect, useRef, useState } from 'react';
import { beginMobileBackgroundTask } from './mobileBackground';
import { loadEndpointKeys, loadEndpointStore } from './endpointProfiles';
import { parseThinking, streamEndpointChat } from './endpointChat';
import { loadSettings, prepareChatMessages, recordUsage } from './clientSettings';
import { resolveMessageFiles, type FileRef } from './fileLibrary';
import { providerErrorMessage } from './providerErrors';
import { isNativeDesktop } from './nativeDesktop';
import { changeConversationName } from './mobileConversationMetadata';

export type MobileMessage = { role: 'user' | 'assistant'; text: string; reasoning?: string; timestamp?: number; attachments?: FileRef[] };
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }

// UI-independent conversation state. Uses the same profile, transport and history formats as desktop.
export function useMobileConversation() {
  const [store, setStore] = useState(loadEndpointStore);
  const [content, setContent] = useState<Record<string, MobileMessage[]>>(() => read('desktop-chat-content', {}));
  const [titles, setTitles] = useState<string[]>(() => read('desktop-titles', []));
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState<MobileMessage[]>([]);
  const [temporary, setTemporary] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const endpoint = store.profiles.find(p => p.id === store.selectedId);
  useEffect(() => {
    const refresh = () => { active.current?.abort(); setStore(loadEndpointStore()); };
    window.addEventListener('client-endpoints-changed', refresh);
    return () => { window.removeEventListener('client-endpoints-changed', refresh); active.current?.abort(); active.current = null; };
  }, []);
  function stop() { active.current?.abort(); }
  function reset(temp = false) { active.current?.abort(); active.current = null; setBusy(false); setError(''); setMessages([]); setTitle(''); setTemporary(temp); }
  function open(name: string) { reset(); setTitle(name); setMessages(content[name] || []); }
  function remove(name: string) {
    if (busy && title === name) { const message = 'Hentikan jawaban sebelum menghapus percakapan.'; setError(message); return message; }
    try { changeConversationName(localStorage, name, null); setContent(read('desktop-chat-content', {})); setTitles(read('desktop-titles', [])); if (title === name) reset(); }
    catch { const message = 'Percakapan belum dapat dihapus.'; setError(message); return message; }
  }
  function rename(oldName: string, newName: string) {
    if (busy && title === oldName) return 'Tunggu jawaban selesai sebelum mengganti nama.';
    try { changeConversationName(localStorage, oldName, newName); setContent(read('desktop-chat-content', {})); setTitles(read('desktop-titles', [])); if (title === oldName) setTitle(newName.trim()); }
    catch (failure) { return failure instanceof Error ? failure.message : 'Nama percakapan belum tersimpan.'; }
  }
  async function send(text: string, attachments: FileRef[] = [], retry = false, personalization: { memories: boolean; instructions: boolean; reasoningEffort?: string } = { memories: false, instructions: true }, onCompleted?: (answer: string) => void) {
    if (active.current || (!retry && !text.trim() && !attachments.length)) return false;
    if (!endpoint) { setError('Tambahkan endpoint dan pilih model di Pengaturan.'); return false; }
    const key = loadEndpointKeys(store.profiles)[endpoint.id] || '';
    if (endpoint.auth === 'bearer' && !key.trim()) { setError('Masukkan API key sesi ini di Custom Endpoint.'); return false; }
    const next: MobileMessage[] = retry ? messages.filter((m, i) => i !== messages.length - 1 || m.role !== 'assistant') : [...messages, { role: 'user', text: text.trim(), attachments, timestamp: Date.now() }];
    if (retry && next.at(-1)?.role !== 'user') return false;
    const base = next[0]?.text.slice(0, 60) || attachments[0]?.name || 'New chat';
    let name = title || base;
    if (!title) { let suffix = 2; while (titles.includes(name)) name = `${base} (${suffix++})`; }
    const controller = new AbortController(); active.current = controller;
    const releaseBackground = beginMobileBackgroundTask(crypto.randomUUID());
    const settings = loadSettings(), timeout = setTimeout(() => controller.abort('timeout'), settings.timeoutSeconds * 1000);
    setBusy(true); setError(''); setTitle(name); setMessages(next);
    let answer = '', reasoning = '', failed = false;
    let reported: { input?: number; output?: number } = {};
    const publish = (items: MobileMessage[]) => {
      if (active.current !== controller) return;
      setMessages(items);
      if (!temporary) {
        // Read on each publication so another window's saved chats are preserved.
        const all = { ...read<Record<string, MobileMessage[]>>('desktop-chat-content', {}), [name]: items };
        const names = [name, ...read<string[]>('desktop-titles', []).filter(value => value !== name)];
        try { localStorage.setItem('desktop-chat-content', JSON.stringify(all)); localStorage.setItem('desktop-titles', JSON.stringify(names)); setContent(all); setTitles(names); }
        catch { setError('Penyimpanan percakapan penuh.'); }
      }
    };
    const current = (): MobileMessage[] => answer || reasoning ? [...next, { role: 'assistant', text: answer, reasoning, timestamp: Date.now() }] : next;
    publish(next);
    try {
      const hydrated = await resolveMessageFiles(next, controller.signal);
      await streamEndpointChat(endpoint, key, endpoint.model, prepareChatMessages(hydrated, settings, { suppressMemories: temporary && !personalization.memories, suppressInstructions: temporary && !personalization.instructions }), controller.signal, (value, thought) => {
        answer = value; reasoning = thought || ''; publish(current());
      }, personalization.reasoningEffort || ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'][settings.defaultEffort], value => { reported = value; });
    } catch (failure) {
      failed = true;
      if (active.current === controller) setError(controller.signal.aborted ? controller.signal.reason === 'timeout' ? 'Penyedia terlalu lama merespons.' : 'Jawaban dihentikan.' : providerErrorMessage(failure, isNativeDesktop(), 'Jawaban gagal dimuat.'));
    } finally {
      releaseBackground(); clearTimeout(timeout);
      try { recordUsage({ provider: endpoint.name, model: endpoint.model, source: 'chat', status: controller.signal.aborted ? 'interrupted' : failed ? 'failed' : 'completed', ...reported }); } catch { /* Usage is optional. */ }
      if (active.current === controller) { publish(current()); active.current = null; setBusy(false); onCompleted?.(!failed && !controller.signal.aborted ? answer : ''); }
    }
    return true;
  }
  return { store, endpoint, titles, title, messages, temporary, busy, error, reset, open, remove, rename, send, stop, answerText: (message: MobileMessage) => parseThinking(message.text, message.reasoning).content };
}
