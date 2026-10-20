# MCP, timeout, dan startup mobile

Pengaturan **Umum → Batas waktu respons** menerima 1–3600 detik, atau satuan menit. Nilai baru berlaku setelah Terapkan atau memilih preset. Saat mengetik, nilai aktif tidak diubah. Pengaturan dipakai chat provider, run SDK, panggilan MCP SDK, dan transkripsi endpoint. Deadline keseluruhan tetap membatalkan pekerjaan; penyedia dapat memiliki batas yang lebih pendek. Batas pengaman foreground Android dinaikkan menjadi satu jam plus 30 detik, dan layanan tetap dihentikan ketika permintaan berakhir.

**Plugin → Template koneksi** menyediakan Microsoft Learn, Cloudflare Docs, DeepWiki, dan Exa. Sambungkan melakukan initialize dan tools/list, termasuk pagination. Koneksi baru hanya diaktifkan setelah pemeriksaan berhasil. Menu menampilkan waktu pemeriksaan dan daftar tool; itu hasil pemeriksaan terakhir, bukan jaminan server selalu online. Maksimal delapan koneksi aktif. URL sendiri dan bearer token opsional tersedia; token berada di sessionStorage, terpisah dari konfigurasi lokal dan riwayat.

**Fitur AI → Pemrosesan tools** memilih otomatis, langsung di perangkat, atau server SDK. Otomatis memakai server jika dikonfigurasi/tersedia di preview; APK tanpa server memakai loop function calling langsung. Jalur langsung mendukung Chat Completions, MCP Streamable HTTP, dan pencarian Exa. Model endpoint wajib mendukung tools. Responses dan fitur khusus provider tetap memakai server SDK. Tidak ada fallback diam-diam ke layanan/model lain ketika endpoint menolak tools.

Tool langsung meminta persetujuan per panggilan, menampilkan nama layanan dan argumen, lalu melanjutkan jawaban pada pesan yang sama. Tolak/Stop tidak menjalankan operasi. Stream terputus tidak dijalankan ulang. Sumber diambil dari keluaran tool; pencarian gagal tidak menghasilkan sumber buatan. Hasil dan argumen MCP perlu dianggap data layanan luar. Transport membatasi ukuran, jumlah putaran/panggilan, sesi, URL dan header; redirect tidak diikuti. Relay browser hanya untuk development pada loopback dengan origin yang sama. APK memakai HTTP native, sementara browser produksi bergantung pada CORS layanan.

Koneksi ini tidak otomatis memberi akses ke akun pihak ketiga. OAuth interaktif, stdio di Android, MCP sampling/elicitation, serta seluruh fitur proprietary ChatGPT tidak diimplementasikan oleh template ini. Layanan yang memerlukan OAuth masih membutuhkan integrasi login penyedia. Jangan memasukkan token ke URL. Exa dapat menerapkan kuota meskipun handshake sukses.

Startup sebelumnya memiliki splash Android diikuti logo HTML berulang. Bridge sekarang menahan satu permukaan native sampai React melukis dan mengirim `ready`; logo HTML disembunyikan ketika bridge tersedia. Ada fallback 15 detik dan fade keluar singkat. Browser mendapat satu animasi masuk logo, bukan pulse tanpa akhir. Android sebelum versi 12 memakai overlay dengan logo yang sama selama kesiapan web. Perubahan native belum dibuktikan melalui APK baru/perangkat fisik pada tugas ini.

Sidebar mempertahankan ukuran yang ada: menu/riwayat 18 px dengan bobot 400, judul kategori 500, merek 22 px/500. Pengujian browser 390×813 memeriksa bobot CSS aktual; font platform Android/Windows dapat tetap berbeda.

Validasi 20 Oktober 2026: empat endpoint template berhasil initialize/tools/list. Microsoft Learn juga menjawab pencarian publik dokumentasi Azure Functions, dengan sumber Microsoft. Uji model dan MCP lokal menguji approval, penolakan, pembatalan, pagination/SSE, token/sesi, redirect, respons terpotong, serta batas timeout. Seluruh 190 tes lolos. Build web lolos bersama guard urutan CSS SDK. Pemeriksaan Kotlin hanya mengompilasi sumber terhadap Android 36; tidak membuat APK atau menjalankan mikrofon/perangkat.

Referensi resmi:
- https://openai.github.io/openai-agents-js/guides/mcp/
- https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- https://learn.microsoft.com/en-us/training/support/mcp-developer-reference
- https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/
- https://developer.android.com/develop/ui/views/launch/splash-screen/migrate
