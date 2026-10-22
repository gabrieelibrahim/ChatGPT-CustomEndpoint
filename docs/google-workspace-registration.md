# Pendaftaran Google Workspace MCP untuk SuperGPT

Tanggal: 22 Oktober 2026, Asia/Jakarta. Source disiapkan. Pada sesi konfigurasi pemilik, proyek dan client Android sudah dibuat, API produk dan MCP diaktifkan, scope disimpan, serta Chat MCP dikonfigurasi. Identitas proyek pribadi disimpan di catatan lokal, bukan source. Belum compile atau rilis.

**Penghalang akses MCP:** [formulir Developer Preview resmi](https://developers.google.com/workspace/preview) mensyaratkan email dalam domain Google Workspace dan tidak menerima Gmail, service account, atau Google Group. Pemilik saat ini belum memiliki akun Workspace. API berstatus Enabled dan OAuth client terdaftar belum membuktikan akses MCP. Pendaftaran serta persetujuan Google masih diperlukan sebelum uji koneksi nyata; source tetap dapat disiapkan untuk compile. Jangan membeli Workspace hanya dengan asumsi bahwa akses preview pasti disetujui.

## Layanan yang disiapkan

| Layanan | Endpoint MCP resmi |
| --- | --- |
| Gmail | `https://gmailmcp.googleapis.com/mcp/v1` |
| Google Drive | `https://drivemcp.googleapis.com/mcp/v1` |
| Google Docs | `https://docsmcp.googleapis.com/mcp/v1` |
| Google Sheets | `https://sheetsmcp.googleapis.com/mcp/v1` |
| Google Slides | `https://slidesmcp.googleapis.com/mcp/v1` |
| Google Calendar | `https://calendarmcp.googleapis.com/mcp/v1` |
| Google Chat | `https://chatmcp.googleapis.com/mcp/v1` |
| Google Contacts / People | `https://people.googleapis.com/mcp/v1` |
| Google Classroom | `https://classroommcp.googleapis.com/mcp/v1` |

Google saat ini menempatkan layanan tersebut dalam Developer Preview. Pastikan akun/proyek mendapat akses [Google Workspace Developer Preview](https://developers.google.com/workspace/preview), lalu ikuti [konfigurasi MCP resmi](https://developers.google.com/workspace/guides/configure-mcp-servers). Google Tasks, Photos, YouTube, Maps, dan layanan Google lain di luar tabel tidak otomatis didukung oleh implementasi ini.

Kemampuan aktual mengikuti `tools/list` setelah login. Gmail MCP mendukung pencarian/baca, draf, dan label; jangan menganggap adanya izin email berarti tool mengirim email tersedia. Contacts/People yang disiapkan berorientasi baca/pencarian. Pilihan baca/tulis meminta scope terkait, dan setiap panggilan tool tetap memerlukan persetujuan di chat. Scope lama yang sudah diberikan Google dapat tetap berlaku; memilih baca tidak mencabut seluruh izin Google yang pernah diberikan.

## 1. Buat proyek dan aktifkan layanan

1. Buka [Google Cloud Console](https://console.cloud.google.com/projectcreate), buat proyek khusus SuperGPT, dan simpan Project ID.
2. Ikuti petunjuk akses Developer Preview. Buat OAuth consent screen melalui Google Auth Platform → Branding/Audience. Isi nama SuperGPT, email dukungan dan kontak; gunakan Internal hanya jika sesuai organisasi Workspace, atau External dengan akun penguji saat masih testing.
3. Aktifkan API produk: Gmail, Drive, Docs, Sheets, Slides, Google Calendar, Google Chat, People dan Classroom. Aktifkan juga MCP services yang dicantumkan di panduan Google, yaitu `gmailmcp.googleapis.com`, `drivemcp.googleapis.com`, `docsmcp.googleapis.com`, `sheetsmcp.googleapis.com`, `slidesmcp.googleapis.com`, `calendarmcp.googleapis.com`, `chatmcp.googleapis.com`, `people.googleapis.com`, `classroommcp.googleapis.com`.
4. Untuk Google Chat, konfigurasi Chat app sesuai panduan Google. Workspace admin dapat membatasi aplikasi, scope dan layanan; akun tetap membutuhkan akses ke data yang dipilih.
5. Tambahkan scope layanan yang akan diuji pada Data Access. Daftar tepat source ada di `shared/googleWorkspace.json`; semua login menambahkan `userinfo.email` untuk mengikat koneksi ke akun yang sama. Mulai dengan baca, lalu pilih baca/tulis bila diperlukan. Jangan meminta seluruh scope metadata secara otomatis.
6. Sebelum penggunaan publik, selesaikan verifikasi Google yang sesuai. Scope sensitif/restricted seperti akses Gmail dan Drive dapat memerlukan verifikasi dan, pada kondisi tertentu, security assessment. Mode Testing membatasi akun dan umur refresh token. Lihat [verifikasi OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) dan [kebijakan user data](https://developers.google.com/terms/api-services-user-data-policy).

## 2A. Otorisasi langsung di Android

Source memakai Google Identity `AuthorizationClient` dan Google-owned consent UI, tanpa client secret pada APK. Setelah izin diberikan, akses diperoleh kembali secara silent untuk akun tersimpan; bila Google memerlukan consent lagi, pengguna diminta menghubungkan ulang plugin.

1. Google Auth Platform → Clients → Create client → Android.
2. Isi package produksi **`id.sakelar.client`** dan SHA-1 sertifikat release permanen:

   ```text
   69:AA:92:74:18:6D:DF:41:39:25:70:9D:F6:BF:21:04:BF:56:B6:F8
   ```

   Fingerprint dibaca dari APK v0.1.11 yang sudah ada, tanpa membangun APK baru. SHA-256 sertifikat cocok dengan pin repo: `7544dc65194da6bb8b0bb8c86005759e91707f7dc0a6f8ddb53eb907bf7a7737`. Tidak ada private key/password yang dibaca atau diganti.
3. Daftarkan consent/scopes pada proyek yang sama. Centang **Use this client for an AI-powered agent** untuk akses MCP resmi. Opsi ini tersedia pada client Android dan sudah dipilih pada sesi konfigurasi pemilik. Otorisasi akun Google saja belum membuktikan MCP akan menerima client tersebut.
4. Versi debug memakai package terpisah dan sertifikat berbeda; jangan mengganti signing key produksi untuk menyelesaikan pendaftaran debug.
5. Pengujian perangkat membutuhkan Google Play services, akun yang diizinkan, dan future build yang mendapat izin pengguna. Google memblokir loopback OAuth untuk client tipe Android; source Android Google ini menggunakan Google Identity, bukan callback loopback generik.

Lihat [otorisasi Android](https://developer.android.com/identity/authorization) dan [pembatasan loopback Google](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration).

## 2B. Server OAuth untuk web, iOS, atau alternatif Android

Pada iPhone/iPad gunakan jalur server ini; Google Identity dan vault native Android tidak tersedia di iOS. Koneksi iOS disimpan selama sesi aplikasi, belum memakai Keychain.

Gunakan server SuperGPT yang kamu kendalikan. Secret OAuth Google serta refresh token berada pada server; aplikasi hanya menyimpan koneksi opaque dan meminta access token saat membutuhkan MCP.

1. Siapkan origin HTTPS server, misalnya `https://supergpt.example`. Domain contoh ini harus diganti dengan domain nyata yang kamu kelola.
2. Buat OAuth client tipe **Web application**, tandai **Use this client for an AI-powered agent** sesuai Google, lalu daftarkan redirect URI tepat:

   ```text
   https://DOMAIN-SERVER-KAMU/__google/callback
   ```

3. Simpan konfigurasi server pada environment pribadi, di luar Git/APK:

   | Variabel | Nilai yang perlu dipasang |
   | --- | --- |
   | `SUPERGPT_PUBLIC_ORIGIN` | Origin HTTPS server yang terdaftar |
   | `SUPERGPT_GOOGLE_CLIENT_ID` | Client ID Web application SuperGPT |
   | `SUPERGPT_GOOGLE_CLIENT_SECRET` | Secret client web, server saja |
   | `SUPERGPT_GOOGLE_TOKEN_KEY` | Kunci acak 32 byte dalam base64 untuk AES-GCM; simpan backup secara aman |
   | `SUPERGPT_SERVER_TOKEN` | Token akses server yang kuat |
   | `SUPERGPT_ALLOWED_ORIGINS` | Origin browser SuperGPT yang diizinkan, dipisah koma |
   | `SUPERGPT_SDK_DATA` | Direktori privat server untuk data terenkripsi |

4. Reverse proxy HTTPS harus meneruskan `/__google/*` ke server Node, mempertahankan Host publik. Jangan mencatat query callback OAuth, Authorization headers atau body token ke log. Route ini sudah dihubungkan ke `server/sdk/main.mjs` dan Vite preview development melalui `scripts/sdkBridge.mjs`. Google OAuth belum dideploy dalam tugas ini.
5. Di plugin Google pilih **Koneksi Google → Server OAuth SuperGPT**, isi origin server dan token akses server. Ini terpisah dari endpoint model/API key chat. Client secret tidak diisi di aplikasi.
6. `GET /__google/config` harus mengembalikan `ready: true`. Jika konfigurasi server belum lengkap, aplikasi menunjukkan belum dikonfigurasi dan tidak menandai plugin aktif. Development loopback hanya untuk pengujian lokal eksplisit, bukan pengganti HTTPS produksi.
7. Server meminta `access_type=offline`, PKCE dan consent Google; result polling memerlukan proof acak dari aplikasi. Refresh token disimpan terenkripsi; token tidak dikirim melalui URL. Menutup login/menghapus koneksi tidak mengklaim mencabut seluruh grant Google proyek.

Lihat [Google OAuth web-server](https://developers.google.com/identity/protocols/oauth2/web-server). Google tidak menggunakan dynamic registration seperti sebagian MCP server lain: aplikasi SuperGPT harus memiliki client sendiri.

## 3. Pemeriksaan setelah pendaftaran dan izin build

- Pastikan callback/client/scopes/preview benar, compile hanya setelah pengguna meminta, lalu masuk dari Plugin → layanan Google → Lanjutkan dengan Google.
- Uji akun yang dipilih, penolakan sebagian scope, login ulang, restart aplikasi, pembatalan, penghapusan koneksi, dan sign-out. Status terhubung mensyaratkan MCP initialize dan tools/list berhasil.
- Uji satu operasi baca yang dipilih pengguna; untuk menulis, tampilkan argumen tindakan lalu minta persetujuan melalui mekanisme chat yang sudah ada.
- Uji web broker menggunakan HTTPS sungguhan, CORS origin yang tepat, refresh sesudah access token berakhir, dan pemulihan server dengan kunci enkripsi yang sama.
- Sampai langkah tersebut dilakukan, jangan menyatakan akun Google nyata sudah terhubung atau semua tool Google berhasil berjalan.

Panduan mulai dari nol dan pilihan iPhone tanpa Mac: [Google OAuth dan iOS](ios-and-google-setup.md).
