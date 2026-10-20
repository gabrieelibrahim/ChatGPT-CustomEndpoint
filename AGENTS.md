# Aturan kerja project

- Setiap tugas yang menghasilkan perubahan file project wajib diakhiri dengan commit setelah pemeriksaan yang sesuai selesai. Jangan menunggu pengguna meminta commit lagi.
- Commit hanya perubahan yang terkait tugas tersebut. Periksa diff dan status sebelum commit; jangan sertakan API key, kredensial, konfigurasi pribadi, file build, atau perubahan pengguna yang tidak terkait.
- Jika tidak ada perubahan file, tidak perlu membuat empty commit. Jika commit terhalang atau pemeriksaan gagal, jelaskan statusnya secara jujur.
- Aturan commit ini tidak otomatis memberi izin push, merge PR, atau compile Tauri; ikuti instruksi pengguna untuk tindakan tersebut.
- Setiap rilis Android wajib memakai nama aset persis `SuperGPT.apk`. Nomor versi hanya di tag stabil `vX.Y.Z`; jangan tambahkan versi atau arsitektur ke nama APK rilis.
- Publikasikan sebagai GitHub Release biasa dengan `--prerelease=false --latest`, bukan draft atau prerelease. Gunakan `npm run release:android -- --tag vX.Y.Z --apk <APK> --notes <catatan>` agar nama aset, metadata APK, signature dan checksum diperiksa. Perintah ini hanya boleh dijalankan jika pengguna sudah mengizinkan publikasi rilis.
