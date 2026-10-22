# Koneksi otomatis Sakelar — source checkpoint

- Login: `https://app.sakelar.web.id/login`; Base URL resmi: `https://api.sakelar.web.id/v1`.
- `src/lib/sakelarConnect.ts`: pemeriksaan server ready, challenge S256, login browser, kode pencocokan, polling dengan proof, model nyata, callback penyimpanan profil, dan cancellation/cleanup. Cookie Sakelar atau token Google tidak dipakai sebagai API key.
- `src/desktop/SakelarConnect.tsx` dipasang pada pengaturan endpoint untuk mobile/desktop, termasuk setup awal. Login opsional; endpoint manual tetap tersedia.
- Profil Sakelar dibuat terpisah, menjadi terpilih, dan memakai model pertama dari daftar akun. Key tersimpan melalui mekanisme existing: vault Android atau session storage web/iOS. Tidak ada key dalam riwayat chat, source, clipboard atau URL.
- Key berlabel SuperGPT berlaku 30 hari. Kuota tetap mengikuti akun. Izin Gmail/Drive melalui Plugin Google secara terpisah.
- Memerlukan backend `gabrieelibrahim/sakelar`: migration 020, flag server, routes koneksi, proxy web dan halaman consent. Clone kerja berada dalam workspace tugas ini. Belum deploy atau migrasi DB.
- Respons tidak pasti tidak diulang untuk menerbitkan key baru. Cleanup best effort mencabut key flow gagal; bila gagal, pengguna diminta memeriksa konsol.
- Pemeriksaan tipe tanpa emit dan diff lulus. Tidak menambah/menjalankan tes atau login nyata; alur end-to-end belum diperiksa. Tidak compile frontend/APK/iOS, push, deploy atau rilis.
