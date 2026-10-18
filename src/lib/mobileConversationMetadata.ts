type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function read<T>(storage: Store, key: string, fallback: T): T { try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
// A title is the desktop history's identifier. Update every reference together,
// preserving unknown project fields and unrelated conversations.
export function changeConversationName(storage: Store, oldName: string, newName: string | null) {
  const titles = read<string[]>(storage, 'desktop-titles', []);
  const content = read<Record<string, unknown>>(storage, 'desktop-chat-content', {});
  if (!titles.includes(oldName)) throw Error('Percakapan tidak ditemukan.');
  const name = newName?.trim();
  if (newName !== null && (!name || name.length > 120)) throw Error('Isi nama sepanjang 1–120 karakter.');
  if (name === oldName) return;
  if (name && (titles.includes(name) || Object.hasOwn(content, name))) throw Error('Nama tersebut sudah dipakai percakapan lain.');
  const replace = (items: string[]) => items.flatMap(value => value === oldName ? name ? [name] : [] : [value]);
  const nextContent = { ...content };
  if (name) Object.defineProperty(nextContent, name, { value: content[oldName] || [], enumerable: true, configurable: true, writable: true });
  delete nextContent[oldName];
  const values: Record<string, unknown> = {
    'desktop-titles': replace(titles), 'desktop-chat-content': nextContent,
    'desktop-pinned': replace(read<string[]>(storage, 'desktop-pinned', [])),
    'desktop-archived': replace(read<string[]>(storage, 'desktop-archived', [])),
    'client-mobile-projects-v1': read<{ chats?: string[] }[]>(storage, 'client-mobile-projects-v1', []).map(project => ({ ...project, chats: Array.isArray(project.chats) ? replace(project.chats) : [] })),
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, storage.getItem(key)]));
  try { for (const [key, value] of Object.entries(values)) storage.setItem(key, JSON.stringify(value)); }
  catch (failure) { for (const [key, value] of Object.entries(previous)) { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Keep the original storage failure. */ } } throw failure; }
}
