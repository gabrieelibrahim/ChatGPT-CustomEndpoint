<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/supergpt-logo-dark.svg" />
    <img src="public/supergpt-logo.png" alt="SuperGPT logo" width="140" height="140" />
  </picture>
  <h1>SuperGPT</h1>
  <p><strong>by Sakelar</strong></p>
  <p>Satu client AI. Pilih provider dan modelmu sendiri.</p>
  <p><strong>Bahasa Indonesia</strong> · <a href="README.en.md">English</a></p>
  <p><a href="#mulai-cepat">Mulai cepat</a> · <a href="#aplikasi-desktop">Desktop</a> · <a href="#dokumentasi">Dokumentasi</a></p>
</div>

---

**SuperGPT** adalah client AI independen dengan antarmuka React dan aplikasi desktop Tauri 2. Tampilan, model, dan provider dipilih secara terpisah: kamu dapat memakai endpoint yang kompatibel dengan OpenAI tanpa terkunci pada satu layanan.

**Sakelar AI** adalah provider rekomendasi, bukan persyaratan. SuperGPT bukan aplikasi resmi OpenAI dan tidak menyertakan akun, langganan, atau kredit API.

## Yang bisa kamu lakukan

| Fitur | Kemampuan |
| --- | --- |
| Percakapan | Respons streaming, hentikan generasi, coba ulang, dan riwayat lokal. |
| Provider & model | Banyak profil endpoint, penemuan model dari provider, serta pengisian model ID manual. |
| Ruang kerja | Mode Chat dan Work, project lokal, pencarian, pin, arsip, dan ekspor/impor chat. |
| Konten | Markdown, blok kode, tabel, rumus, serta lampiran teks dan gambar untuk model yang mendukungnya. |
| Pengaturan | Tema terang/gelap, ukuran teks, shortcut, instruksi pribadi, dan pengaturan penyimpanan. |
| Mini Chat | Percakapan ringkas melalui `?mini=1`. |
| Desktop | Jendela Tauri 2 dan koneksi HTTP native ke provider. |

> **Status Codex:** perpindahan ke mode Codex sedang dinonaktifkan sementara. Kode runtime lokal, terminal, edit file, approval, dan MCP tetap tersedia di project, tetapi bukan fitur aktif yang dapat dipilih pada rilis ini. Lihat [status fitur](FEATURE-STATUS.md) dan [runtime agent](AGENT-RUNTIME.md).

## Mulai cepat

Untuk pengembangan web, siapkan Node.js dan npm:

```bash
git clone https://github.com/gabrieelibrahim/SuperGPT.git
cd SuperGPT
npm ci
npm run dev
```

Buka alamat localhost yang ditampilkan Vite. Saat pertama dibuka, masukkan nama lokal, lalu konfigurasikan endpoint atau lewati langkah tersebut.

### Hubungkan provider

1. Buka **Profile → Custom Endpoint**.
2. Isi nama koneksi dan **Base URL**, termasuk `/v1` jika provider memerlukannya.
3. Isi API key bila diperlukan.
4. Klik **Tes & ambil model**, atau masukkan model ID secara manual.
5. Simpan endpoint, lalu kirim pesan melalui composer **Ask SuperGPT**.

Model, akses gambar, dan dukungan `reasoning_effort` mengikuti kemampuan provider. Tidak ada daftar model atau jawaban demo bawaan pada composer desktop.

### Jalur koneksi

| Lingkungan | Cara terhubung |
| --- | --- |
| Web development di localhost | Relay lokal pada proses Vite untuk mengatasi provider yang menolak preflight CORS. |
| Web statis / `npm run preview` | Langsung dari browser; provider harus mengizinkan CORS. |
| Aplikasi Tauri | HTTP native langsung ke provider. |

Validasi endpoint mengizinkan HTTPS, HTTP loopback, dan alamat IPv4 Tailscale `100.64.0.0/10`. Ini tetap memerlukan server, port, dan izin jaringan yang benar; bukan jaminan bahwa setiap alamat dapat dijangkau.

## Android & iOS

Layout mobile menggunakan engine percakapan dan endpoint yang sama. Target Android menghasilkan **APK ARM64 untuk testing**; build iOS memerlukan Mac dan Xcode. Lihat [MOBILE.md](MOBILE.md) untuk setup, perintah build, dan batas verifikasi.

```bash
npm run android:build
```

## Aplikasi desktop

Target desktop saat ini menggunakan **Tauri 2**. Untuk membangun di Windows, siapkan Rust MSVC, Visual Studio C++ Build Tools beserta Windows SDK, serta WebView2 Runtime.

```bash
# Jalankan mode pengembangan desktop
npm run desktop:dev

# Buat aplikasi dan installer Windows
npm run desktop:build
```

Build berikutnya menggunakan nama **SuperGPT**, executable `SuperGPT.exe`, serta logo baru tanpa latar. File EXE lama tidak berubah hanya dengan memperbarui source. Identitas aplikasi dan kunci penyimpanan lama dipertahankan agar data lokal tetap kompatibel.

Lihat [panduan Tauri](TAURI.md) untuk dependensi native dan detail packaging. Hosting web statis tidak dapat menjalankan terminal atau runtime agent lokal.

## Data & privasi

- **Nama, preferensi, dan riwayat:** disimpan secara lokal di perangkat.
- **API key:** disimpan di `sessionStorage`; tidak disertakan dalam ekspor profil atau backup chat.
- **File library:** disimpan di IndexedDB.
- **Temporary chat:** tidak disimpan ke riwayat lokal; penyimpanan di sisi provider mengikuti kebijakan provider tersebut.
- **Permintaan AI:** dikirim ke provider yang kamu pilih. Relay development berjalan di komputer lokal, bukan layanan proxy Sakelar.

Tidak ada sinkronisasi cloud, akun cloud, kuota, atau layanan billing bawaan. Jangan memasukkan credential atau konfigurasi pribadi ke commit.

## Pengembangan & pemeriksaan

```bash
npm test
npm run build
```

Build memeriksa TypeScript dan urutan CSS SDK. Tes mencakup transport provider, parser streaming, penyimpanan, rendering, serta adapter HTTP/agent. Tes runtime tambahan memakai gateway lokal dengan credential palsu; lihat [panduan runtime](AGENT-RUNTIME.md) sebelum menjalankannya.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Tauri 2 · OpenAI Apps SDK UI.

## Dokumentasi

| Panduan | Isi |
| --- | --- |
| [FEATURE-STATUS.md](FEATURE-STATUS.md) | Fitur yang tersedia, kebutuhan provider, dan batasan. |
| [TAURI.md](TAURI.md) | Build desktop, runtime, dan packaging Windows. |
| [DESKTOP.md](DESKTOP.md) | Shell desktop, navigasi, dan interaksi lokal. |
| [SETTINGS.md](SETTINGS.md) | Pengaturan, preferensi, dan penyimpanan. |
| [AGENT-RUNTIME.md](AGENT-RUNTIME.md) | Protokol agent, sandbox, approval, dan MCP. |
| [RICH-TEXT.md](RICH-TEXT.md) | Markdown, kode, rumus, dan rendering. |
| [SDK-STYLE.md](SDK-STYLE.md) | Integrasi komponen dan fondasi CSS SDK. |

## Logo & atribusi

Logo SuperGPT berasal dari aset yang disediakan pemilik project. Master transparan tersedia di [`public/supergpt-logo.png`](public/supergpt-logo.png); ikon aplikasi, installer, dan favicon menggunakan desain yang sama. Versi terang untuk tampilan gelap mempertahankan bentuk serta transparansinya.

Sebagian ikon antarmuka dan komponen menggunakan [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui). Atribusi dan lisensi sumber ikon tersedia di [`src/components/openai-icons/`](src/components/openai-icons/). Logo provider dan ikon antarmuka bukan logo aplikasi SuperGPT.

## ChatKit & Agents SDK

Buka **Pengaturan → ChatKit & Agents** untuk ruang chat resmi ChatKit dengan
Agents SDK dan custom endpoint pilihanmu. Streaming, riwayat server, tool, agen
spesialis, persetujuan, dan unggahan sudah terhubung. Fitur Responses/audio
mengikuti dukungan provider. [Panduan integrasi dan status pengujian](docs/sdk-integration.md).
Checkpoint rollback: `before-chatkit-integration` (`85d9526`).
