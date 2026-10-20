import { connectSdk } from '../chatkit/transport';
import { loadSettings } from '../lib/clientSettings';
import { streamEndpointChat, type ProviderMessage } from '../lib/endpointChat';
import type { EndpointProfile } from '../lib/endpointProfiles';
import { loadMainAi, mainAgentAvailable, mainMcpProfiles, mainServerToken } from './settings';
import type { Widgets } from '@openai/chatkit';

export type AgentDecision = { kind: 'approval'; itemId: string; callId: string; allow: boolean } | { kind: 'answer'; itemId: string; text: string };
export type AgentItem = { id: string; type: 'widget' | 'structured_input' | 'generated_image'; widget?: Widgets.WidgetRoot; status?: string; inputs?: { id: string; question: string; options?: { value: string }[]; answer?: { values: string[] } }[]; image?: { url: string } };
export type AgentMessageState = { runId?: string; progress?: string; notice?: string; active: boolean; pending: boolean; sources: { title: string; url: string }[]; items: AgentItem[] };
const decisions = new Map<string, (decision: AgentDecision) => void>();
export const canAnswerAgent = (id?: string) => !!id && decisions.has(id);
export function answerAgent(id: string, decision: AgentDecision) { const resolve = decisions.get(id); if (!resolve) return false; decisions.delete(id); resolve(decision); return true; }
function waitDecision(id: string, signal: AbortSignal, publish: () => void): Promise<AgentDecision> {
  return new Promise((resolve, reject) => { const cancel = () => { decisions.delete(id); reject(signal.reason || Error('Dibatalkan')); }; if (signal.aborted) { cancel(); return; } signal.addEventListener('abort', cancel, { once: true }); decisions.set(id, decision => { signal.removeEventListener('abort', cancel); resolve(decision); }); publish(); });
}
export async function consumeAgentEvents(response: Response, signal: AbortSignal, receive: (event: any) => void) {
  if (!response.ok || !response.body) throw Error('Server AI tidak dapat memproses permintaan. Periksa endpoint dan pengaturan fitur AI.');
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
  const parse = (block: string) => { const raw = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (!raw) return; const event = JSON.parse(raw); if (event.type === 'error') throw Error(event.message || 'Permintaan agen gagal.'); receive(event); };
  try { for (;;) { signal.throwIfAborted(); const result = await reader.read(); buffer += decoder.decode(result.value, { stream: !result.done }); if (buffer.length > 18 * 1024 * 1024) throw Error('Respons agen terlalu besar.'); buffer = buffer.replace(/\r\n/g, '\n'); let at; while ((at = buffer.indexOf('\n\n')) >= 0) { const block = buffer.slice(0, at); buffer = buffer.slice(at + 2); parse(block); } if (result.done) { if (buffer.trim()) parse(buffer); break; } } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function streamMainChat(profile: EndpointProfile, key: string, model: string, messages: ProviderMessage[], signal: AbortSignal, onText: (text: string, reasoning?: string) => void, effort?: string, onUsage?: (usage: { input?: number; output?: number }) => void, onState?: (state: AgentMessageState) => void, temporary = false) {
  const config = loadMainAi();
  if (!config.enabled) return streamEndpointChat(profile, key, model, messages, signal, onText, effort, onUsage);
  if (!mainAgentAvailable(config)) {
    if (config.runtime === 'server') throw Error('Isi URL server AI atau pilih pemrosesan langsung di perangkat.');
    if (config.api === 'responses') throw Error('Responses tools memerlukan server AI. Pilih Chat Completions untuk MCP langsung.');
    const { streamDirectTools } = await import('./directTools');
    return streamDirectTools(profile, key, model, messages, signal, onText, waitDecision, effort, onUsage, onState);
  }
  const settings = loadSettings(), state: AgentMessageState = { active: true, pending: false, progress: 'Memproses…', sources: [], items: [] }, texts = new Map<string, string>();
  const publish = () => onState?.({ ...state, sources: [...state.sources], items: [...state.items] });
  const mergeSources = (sources: { title: string; url: string }[]) => { for (const source of sources) { try { const url = new URL(source.url); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !state.sources.some(value => value.url === url.href)) state.sources.push({ title: String(source.title || url.hostname).slice(0, 240), url: url.href }); } catch { /* Invalid source. */ } } state.sources = state.sources.slice(0, 20); };
  const connection = await connectSdk({ server: config.server, domainKey: '', options: { api: config.api, tools: true, vision: true, pdf: false, web: config.web, webSearch: config.webSearch, code: false, images: false, mcp: config.mcp && settings.pluginsEnabled, vectorStores: [], transcriptionModel: '', realtimeModel: '' } }, { ...profile, model }, key, mainServerToken(), { ...settings, instructions: '', memoriesEnabled: false, writingStyle: 'balanced' }, { signal, mcp: config.mcp && settings.pluginsEnabled ? mainMcpProfiles() : [], reasoningEffort: effort });
  let usage: { input?: number; output?: number } = {};
  let payload: unknown = { messages: messages.map(({ role, text, images }) => ({ role, text, images })), temporary };
  try {
    for (;;) {
      let paused = false, finished = false;
      const response = await connection.fetch(connection.apiUrl.replace(/\/chatkit$/, '/main'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
      await consumeAgentEvents(response, signal, event => {
        if (event.type === 'main.run') state.runId = event.id;
        if (event.type === 'main.paused') paused = true;
        if (event.type === 'main.done') finished = true;
        if (event.type === 'progress_update') { state.progress = event.text; publish(); }
        if (event.type === 'main.notice') { state.notice = String(event.text || '').slice(0, 500); publish(); }
        if (event.type === 'main.sources') { mergeSources(event.sources || []); publish(); }
        const item = event.item;
        if (item?.type === 'assistant_message') {
          texts.set(item.id, (item.content || []).map((part: any) => part.text || '').join(''));
          for (const part of item.content || []) mergeSources((part.annotations || []).filter((annotation: any) => annotation.source?.type === 'url').map((annotation: any) => annotation.source));
          onText([...texts.values()].filter(Boolean).join('\n\n')); publish();
        } else if (event.type === 'thread.item.updated' && event.update?.type === 'assistant_message.content_part.text_delta') {
          texts.set(event.item_id, (texts.get(event.item_id) || '') + event.update.delta); onText([...texts.values()].filter(Boolean).join('\n\n'));
        } else if (item && ['widget', 'structured_input', 'generated_image'].includes(item.type)) { const at = state.items.findIndex(value => value.id === item.id); if (at < 0) state.items.push(item); else state.items[at] = item; publish(); }
        if (event.type === 'client_effect' && event.name === 'sdk.usage') { for (const key of ['input', 'output'] as const) if (typeof event.data?.[key] === 'number') usage[key] = (usage[key] || 0) + event.data[key]; onUsage?.({ ...usage }); }
      });
      if (!paused) { if (!finished) throw Error('Koneksi agen berakhir sebelum jawaban selesai.'); break; }
      state.pending = true; state.progress = 'Menunggu jawabanmu';
      const decision = await waitDecision(state.runId!, signal, publish);
      state.pending = false; state.progress = 'Melanjutkan…'; publish(); payload = { resume: state.runId, decision };
    }
  } finally { if (state.runId) decisions.delete(state.runId); state.active = false; state.pending = false; state.progress = ''; publish(); await connection.close().catch(() => {}); }
}
