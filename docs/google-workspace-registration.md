# Google OAuth dan MCP Google API SuperGPT

22 Oktober 2026. Implementasi memakai MCP terintegrasi milik SuperGPT yang memanggil API REST Google resmi. Tidak memakai server MCP Google Developer Preview. Pengguna memilih akun Google masing-masing dan memberi izin layanan; tidak perlu satu akun bersama atau langganan Workspace untuk layanan yang mendukung akun pribadi.

## Status source

- Shared transport: `shared/googleApiMcp.mjs`. JSON-RPC MCP initialize, tools/list, tools/call; Android/perangkat memakai transport dalam memori, server agent memakai adapter Streamable HTTP dalam memori.
- Alamat `https://google.supergpt.invalid/mcp/<service>` adalah identitas internal yang ditangani aplikasi, bukan domain server yang perlu didaftarkan/dideploy. Token tidak dikirim ke alamat tersebut. API tujuan dibatasi ke host dan route Google pada source.
- Koneksi diuji dengan satu permintaan baca minimal ke API produk sebelum ditampilkan aktif. Hasil pemeriksaan tidak membuktikan semua file, semua metode, atau semua peran akun dapat diakses.
- Entri Google lama perlu dihubungkan ulang. Kredensial yang terikat ke resource preview tidak dipindahkan diam-diam; endpoint preview lama ditolak.
- OAuth Android, scope Data Access, API produk dan Chat app telah disiapkan pada proyek pemilik. Identitas proyek pribadi disimpan di catatan lokal.
- Belum compile, menguji login/operasi akun nyata, deploy broker web/iOS, atau rilis. Keberhasilan TypeScript bukan bukti Kotlin/Gradle maupun koneksi nyata.

## Kemampuan yang diimplementasikan

| Layanan | Baca | Tulis bila dipilih |
| --- | --- | --- |
| Gmail | Cari, baca pesan/MIME, daftar label | Draf email dan ubah label; tidak mengirim email |
| Drive | Cari/metadata, baca file teks UTF-8, ekspor Workspace ke teks/CSV | Buat folder, ubah nama/deskripsi file yang diizinkan melalui drive.file |
| Docs | Cari dan baca struktur/isi termasuk tabs | Buat dokumen, batchUpdate termasuk perubahan/penghapusan isi |
| Sheets | Cari, metadata spreadsheet, baca rentang sel | Buat spreadsheet, tulis nilai RAW/USER_ENTERED |
| Slides | Cari dan baca presentasi | Buat presentasi, batchUpdate |
| Calendar | Daftar kalender/acara dan freebusy | Buat acara; sendUpdates menentukan pengiriman undangan |
| Chat | Daftar spaces/pesan | Kirim pesan teks sebagai pengguna |
| Contacts | Daftar/cari kontak pribadi | Tidak ada |
| Classroom | Kelas, tugas, materi, pengumuman, topik dan siswa | Buat pengumuman sesuai peran guru |

Setiap panggilan tool tetap meminta persetujuan argumen di chat. Mode baca tidak mendaftarkan tool tulis meskipun akun pernah memberi scope lebih luas. Tidak ada retry otomatis permintaan API, terutama tulis; kegagalan jaringan tidak membuktikan tindakan belum diterima. Pagination diberikan melalui nextPageToken, bukan mengambil semua data diam-diam. Respons dibatasi 2 MB dan argumen tool 64 KB; gunakan pencarian/rentang lebih kecil. API/provider/device tetap mempunyai kuota dan batasnya sendiri.

Drive `drive.file` tidak memberi akses tulis seluruh file lama. File harus dibuat atau dibuka/diizinkan untuk aplikasi; Picker untuk memilih file lama belum disediakan. PDF/binary Drive tidak diekstrak oleh tool baca teks. Docs/Slides batchUpdate mengikuti schema API Google dan argumennya ditampilkan saat persetujuan. Operasi yang tidak tercantum belum diimplementasikan.

Chat/Classroom tergantung dukungan produk, akun, organisasi, peran, keanggotaan dan kebijakan admin. Memakai API umum menghapus ketergantungan preview MCP; tidak mengubah aturan produk Google. Classroom membatasi beberapa perubahan ke proyek yang membuat resource, dan perubahan di luar peran pengguna tetap ditolak Google.

## 1. Google Cloud dan consent

1. Pakai proyek Google Cloud khusus aplikasi. Konfigurasi Google Auth Platform Branding, kontak dukungan dan pengembang.
2. Gunakan Audience External. Saat Testing, hanya akun yang ditambahkan pada Test users dapat memberi izin. Untuk publik, lengkapi branding, domain/privacy policy dan verifikasi Google sesuai scope.
3. Aktifkan API produk: Gmail API, Drive API, Docs API, Sheets API, Slides API, Calendar API, Chat API, People API dan Classroom API. Layanan MCP preview tidak diperlukan; aktivasi lama tidak digunakan oleh source baru.
4. Scope yang diminta source ada di `shared/googleWorkspace.json`, ditambah userinfo.email untuk mengikat akun. Mulai dengan mode baca. Tulis diminta saat pengguna memilihnya. Daftar scope di console boleh memuat pilihan yang lebih banyak; itu bukan pemberian akses akun.
5. Google Chat tetap memerlukan Chat app: name Chat MCP, avatar `https://developers.google.com/chat/images/quickstart-app-avatar.png`, description Chat MCP server, interactive features off, error logging on.
6. Tidak perlu mendaftar Developer Preview untuk penghubung ini. Tidak perlu membeli Workspace hanya untuk memakai Gmail/Drive pribadi.

Lihat [Google OAuth](https://developers.google.com/identity/protocols/oauth2), [verifikasi sensitive scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) dan [restricted scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). Gmail/Drive dapat memerlukan verifikasi/security assessment sesuai pemrosesan dan penggunaan data. Mode Testing belum merupakan akses publik tanpa batas.

## 2. Android

Google Identity AuthorizationClient membuka pemilih akun dan consent Google. Package produksi **id.sakelar.client**, SHA-1 release permanen:

```
69:AA:92:74:18:6D:DF:41:39:25:70:9D:F6:BF:21:04:BF:56:B6:F8
```

Client Android pemilik sudah dibuat dengan package/sertifikat tersebut. Client ID dikenali Google Identity melalui pendaftaran package/signature; pengguna tidak mengetik client ID atau secret. Penandaan AI-powered agent yang sudah dipilih tidak dijadikan syarat penghubung API ini. APK tetap memakai sertifikat release yang dipin; jangan mengganti key untuk memperbaiki OAuth. Debug memakai package dan sertifikat berbeda.

Silent authorization terikat email terverifikasi akun sebelumnya; bila perlu consent lagi, koneksi meminta hubungkan ulang. Tidak menyimpan client secret atau refresh token di APK. Metadata koneksi disimpan dengan vault Android Keystore. Access token hanya berada dalam memori; tiap chat memperoleh token lewat jalur yang sudah ada. Bila token habis dalam chat panjang, sambungkan ulang dan tinjau hasil sebelum mengulangi operasi tulis.

## 2a. Android: browser login via OAuth broker

The previous Desktop-client loopback flow failed at token exchange with `client_secret is missing`. Do not add a Google client secret to the APK.

1. Create a **Web application** client in the same Google project. Register exactly `https://sakelar.web.id/__google/callback`.
2. Put its client ID, client secret and AES-GCM token key in private server environment configuration only.
3. Set `VITE_GOOGLE_OAUTH_SERVER=https://sakelar.web.id` in ignored `.env.local` on the build machine. The Desktop client ID is no longer used.
4. Automatic sign-in opens the system browser through the broker. After consent, use **Return to SuperGPT**. Explicit native Android authorization remains available.
5. `server/google/main.mjs` exposes only Google OAuth routes on loopback port 1431. Reverse proxy `/__google/`, preserve the public Host and overwrite `X-Real-IP`. Disable callback access logs so OAuth codes are not logged.
6. Public app login is opt-in through `SUPERGPT_GOOGLE_PUBLIC_LOGIN=true`. Set `SUPERGPT_GOOGLE_TRUST_PROXY=true` only behind a trusted loopback proxy. Login starts are limited to 10 per IP per 15 minutes, with at most 100 outstanding flows. Each result/cancel requires the app's per-flow PKCE proof; accessing tokens requires an unguessable connection capability.
7. Set `SUPERGPT_GOOGLE_DATA` to a private directory, use a 32-byte base64 `SUPERGPT_GOOGLE_TOKEN_KEY`, and explicitly set `SUPERGPT_ALLOWED_ORIGINS`. Never embed a shared server admin token in the APK.

Google refresh tokens remain encrypted on the broker. Android stores its connection capability in the existing encrypted vault. Google data used by tools may be sent to the selected AI provider as disclosed in the privacy policy.

## 3. Web/iOS: broker OAuth

Source broker tersedia pada `server/google/oauthBroker.mjs`, terhubung ke `server/sdk/main.mjs`. Belum dideploy. iOS memerlukan broker ini karena bridge Google Identity Android tidak tersedia. iOS/web menyimpan koneksi selama sesi, belum Keychain iOS.

1. Tentukan origin HTTPS nyata yang kamu kelola. Buat OAuth client Web application untuk broker. Redirect URI tepat `https://DOMAIN-SERVER/__google/callback`. Tidak perlu menandai client sebagai preview MCP.
2. Pasang env privat: SUPERGPT_PUBLIC_ORIGIN, SUPERGPT_GOOGLE_CLIENT_ID, SUPERGPT_GOOGLE_CLIENT_SECRET, SUPERGPT_GOOGLE_TOKEN_KEY (32 byte base64 AES-GCM), SUPERGPT_SERVER_TOKEN, SUPERGPT_ALLOWED_ORIGINS dan SUPERGPT_SDK_DATA. Secret/kunci/refresh token tidak boleh masuk Git/APK atau log.
3. Reverse proxy `/__google/*` ke Node, gunakan HTTPS dan jangan log query callback/Authorization/body token. `GET /__google/config` harus menunjukkan ready true.
4. Di plugin pilih Server OAuth SuperGPT dan atur origin/token server. Endpoint model/API key tetap terpisah. Broker menggunakan state, PKCE, offline consent, proof polling dan penyimpanan refresh token terenkripsi.
5. Mode agent perangkat memanggil API Google dari perangkat. Mode agent server mengirim access token ke server AI yang dipilih pengguna dan server itu memanggil Google. Pakai server tepercaya; data hasil tool juga dapat diteruskan ke endpoint model yang dipilih saat menjawab.
6. Penghapusan koneksi membersihkan sesi lokal/server sesuai mode; bukan klaim mencabut seluruh grant proyek pada akun Google. Pengguna bisa mencabut akses dari pengaturan akun Google.

## 4. Sesudah pengguna meminta compile

Build APK memakai identitas release permanen, lalu uji pemilihan akun sendiri, partial consent/penolakan, read-only, operasi tulis dengan persetujuan, restart, refresh, pembatalan dan penghapusan koneksi. Uji paling sedikit satu pembacaan tiap API yang akan diklaim aktif. SDK server harus diperbarui bersama aplikasi agar memahami transport internal baru. Tidak boleh menyatakan koneksi nyata berhasil sebelum hasil runtime tersedia.

Referensi implementasi: [Drive files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [Gmail drafts](https://developers.google.com/workspace/gmail/api/guides/drafts), [Docs batchUpdate](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate), [Sheets values](https://developers.google.com/workspace/sheets/api/guides/values), [Slides batchUpdate](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate), [Calendar events](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Chat messages](https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/create), [People connections](https://developers.google.com/people/api/rest/v1/people.connections/list), [Classroom course work](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list).
