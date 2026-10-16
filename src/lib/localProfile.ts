export type LocalProfile = { version: 1; name: string };
export const localProfileKey = 'client-local-profile-v1';
export function clearLocalProfile(): void {
  localStorage.removeItem(localProfileKey);
}
export function loadLocalProfile(): LocalProfile | null {
  try {
    const value = JSON.parse(localStorage.getItem(localProfileKey) || 'null');
    return value?.version === 1 && typeof value.name === 'string' && value.name.trim() && value.name.length <= 80 ? { version: 1, name: value.name.trim() } : null;
  } catch { return null; }
}
export function saveLocalProfile(name: string): LocalProfile {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw Error('Isi nama dengan panjang 1–80 karakter.');
  const profile: LocalProfile = { version: 1, name: clean };
  try { localStorage.setItem(localProfileKey, JSON.stringify(profile)); }
  catch { throw Error('Nama belum tersimpan. Izinkan penyimpanan browser, lalu coba lagi.'); }
  return profile;
}
export function profileInitials(name: string): string {
  return name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toLocaleUpperCase() || '?';
}
