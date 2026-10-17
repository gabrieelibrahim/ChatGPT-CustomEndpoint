import { useEffect, useRef, useState } from 'react';
import { loadEndpointKeys, loadEndpointStore } from './endpointProfiles';
import { parseThinking, streamEndpointChat } from './endpointChat';
import { loadSettings, prepareChatMessages, recordUsage } from './clientSettings';
import { resolveMessageFiles, type FileRef } from './fileLibrary';
import { providerErrorMessage } from './providerErrors';
import { isNativeDesktop } from './nativeDesktop';

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
    const next = { ...content }; delete next[name]; const names = titles.filter(t => t !== name);
    try { localStorage.setItem('desktop-chat-content', JSON.stringify(next)); localStorage.setItem('desktop-titles', JSON.stringify(names)); setContent(next); setTitles(names); if (title === name) reset(); }
    catch { setError('Percakapan belum dapat dihapus.'); }
  }
  async function send(text: string, attachments: FileRef[] = [], retry = false) {
    if (active.current || (!retry && !text.trim() && !attachments.length)) return false;
    if (!endpoint) { setError('Tambahkan endpoint dan pilih model di Pengaturan.'); return false; }
    const key = loadEndpointKeys(store.profiles)[endpoint.id] || '';
    if (endpoint.auth === 'bearer' && !key.trim()) { setError('Masukkan API key sesi ini di Custom Endpoint.'); return false; }
    const next: MobileMessage[] = retry ? messages.filter((m, i) => i !== messages.length - 1 || m.role !== 'assistant') : [...messages, { role: 'user', text: text.trim(), attachments, timestamp: Date.now() }];
    if (retry && next.at(-1)?.role !== 'user') return false;
    const base = next[0]?.text.slice(0, 60) || attachments[0]?.name || 'New chat';
    let name = title || base;
    if (!title) { let suffix = 2; while (titles.includes(name)) name = `${base} (${suffix++})`; }
    const names = [name, ...titles.filter(t => t !== name)];
    const controller = new AbortController(); active.current = controller;
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
        try { localStorage.setItem('desktop-chat-content', JSON.stringify(all)); localStorage.setItem('desktop-titles', JSON.stringify([...new Set([...names, ...read<string[]>('desktop-titles', [])])])); setContent(all); setTitles([...new Set([...names, ...read<string[]>('desktop-titles', [])])]); }
        catch { setError('Penyimpanan percakapan penuh.'); }
      }
    };
    const current = (): MobileMessage[] => answer || reasoning ? [...next, { role: 'assistant', text: answer, reasoning, timestamp: Date.now() }] : next;
    publish(next);
    try {
      const hydrated = await resolveMessageFiles(next, controller.signal);
      await streamEndpointChat(endpoint, key, endpoint.model, prepareChatMessages(hydrated, settings, { suppressMemories: temporary }), controller.signal, (value, thought) => {
        answer = value; reasoning = thought || ''; publish(current());
      }, ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'][settings.defaultEffort], value => { reported = value; });
    } catch (failure) {
      failed = true;
      if (active.current === controller) setError(controller.signal.aborted ? controller.signal.reason === 'timeout' ? 'Penyedia terlalu lama merespons.' : 'Jawaban dihentikan.' : providerErrorMessage(failure, isNativeDesktop(), 'Jawaban gagal dimuat.'));
    } finally {
      clearTimeout(timeout);
      try { recordUsage({ provider: endpoint.name, model: endpoint.model, source: 'chat', status: controller.signal.aborted ? 'interrupted' : failed ? 'failed' : 'completed', ...reported }); } catch { /* Usage is optional. */ }
      if (active.current === controller) { publish(current()); active.current = null; setBusy(false); }
    }
    return true;
  }
  return { store, endpoint, titles, title, messages, temporary, busy, error, reset, open, remove, send, stop, answerText: (message: MobileMessage) => parseThinking(message.text, message.reasoning).content };
}
