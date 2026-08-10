# Rencana Pengembangan: Keberatan, Koreksi VAR oleh IP, dan Juri per Kategori

Tiga pengembangan besar. Disarankan dikerjakan bertahap sesuai urutan di bawah.

## 1. E-Form Pengajuan Keberatan (publik)

Halaman publik `/keberatan` yang bisa diisi peserta atau pendamping tanpa login.

- Identifikasi peserta: pilih/masukkan **nomor urut + nama** peserta, lalu isi:
  kategori keberatan (nilai, teknis, administrasi), uraian keberatan, nama pengaju,
  hubungan dengan peserta, no. HP/WA, dan (opsional) tautan bukti.
- Setelah kirim, pengaju menerima **nomor tiket** untuk mengecek status di
  `/keberatan/status` (cukup nomor tiket, tanpa data pribadi ditampilkan).
- Pengaman: validasi ketat (panjang teks, format HP), rate-limit per peserta/IP,
  serta jendela waktu — keberatan hanya bisa diajukan dalam N menit setelah peserta
  selesai dinilai (nilai default 60 menit, bisa diubah admin).
- Penanganan: **Inspektur Pertandingan (IP)** melihat daftar keberatan masuk,
  membuka detail peserta + nilai, lalu memberi keputusan
  (diterima / ditolak / diteruskan ke koreksi VAR) beserta catatan.
  Admin melihat semua keberatan dan rekapnya, serta bisa mengekspor ke laporan.
- Status tiket: `baru` → `ditinjau` → `diterima`/`ditolak`, tampil di halaman status.

## 2. Potensi VAR diselesaikan oleh 2 IP (bukan juri) + report per kasus

Alur baru menggantikan klarifikasi oleh juri:

- Saat sistem mendeteksi potensi VAR (perbedaan input Perhatian antar juri),
  kasus langsung masuk ke **antrean IP**, bukan ke form juri.
- Ada **dua Inspektur Pertandingan (IP 1 dan IP 2)**. Keduanya melihat detail persepsi
  (peta ayat & perbedaan antar juri — komponen yang sudah ada) dan masing-masing memberi
  keputusan **Clear Text = Ya** atau **Tidak Clear Text** beserta catatan alasan.
- Keputusan baru **sah bila kedua IP sepakat**. Bila berbeda, kasus berstatus
  **"beda pendapat"** dan diteruskan ke **Ketua Dewan Juri** sebagai pemutus akhir.
  Selama belum sah, nilai peserta tidak berubah.
- Keputusan sah berlaku **sama untuk semua juri**: menimpa komponen Clear Text pada
  seluruh juri peserta tersebut; komponen lain (salah kata, menambah/mengurangi kata,
  catatan juri, kriteria lain) **tidak diubah**. Nilai akhir dihitung ulang otomatis.
- Juri tidak lagi diminta mengirim ulang nilai untuk kasus VAR ini; form juri tetap terkunci.

### Report VAR per kasus (dapat dipertanggungjawabkan)

Setiap kasus VAR menghasilkan **satu berita acara** yang bisa dicetak/di-PDF, berisi:

- Nomor kasus VAR, waktu deteksi, peserta (no. urut, nama, kategori), bacaan/mazmur.
- Rincian perbedaan antar juri: komponen dan ayat mana yang berbeda, siapa menandai apa.
- **Snapshot nilai sebelum koreksi** dan **nilai sesudah koreksi** per juri dan nilai akhir.
- Keputusan IP 1 dan IP 2 (masing-masing dengan nama, waktu, catatan), serta keputusan
  Ketua Dewan Juri bila terjadi beda pendapat.
- Kolom tanda tangan: IP 1, IP 2, Ketua Dewan Juri.
- Jejak audit lengkap (siapa, kapan, aksi apa) tidak bisa dihapus atau diubah.

Halaman "Potensi VAR" di Admin tetap read-only, kini menampilkan status
(menunggu IP 1 / menunggu IP 2 / beda pendapat / selesai) dan tombol **Unduh Berita Acara**,
serta rekap seluruh kasus VAR ikut masuk ke Laporan Pertanggungjawaban.


## 3. Juri per kategori + sesi paralel

Satu aplikasi, juri di-assign ke kategori, dan beberapa kategori bisa berjalan bersamaan.

- **Penugasan juri**: admin menetapkan satu atau lebih kategori untuk tiap juri
  (mis. Juri A–D untuk P/KB, Juri E–H untuk W/KI). Juri hanya melihat dan menilai
  peserta pada kategori yang ditugaskan.
- **Sesi paralel**: kontrol sesi operator berubah dari satu sesi aktif global menjadi
  **satu sesi aktif per kategori**, sehingga P/KB dan W/KI bisa tampil bersamaan.
  Operator memilih kategori terlebih dahulu, baru mengelola peserta di kategori itu.
- **Pool juri & perhitungan**: jumlah juri, deteksi VAR, status "semua juri sudah kirim",
  dan monitoring Inspektur dihitung per kategori berdasarkan juri yang ditugaskan
  dan aktif menilai — bukan seluruh juri.
- **Live ranking, laporan, vMix**: mengikuti kategori masing-masing; layar live
  bisa memilih kategori mana yang ditampilkan (mekanisme filter kategori yang sudah ada).
- Bila satu juri ditugaskan ke dua kategori, ia melihat kedua antrean dan menilai bergantian.

## Detail teknis

Basis data:
- Tabel `keberatan` (nomor tiket, peserta_id, kategori keberatan, uraian, pengaju, kontak,
  status, keputusan, catatan IP, timestamps) + RLS: `anon` hanya boleh insert lewat
  server route publik, baca status hanya lewat RPC berdasarkan nomor tiket; IP/admin baca-tulis penuh.
- Endpoint publik `src/routes/api/public/keberatan.ts` untuk submit + cek status
  (validasi Zod, rate limit, tanpa PII pada respons status).
- Tabel `juri_kategori` (juri_id, kategori) untuk penugasan juri.
- Kolom kategori pada kontrol sesi (`system_config` sesi tampil menjadi per kategori),
  penyesuaian `mulai_sesi` / `akhiri_sesi` / `get_sesi_tampil` / `set_sesi_tampil`.
- Penyesuaian fungsi pool & skor: `juri_in_pool`, `juri_pool_count`, `all_juri_submitted`,
  `detect_potensi_var`, `inspektur_monitor`, `inspektur_ringkasan`, `get_ranking`.
- RPC baru: `ip_putuskan_var(_peserta uuid, _clear boolean, _catatan text)` (security definer,
  gate role inspektur/admin) yang menimpa komponen Clear Text semua juri, menyimpan snapshot,
  dan me-refresh cache nilai; `ip_daftar_keberatan()`, `ip_putuskan_keberatan(...)`.

Frontend:
- Halaman baru `/keberatan` dan `/keberatan/status` (publik, dengan metadata SEO tersendiri).
- Halaman Inspektur: tab "Keberatan" dan tab "Koreksi VAR" dengan tombol
  Clear Text / Tidak Clear Text + catatan.
- Sidebar Admin: entri "Keberatan" (read-only + ekspor).
- Halaman Operator: pemilih kategori dan kontrol sesi per kategori.
- Halaman Admin > Juri: pengaturan kategori penugasan tiap juri.

## Catatan

Bagian 3 menyentuh inti alur sesi dan perhitungan nilai, jadi sebaiknya dikerjakan setelah
bagian 1 dan 2 stabil. Jika Anda setuju, saya mulai dari bagian 1 (E-Form Keberatan),
lalu bagian 2, lalu bagian 3 — setiap bagian dengan migrasi database yang perlu Anda setujui.
