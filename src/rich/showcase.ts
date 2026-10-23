// Local demo answer for Settings → Contoh format jawaban. Mock data only; nothing is sent to a model.
const ui = (value: unknown) => '```ui\n' + JSON.stringify(value, null, 1) + '\n```';
const chart = (value: unknown) => '```chart\n' + JSON.stringify(value, null, 1) + '\n```';

export const richShowcase = `Ini contoh **semua format jawaban** yang bisa ditampilkan SuperGPT. Semua data di bawah adalah **contoh ilustrasi**.

## 1. Format teks dasar

| Nama format | Contoh tampilan |
|---|---|
| Plain Text | Halo, ini teks biasa. |
| Bold | **Teks tebal** |
| Italic | *Teks miring* |
| Strikethrough | ~~Teks dicoret~~ |
| Inline Code | \`const api = "Sakelar"\` |
| Link | [OpenAI](https://openai.com) |

## 2. Heading / Judul

# Heading 1
## Heading 2
### Heading 3
#### Heading 4

## 3. List / Daftar

**Bullet List**

- GPT-6
- Claude
- Gemini

**Numbered List**

1. Login
2. Pilih model
3. Mulai chat

**Checklist**

- [x] Setup API
- [x] Buat UI
- [ ] Deploy aplikasi

**Blockquote**

> Ini contoh kutipan atau informasi yang ditampilkan menjorok dari teks biasa.

## 4. Code Block

\`\`\`javascript
const sakelar = {
  name: "Sakelar AI",
  model: "GPT-6",
  status: "active"
};

console.log(sakelar);
\`\`\`

## 5. Tabel

| Model | Harga input | Status |
|---|---:|---|
| GPT-6 | $2.00 | Aktif |
| Claude | $3.00 | Aktif |
| Gemini | $0.50 | Aktif |

Angka hanya contoh demonstrasi, bukan harga API resmi.

## 6. Badge / Label

${ui({ type: 'badges', items: [{ label: 'Default' }, { label: 'Active', tone: 'success' }, { label: 'Error', tone: 'danger' }, { label: 'Warning', tone: 'warning' }, { label: 'Beta', tone: 'info' }, { label: 'Outline', tone: 'outline' }] })}

## 7. Card / Kartu

${ui({ type: 'grid', columns: 2, children: [{ type: 'card', icon: 'cpu', title: 'GPT-6', subtitle: 'AI Model', badge: { label: 'Online', tone: 'success' } }, { type: 'card', icon: 'bolt', title: 'Sakelar API', subtitle: 'API Gateway', badge: { label: 'Demo', tone: 'info' } }] })}

## 8. Tombol interaktif

${ui({ type: 'counter', label: 'Counter', value: 0, step: 1 })}

## 9. Input / Form

${ui({ type: 'form', fields: [{ type: 'text', name: 'nama', label: 'Nama pengguna', placeholder: 'Masukkan nama...' }, { type: 'radio', name: 'model', label: 'Pilih model AI', options: [{ label: 'GPT-6', value: 'gpt' }, { label: 'Claude', value: 'claude' }, { label: 'Gemini', value: 'gemini' }] }, { type: 'checkbox', name: 'fitur', label: 'Aktifkan fitur tambahan', value: true }], submit: { label: 'Submit', message: 'Halo {nama}! Model {model} berhasil dipilih.' } })}

## 10. Dropdown, Slider, dan Date Picker

${ui({ type: 'form', fields: [{ type: 'select', name: 'paket', label: 'Dropdown', options: ['Standard', 'Premium', 'Enterprise'] }, { type: 'slider', name: 'nilai', label: 'Slider', min: 0, max: 100, value: 50, unit: '%' }, { type: 'date', name: 'tanggal', label: 'Date Picker' }] })}

## 11. Segmented Control

${ui({ type: 'segmented', options: [{ label: 'Chat', content: 'Halaman percakapan AI.' }, { label: 'API', content: 'Halaman pengaturan endpoint API.' }, { label: 'Settings', content: 'Halaman preferensi aplikasi.' }] })}

## 12. Grafik / Chart

${chart({ type: 'line', title: 'Contoh penggunaan token', subtitle: 'Data ilustrasi, bukan penggunaan nyata.', labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'], series: [{ name: 'Token', data: [1200000, 1900000, 1700000, 2600000, 2400000, 3600000, 4700000] }] })}

${chart({ type: 'bar', title: 'Permintaan per model', subtitle: 'Data ilustrasi.', labels: ['GPT-6', 'Claude', 'Gemini', 'Llama'], series: [{ name: 'Pekan lalu', data: [420, 310, 180, 90] }, { name: 'Pekan ini', data: [510, 290, 240, 120] }] })}

${chart({ type: 'donut', title: 'Pangsa biaya', labels: ['GPT-6', 'Claude', 'Gemini'], series: [{ name: 'Biaya', data: [55, 30, 15] }], unit: '%' })}

## 13. Matematika / LaTeX

Persamaan sederhana: $E = mc^2$

Persamaan kompleks:

$$
f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}
$$

## 14. Diagram Mermaid

\`\`\`mermaid
flowchart TD
  A[User mengirim pesan] --> B[Sakelar API]
  B --> C{Pilih provider}
  C --> D[OpenAI]
  C --> E[Anthropic]
  C --> F[Google]
  D --> G[Respons AI]
  E --> G
  F --> G
\`\`\`

## 15. Gambar / Image

${ui({ type: 'images', items: [{ src: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=640', alt: 'Gambar ilustrasi AI' }, { src: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=640', alt: 'Gambar ilustrasi server' }] })}

## 16. Carousel / Slider Card

${ui({ type: 'carousel', items: [{ icon: 'sparkles', title: 'AI Chat', text: 'Percakapan dengan berbagai model AI.' }, { icon: 'code', title: 'Code Assistant', text: 'Bantuan pemrograman dan debugging.' }, { icon: 'chart', title: 'Analytics', text: 'Visualisasi data dan penggunaan API.' }] })}

## 17. Popover / Tooltip

${ui({ type: 'popover', label: 'Lihat informasi', title: 'Popover', content: 'Informasi tambahan yang muncul ketika kontrol dibuka.' })}

## 18. Icon

${ui({ type: 'icons', items: ['house', 'settings', 'search', 'bell', 'user', 'shield-check', 'cpu', 'database', 'globe', 'terminal', 'key-round', 'sparkles', 'check-circle', 'alert-triangle', 'heart', 'download'] })}

## 19. Writing Block

Format khusus untuk teks yang ingin diedit atau disalin.

${ui({ type: 'writing', label: 'Pesan', title: 'Pengumuman Sakelar AI', text: 'Jika total pembelian minggu ini mencapai 3 miliar token, kami akan mengadakan penurunan multiplier untuk seluruh pengguna.\n\nTerima kasih atas dukungannya! 🚀' })}

## 20. Format lain

${ui({ type: 'accordion', items: [{ title: 'Accordion', content: 'Konten yang dapat dibuka-tutup dengan kontrol.' }, { title: 'Callout', content: 'Kotak informasi dengan warna status.' }] })}

${ui({ type: 'callout', tone: 'info', title: 'Info', text: 'Komponen hanya bisa menyalin, membagikan, menyimpan file, atau mengisi kolom pesan setelah kamu mengetuknya.' })}

${ui({ type: 'sources', items: [{ title: 'Dokumentasi Mermaid', url: 'https://mermaid.js.org/', description: 'Sintaks diagram' }, { title: 'KaTeX', url: 'https://katex.org/', description: 'Rumus matematika' }] })}

**File unduhan**

\`\`\`\`file name="SUPERGPT_CONTOH.md" description="Contoh file Markdown"
# Contoh file

File ini dibuat dari jawaban dan bisa disimpan ke perangkat.

\`\`\`js
console.log("halo");
\`\`\`
\`\`\`\`
`;
