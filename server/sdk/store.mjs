import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { inputError } from './config.mjs';

export const id = prefix => prefix + '_' + randomUUID().replaceAll('-', '');
export const now = () => new Date().toISOString();
export const page = (data, params = {}) => {
  const list = params.order === 'asc' ? [...data] : [...data].reverse();
  const offset = params.after ? list.findIndex(item => item.id === params.after) + 1 : 0;
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 30));
  const result = list.slice(offset, offset + limit);
  return { data: result, has_more: offset + result.length < list.length, after: result.at(-1)?.id || null };
};
export function publicThread(thread, withItems = true) {
  const result = { id: thread.id, title: thread.title, created_at: thread.created_at, status: { type: 'active' }, metadata: {} };
  return withItems ? { ...result, items: page(thread.items, { order: 'asc', limit: 100 }) } : result;
}

// Single-process store. Atomic renames prevent torn JSON; per-thread execution
// locks in the service prevent concurrent model turns from overwriting history.
export class SdkStore {
  constructor(root) { this.root = root; mkdirSync(root, { recursive: true, mode: 0o700 }); }
  directory(owner) {
    if (!/^[a-zA-Z0-9_-]{24,100}$/.test(owner)) throw inputError('Identitas penyimpanan tidak valid.');
    const directory = join(this.root, createHash('sha256').update(owner).digest('hex'));
    mkdirSync(directory, { recursive: true, mode: 0o700 }); return directory;
  }
  load(owner) {
    const path = join(this.directory(owner), 'store.json');
    if (!existsSync(path)) return { version: 1, threads: [], files: [], notes: [], feedback: [] };
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.threads) || !Array.isArray(data.files)) throw inputError('Penyimpanan SDK tidak dapat dibaca.');
    return data;
  }
  save(owner, data) {
    const path = join(this.directory(owner), 'store.json');
    const json = JSON.stringify(data);
    writeFileSync(path + '.tmp', json, { mode: 0o600 }); renameSync(path + '.tmp', path);
  }
  thread(owner, threadId) {
    const thread = this.load(owner).threads.find(item => item.id === threadId);
    if (!thread) throw inputError('Obrolan tidak ditemukan.'); return thread;
  }
  putThread(owner, thread) {
    const data = this.load(owner), index = data.threads.findIndex(item => item.id === thread.id);
    if (thread.items.length > 1000) throw inputError('Batas 1.000 item tercapai. Mulai obrolan baru.');
    if (index < 0) { if (data.threads.length >= 1000) throw inputError('Batas penyimpanan obrolan tercapai.'); data.threads.push(thread); }
    else data.threads[index] = thread;
    this.save(owner, data);
  }
  deleteThread(owner, threadId) {
    const data = this.load(owner); data.threads = data.threads.filter(thread => thread.id !== threadId);
    for (const file of data.files.filter(file => file.thread_id === threadId)) rmSync(join(this.directory(owner), file.id), { force: true });
    data.files = data.files.filter(file => file.thread_id !== threadId); this.save(owner, data);
  }
  file(owner, fileId) { return this.load(owner).files.find(file => file.id === fileId); }
  bytes(owner, fileId) {
    if (!this.file(owner, fileId)?.uploaded) throw inputError('File belum selesai diunggah.');
    return readFileSync(join(this.directory(owner), fileId));
  }
  upload(owner, fileId, bytes) {
    const data = this.load(owner), file = data.files.find(file => file.id === fileId);
    if (!file || bytes.length !== file.size) throw inputError('Ukuran unggahan tidak sesuai.');
    writeFileSync(join(this.directory(owner), file.id), bytes, { mode: 0o600 }); file.uploaded = true; this.save(owner, data);
  }
  generatedImage(owner, threadId, base64, baseUrl) {
    if (typeof base64 !== 'string' || !/^[a-zA-Z0-9+/=]+$/.test(base64) || base64.length > 14 * 1024 * 1024) throw inputError('Gambar hasil model terlalu besar atau tidak valid.');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw inputError('Format hasil gambar belum didukung. Gunakan keluaran PNG.');
    const data = this.load(owner);
    const file = { type: 'image', id: id('atc'), name: 'SuperGPT.png', mime_type: 'image/png', size: bytes.length, uploaded: false, thread_id: threadId, previewToken: id('img') };
    file.preview_url = baseUrl + '/files/' + file.id + '/' + file.previewToken + '/' + owner;
    data.files.push(file); this.save(owner, data); this.upload(owner, file.id, bytes); return file;
  }
  removeFile(owner, fileId) {
    const data = this.load(owner), file = data.files.find(file => file.id === fileId);
    if (file?.thread_id) throw inputError('Lampiran sudah digunakan dalam obrolan. Hapus obrolannya untuk menghapus file.');
    data.files = data.files.filter(file => file.id !== fileId); this.save(owner, data);
    if (file) rmSync(join(this.directory(owner), file.id), { force: true });
  }
}
