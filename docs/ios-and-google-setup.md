# SuperGPT: Google OAuth dan iPhone/iPad

22 Oktober 2026. Proyek Google Cloud dan client Android sudah dikonfigurasi pada sesi pemilik. Belum ada server OAuth HTTPS yang dideploy, build iOS, atau pengujian iPhone nyata dari pekerjaan ini. Akses MCP resmi masih menunggu akun Google Workspace dan persetujuan Developer Preview; akun Gmail pribadi tidak diterima oleh formulir program. Rincian terkini: [pendaftaran Google Workspace](google-workspace-registration.md).

## Mulai sekarang: daftar proyek Google

1. Buka [Buat proyek Google Cloud](https://console.cloud.google.com/projectcreate) memakai akun Google milikmu.
2. Nama proyek: **SuperGPT**. Organization/Location: pilih **No organization** bila akun pribadi menyediakan pilihan itu. Klik **Create**. Simpan **Project ID**, yang bisa berbeda dari nama tampilan.
3. Pastikan proyek SuperGPT terpilih pada pemilih proyek di bagian atas. Buka **Google Auth Platform**, lalu **Get started** bila ditampilkan.
4. Isi **App name: SuperGPT**, email dukungan milikmu, dan email kontak pengembang. Pilih Audience **External** untuk akun pribadi. Selesaikan form dan persyaratan Google.
5. Pada **Audience**, gunakan status **Testing** untuk tahap pengembangan. Tambahkan alamat Google milikmu pada **Test users**. Belum perlu menerbitkan aplikasi untuk umum. Ikuti persyaratan yang muncul pada akun/proyekmu; nama menu dapat berubah.
6. Google Workspace MCP memerlukan akses [Developer Preview](https://developers.google.com/workspace/preview). Ikuti pendaftaran dan persetujuan yang diminta. Membuat OAuth client saja belum memberikan akses MCP.
7. Pada **APIs & Services → Library**, aktifkan layanan produk dan MCP yang akan dipakai sesuai [panduan Google](https://developers.google.com/workspace/guides/configure-mcp-servers). Mulai dari satu layanan untuk mengurangi setup awal, misalnya Calendar; aktifkan layanan lain ketika dibutuhkan.
8. Pada **Google Auth Platform → Data Access**, tambahkan scope layanan pilihanmu dari `shared/googleWorkspace.json`, beserta `https://www.googleapis.com/auth/userinfo.email`. Mulai dengan scope baca. Izin tambahan diminta ketika kamu memilih akses tulis.

Project ID boleh dibagikan ke chat. Jangan mengirim client secret, API key model, token server, refresh token, atau private signing key.

## OAuth untuk Android dan iOS

### Android langsung

Pada **Clients → Create client → Android**, daftarkan package `id.sakelar.client` dan SHA-1 release:

```text
69:AA:92:74:18:6D:DF:41:39:25:70:9D:F6:BF:21:04:BF:56:B6:F8
```

Ikuti persyaratan **Use this client for an AI-powered agent**. Jika opsi yang diperlukan tidak tersedia untuk client Android, gunakan server OAuth. Fingerprint ini milik APK release yang sudah ada, bukan sertifikat debug.

### Server OAuth untuk iOS, web, dan alternatif Android

Jalur iOS yang disiapkan memakai **Web application client pada server**, bukan client Google tipe iOS. Aplikasi membuka login di browser sistem; kode ditukar oleh server. Secret dan refresh token Google tetap pada server.

1. Tentukan domain server HTTPS milikmu dahulu. Jangan mendaftarkan domain contoh sebagai alamat aplikasi nyata.
2. Buat client **Web application** pada proyek yang sama. Tandai **Use this client for an AI-powered agent** sesuai ketentuan Google.
3. Tambahkan **Authorized redirect URI** tepat `https://DOMAIN-KAMU/__google/callback`.
4. Simpan Client ID dan Client secret secara privat pada server. Ikuti seluruh variabel dan pengaturan HTTPS di [panduan pendaftaran](google-workspace-registration.md#2b-server-oauth-untuk-web-ios-atau-alternatif-android).
5. Setelah server siap, `/__google/config` harus memberi `ready: true`. Di SuperGPT pilih Plugin → layanan Google → Koneksi Google → **Server OAuth SuperGPT**, lalu isi alamat server dan token akses server.
6. Selesaikan login di browser dan kembali ke SuperGPT. Tunggu initialize dan tools/list sebelum dianggap terhubung. Ulangi login jika sesi aplikasi hilang.

Source iOS/web menyimpan koneksi Google selama sesi; belum memiliki integrasi Keychain. Jangan menganggap opsi Android Google Identity atau vault Android tersedia di iPhone. Generic MCP OAuth di iOS native juga belum memiliki callback bridge; jalur Google menggunakan broker yang terpisah.

## Karena belum punya Mac: jalur Safari

Source sekarang mengenali iPhone dan iPad, termasuk iPad dengan user agent Macintosh, serta menyediakan manifest dan metadata layar utama. Ini web app online, tanpa service worker/offline cache.

Setelah versi web tersedia di **HTTPS**:

1. Buka alamat SuperGPT dari Safari pada iPhone/iPad. Baseline source menggunakan iOS/iPadOS **17.4 atau lebih baru** karena fungsi WebKit modern yang dipakai transport.
2. Pilih Share → **Add to Home Screen / Tambahkan ke Layar Utama**. Aktifkan **Open as Web App** jika pilihan itu tersedia. Lihat [panduan Apple](https://support.apple.com/guide/iphone/iphea86e5236/ios).
3. Buka ikon SuperGPT. Masukkan endpoint model dan API key sendiri; API key hanya disimpan selama sesi. Untuk mengisi ulang setelah sesi hilang, buka pengaturan endpoint.
4. Endpoint model, broker, dan MCP harus dapat diakses dari iPhone. `localhost` pada iPhone menunjuk iPhone, bukan komputer Windows. Untuk web, penyedia juga harus mengizinkan CORS; bila tidak, perlu server/proxy yang sesuai. Menambahkan ikon tidak menghilangkan batas CORS.
5. Koneksi Google tetap memerlukan pendaftaran, server OAuth, dan akses Developer Preview di atas. Belum ada URL publik yang dideploy pada tugas ini.

Panggilan model atau Google tidak dijamin terus berjalan saat aplikasi dibawa ke background atau iOS menutup proses. Tidak ada klaim bahwa semua fitur native Android sudah tersedia di Safari.

## iOS native ketika tersedia Mac

Sumber memakai UI mobile dan transport HTTP native Tauri. Konfigurasi iOS menetapkan minimum 17.4, izin kamera/mikrofon/foto, frontend mode mobile, serta mengecualikan resource runtime desktop.

Persyaratan resmi: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) dan [iOS signing](https://v2.tauri.app/distribute/sign/ios/). Perlu macOS, Xcode, Node yang mendukung `process.loadEnvFile`, Rust, CocoaPods, target `aarch64-apple-ios`, dan target simulator sesuai Mac. Apple Developer Program untuk distribusi App Store/TestFlight berharga [USD 99 per tahun atau harga lokal](https://developer.apple.com/programs/whats-included/). Pengujian pribadi lewat Xcode dapat memakai akun Apple gratis dengan batas provisioning Apple.

Salin source tanpa file `.env*`, keystore Android, data `.supergpt-sdk`, atau API key pribadi. Gunakan environment Mac sendiri. Setelah dependencies tersedia, pemeriksaan tanpa compile:

```sh
npm run ios:doctor
```

Set `APPLE_DEVELOPMENT_TEAM` pada environment Mac atau `.env.ios.local` yang diabaikan Git. **Perintah berikut menjalankan pembuatan project/dev/build dan hanya boleh dijalankan setelah pengguna mengizinkan tahap itu**:

```sh
npm run ios:init
npm run ios:dev
npm run ios:build
```

Pilih signing team/device pada Xcode dan siapkan ikon hasil generasi di project Apple sebelum distribusi. Tidak ada Apple project/signing certificate/IPA yang dibuat dari Windows. iOS:doctor juga tidak dijalankan di Mac pada tugas ini.

## Status pemeriksaan source

Pemeriksaan tipe tanpa emit, sintaks JavaScript, parsing plist/manifest/config, dan diff dilakukan. Tidak menambah/menjalankan tes, compile frontend/APK/iOS, push, deploy, atau rilis. UI Safari, share sheet, izin perangkat, background/resume, login Google, CORS, dan signing masih memerlukan pengujian di lingkungan sebenarnya.
