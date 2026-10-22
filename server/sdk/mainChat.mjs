import { runAgent } from './agents.mjs';
import { id, now } from './store.mjs';
import { inputError } from './config.mjs';

// Main chat owns its existing device history. Run buffers and pending tool
// states are transient; only explicitly approved notes/artifacts use disk.
class MainRunStore {
  constructor(persistent, owner, temporary) { this.persistent = persistent; this.owner = owner; this.temporary = temporary; this.data = { threads: [], files: [], notes: temporary ? [] : persistent.load(owner).notes }; this.images = new Map(); }
  load() { return this.data; }
  save(_owner, data) { this.data = data; if (!this.temporary) { const old = this.persistent.load(this.owner); old.notes = data.notes; this.persistent.save(this.owner, old); } }
  putThread(_owner, thread) { this.thread = thread; }
  bytes() { throw inputError('File ini berada di library perangkat.'); }
  generatedImage(owner, threadId, base64, baseUrl) { if (this.temporary) return { id: id('img'), preview_url: 'data:image/png;base64,' + base64 }; return this.persistent.generatedImage(owner, threadId, base64, baseUrl); }
}

export class MainChatService {
  constructor(persistent) { this.persistent = persistent; this.runs = new Map(); }
  prune() { for (const [key, run] of this.runs) if (!run.busy && Date.now() - run.touched > 15 * 60 * 1000) this.runs.delete(key); }
  async execute(session, payload, emit, signal, serverMcp) {
    this.prune(); let run, approval;
    const mcpProfiles = [...(session.options.mcp ? session.mcpProfiles || [] : []), ...(session.options.mcp ? serverMcp : [])].slice(0, 16);
    if (payload.resume) {
      run = this.runs.get(payload.resume);
      if (!run || run.owner !== session.owner || run.session !== session.token || run.busy || !run.thread.pending) throw inputError('Permintaan tool sudah berakhir. Kirim ulang pesan.');
      const decision = payload.decision;
      if (decision?.kind === 'approval') {
        const item = run.thread.items.find(item => item.id === decision.itemId && item.type === 'widget');
        if (typeof decision.allow !== 'boolean' || !item?.widget.children.some(child => child.onClickAction?.payload?.callId === decision.callId)) throw inputError('Persetujuan tidak valid.');
        approval = { callId: decision.callId, allow: decision.allow };
        item.widget = { type: 'Card', children: [{ type: 'Text', value: decision.allow ? 'Disetujui sekali' : 'Ditolak' }] }; await emit({ type: 'thread.item.replaced', item });
      } else if (decision?.kind === 'answer') {
        const item = run.thread.items.find(item => item.id === decision.itemId && item.type === 'structured_input' && item.status === 'pending');
        if (!item || typeof decision.text !== 'string' || decision.text.length > 2000) throw inputError('Jawaban tidak valid.');
        const callId = item.inputs[0].id; item.status = 'answered'; item.inputs[0].answer = { values: [decision.text], skipped: false };
        run.thread.answers ||= {}; run.thread.answers[callId] = item.inputs[0].answer; approval = { callId, allow: true }; await emit({ type: 'thread.item.replaced', item });
      } else throw inputError('Tindakan tidak dikenal.');
    } else {
      if (this.runs.size >= 32) throw inputError('Terlalu banyak permintaan aktif.');
      if (!Array.isArray(payload.messages) || !payload.messages.length || payload.messages.length > 500) throw inputError('Riwayat pesan tidak valid.');
      const history = payload.messages.map(message => {
        if (!['user', 'assistant'].includes(message.role) || typeof message.text !== 'string') throw inputError('Pesan tidak valid.');
        const images = message.images || []; if (!Array.isArray(images) || images.some(value => typeof value !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value))) throw inputError('Gambar tidak valid.');
        return { role: message.role, content: images.length ? [{ type: 'input_text', text: message.text }, ...images.map(image => ({ type: 'input_image', image, detail: 'auto' }))] : message.text };
      });
      if (history.at(-1).role !== 'user') throw inputError('Pesan terakhir harus dari pengguna.');
      const thread = { id: id('main'), title: null, created_at: now(), items: [], sdkHistory: history };
      run = { owner: session.owner, session: session.token, thread, store: new MainRunStore(this.persistent, session.owner, payload.temporary === true), busy: false, touched: Date.now() };
      this.runs.set(thread.id, run);
    }
    run.busy = true; run.touched = Date.now();
    try {
      await emit({ type: 'main.run', id: run.thread.id });
      await runAgent({ session, store: run.store, thread: run.thread, emit, signal, mcpProfiles, approval });
      if (run.thread.pending) await emit({ type: 'main.paused', id: run.thread.id }); else { await emit({ type: 'main.done', id: run.thread.id }); this.runs.delete(run.thread.id); }
    } catch (error) { this.runs.delete(run.thread.id); throw error; }
    finally { run.busy = false; }
  }
  closeSession(token) { for (const [id, run] of this.runs) if (run.session === token && !run.busy) this.runs.delete(id); }
}
