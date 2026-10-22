import workflow from '../../shared/workflows.json';

// The three suggestions on an empty chat. Starters for plugins the person has connected come first, so an
// "Email → …" suggestion only appears once Gmail is connected; general starters fill the rest. The seed changes
// with every new chat, so the set rotates instead of always showing the same three.
export type HomeStarter = { label: string; prompt: string; plugin?: string; icon?: string };
type Connected = { name: string; catalogId?: string; enabled: boolean };

const pluginStarters: Record<string, { label: string; prompt: string }[]> = {
  gmail: workflow.starters,
  'google-drive': [{ label: 'Drive → cari & ringkas file', prompt: 'Cari file di Google Drive tentang topik yang akan kusebut, lalu ringkas isinya beserta tautannya. Tanyakan topiknya dulu.' }],
  'google-calendar': [{ label: 'Kalender → agenda minggu ini', prompt: 'Lihat Google Calendar-ku untuk minggu ini dan ringkas agenda, bentrok jadwal, dan waktu luang.' }],
  'google-docs': [{ label: 'Docs → susun dokumen baru', prompt: 'Bantu susun dokumen baru di Google Docs. Tanyakan judul dan isi pokoknya dulu, lalu buat draf.' }],
  'google-sheets': [{ label: 'Sheets → analisis data tabel', prompt: 'Baca spreadsheet Google Sheets yang akan kusebut dan ringkas temuan utamanya. Tanyakan file-nya dulu.' }],
  github: [{ label: 'GitHub → ringkas PR & issue', prompt: 'Ringkas pull request dan issue terbuka di repositori GitHub yang akan kusebut. Tanyakan repositorinya dulu.' }],
  notion: [{ label: 'Notion → cari catatan', prompt: 'Cari catatan di Notion tentang topik yang akan kusebut dan ringkas isinya. Tanyakan topiknya dulu.' }],
};

export const generalStarters: HomeStarter[] = [
  { label: 'Ringkas teks panjang', prompt: 'Ringkas teks berikut menjadi poin penting, keputusan, dan langkah berikutnya:\n\n', icon: 'page' },
  { label: 'Tulis email yang rapi', prompt: 'Bantu tulis email yang sopan dan jelas. Tanyakan penerima, tujuan, dan poin pentingnya dulu.', icon: 'edit' },
  { label: 'Susun rencana minggu ini', prompt: 'Bantu susun rencana kerja minggu ini dengan prioritas yang jelas. Tanyakan daftar tugasku dulu.', icon: 'clock' },
  { label: 'Jelaskan topik dengan sederhana', prompt: 'Jelaskan topik berikut dengan bahasa sederhana dan contoh sehari-hari: ', icon: 'bulb' },
  { label: 'Tinjau dan perbaiki kode', prompt: 'Tinjau kode berikut, jelaskan kemungkinan bug, dan usulkan perbaikannya:\n\n', icon: 'terminal' },
  { label: 'Ide konten media sosial', prompt: 'Beri 5 ide konten media sosial untuk topik berikut, lengkap dengan caption singkat: ', icon: 'comment' },
];

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function pickStarters(connected: Connected[], seed: number, count = 3): HomeStarter[] {
  const fromPlugins = connected.filter(p => p.enabled && p.catalogId && pluginStarters[p.catalogId])
    .flatMap(p => pluginStarters[p.catalogId!].map(s => ({ label: s.label, prompt: '@' + p.name + ' ' + s.prompt, plugin: p.catalogId })));
  const plugins = shuffled(fromPlugins, seed).slice(0, Math.min(2, count));
  return [...plugins, ...shuffled(generalStarters, seed + 1).slice(0, count - plugins.length)];
}
