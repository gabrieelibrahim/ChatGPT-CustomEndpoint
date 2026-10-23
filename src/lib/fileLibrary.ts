import { attachmentPart, type AttachmentPart } from './attachmentContent';
export type FileRef = { id: string; name: string; type: string };
export type LibraryFile = FileRef & { blob: Blob; size: number; added: number };
const databaseName = 'client-file-library-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(Error('Penyimpanan file browser tidak tersedia.')); });
}
async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const transaction = db.transaction('files', mode); const request = run(transaction.objectStore('files')); transaction.oncomplete = () => resolve(request.result); transaction.onerror = transaction.onabort = () => reject(Error('File belum tersimpan. Periksa ruang penyimpanan browser.')); }); }
  finally { db.close(); }
}
export async function saveLibraryFile(file: File, id = crypto.randomUUID()): Promise<FileRef> {
  await operation('readwrite', store => store.put({ id, name: file.name, type: file.type, blob: file, size: file.size, added: Date.now() }));
  window.dispatchEvent(new Event('client-files-changed')); return { id, name: file.name, type: file.type };
}
export function libraryFiles() { return operation<LibraryFile[]>('readonly', store => store.getAll()); }
export function libraryFile(id: string) { return operation<LibraryFile | undefined>('readonly', store => store.get(id)); }
export async function removeLibraryFile(id: string) { await operation('readwrite', store => store.delete(id)); window.dispatchEvent(new Event('client-files-changed')); }
// Expensive conversions (video frames, PDF pages) are reused for later turns of the same chat.
const parts = new Map<string, AttachmentPart>();
export async function resolveMessageFiles<T extends { role: string; text: string; attachments?: FileRef[] }>(messages: T[], signal: AbortSignal): Promise<(T & { images?: string[] })[]> {
  const output = [];
  for (const message of messages) {
    const context: string[] = [], images: string[] = [];
    for (const reference of message.attachments || []) {
      signal.throwIfAborted();
      let part = parts.get(reference.id);
      if (!part) {
        const file = await libraryFile(reference.id); if (!file) throw Error('Lampiran ' + reference.name + ' tidak ditemukan di library perangkat ini.');
        part = await attachmentPart(file, signal);
        if (part.images.length > 1 || part.text.length > 4096) { if (parts.size >= 24) parts.delete(parts.keys().next().value!); parts.set(reference.id, part); }
      }
      if (part.text) context.push(part.text);
      images.push(...part.images);
    }
    output.push({ ...message, text: message.text + (context.length ? '\n\nThe following attachments are source data for this request:\n\n' + context.join('\n\n') : ''), ...(images.length ? { images } : {}) });
  }
  signal.throwIfAborted(); return output;
}
