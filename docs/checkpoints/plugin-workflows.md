# Alur kerja lintas plugin dalam chat

## Source

- Halaman awal mobile dan desktop menyediakan tiga saran yang mengisi composer: email ke ringkasan/draf, dokumen tindak lanjut, dan kalender. Pengguna tetap mengirim pesannya sendiri.
- `shared/workflows.json` memuat saran dan instruksi yang sama untuk runtime langsung maupun SDK server. Model diminta membaca sumber, memperjelas detail, menyiapkan isi/destinasi/tujuan, dan melaporkan hasil yang terkonfirmasi. Ini panduan model, bukan mesin workflow deterministik.
- Persetujuan per panggilan tool tetap diberlakukan oleh kedua runtime, termasuk operasi baca. Tidak ada persetujuan menyeluruh. Ketersediaan aksi bergantung pada tools, izin, serta plugin yang benar-benar terhubung.
- Riwayat langkah disimpan sebagai item chat `tool_activity`, tanpa menyalin argumen, isi email, output tool, atau token ke riwayat langkah. Kartu persetujuan tetap menampilkan argumen untuk ditinjau.
- Status membedakan menunggu, berjalan, hasil diterima, error eksplisit, ditolak, dibatalkan sebelum dipanggil, dan hasil belum terkonfirmasi. Hasil diterima tidak berarti semua tujuan pekerjaan berhasil.
- Jika eksekusi terputus atau transport gagal, tindakan yang sedang berjalan ditandai belum terkonfirmasi. Tidak ada pemutaran ulang otomatis; pengguna/model diarahkan memeriksa tujuan sebelum mengulang. Ini bukan jaminan rollback atau deduplikasi server.
- Item aktivitas tambahan hanya dikirim melalui main chat, tidak melalui protokol item ChatKit standar.

## Pemeriksaan

- TypeScript `tsc --noEmit`: lulus; tidak menghasilkan berkas build.
- `node --check server/sdk/agents.mjs` dan `server/sdk/mainChat.mjs`: lulus.
- `git diff --check`: lulus.
- Tidak menambah/menjalankan tes atau pengujian akun Google nyata pada tugas ini. UI dan alur end-to-end belum diperiksa saat runtime.
- Tidak compile frontend/APK, push, deploy, atau rilis. Pendaftaran Google Cloud tetap diperlukan sesuai panduan OAuth sebelumnya.
