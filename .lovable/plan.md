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

## 2. Pembagian tugas IP 1 & IP 2 + report VAR per kasus

Dua Inspektur Pertandingan dengan tugas terpisah:

**IP 1 — jalannya penilaian (kondisi normal)**
- Memantau sesi berjalan dan progres juri.
- Mengakhiri sesi dan **memfinalisasi nilai** peserta pada kondisi normal (tanpa VAR/keberatan).
- Tidak berwenang mengoreksi nilai juri.

**IP 2 — penyelesaian VAR & keberatan**
- Saat sistem mendeteksi potensi VAR, kasus langsung masuk ke **antrean IP 2**, bukan ke form juri.
- IP 2 membuka detail persepsi (peta ayat & perbedaan antar juri) lalu memutuskan
  **satu keputusan berlaku untuk semua juri**:
  - **Clear Text = Ya / Tidak Clear Text**, dan
  - koreksi pilihan juri pada **4 komponen VAR** (clear text, salah kata,
    menambah kata, mengurangi kata) bila diperlukan.
- Kriteria lain dan catatan juri **tidak diubah**. Nilai akhir dihitung ulang otomatis
  setelah keputusan disimpan, dengan catatan alasan wajib diisi.
- IP 2 juga menangani **e-form keberatan** (bagian 1) sampai keputusan diterima/ditolak.
- Juri tidak diminta mengirim ulang nilai; form juri tetap terkunci.

**Peninjauan Kembali (nilai sudah final)**
- Bila nilai sudah difinalisasi IP 1 lalu muncul VAR/keberatan, IP 2 **mengajukan
  Peninjauan Kembali** ke Admin (dengan alasan).
- Admin menyetujui/menolak. Setelah disetujui, kasus terbuka untuk dikoreksi IP 2
  sebatas Clear Text dan 4 komponen VAR; setelah selesai nilai difinalkan kembali.
- Seluruh langkah (pengajuan, persetujuan admin, koreksi, finalisasi ulang) tercatat di audit log.

### Report VAR per kasus (dapat dipertanggungjawabkan)

Setiap kasus VAR menghasilkan **satu berita acara** yang bisa dicetak/di-PDF, berisi:

- Nomor kasus VAR, waktu deteksi, peserta (no. urut, nama, kategori), bacaan/mazmur.
- Rincian perbedaan antar juri: komponen dan ayat mana yang berbeda, siapa menandai apa.
- **Snapshot nilai sebelum koreksi** dan **nilai sesudah koreksi** per juri dan nilai akhir.
- Keputusan IP 2 (nama, waktu, catatan), dan bila melalui Peninjauan Kembali:
  alasan pengajuan + nama admin yang menyetujui beserta waktunya.
- Kolom tanda tangan: IP 1, IP 2, Ketua Dewan Juri.
- Jejak audit lengkap (siapa, kapan, aksi apa) hanya bisa ditambah, tidak bisa diubah/dihapus.

Halaman "Potensi VAR" di Admin tetap read-only, kini menampilkan status
(menunggu IP 2 / menunggu persetujuan admin / selesai) dan tombol **Unduh Berita Acara**,
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
- Dua peran IP: role baru `inspektur_var` (IP 2) di samping `inspektur` (IP 1),
  sehingga hak akses finalisasi normal dan hak koreksi VAR/keberatan terpisah.
- Tabel `var_keputusan_ip` (session VAR, ip_user_id, keputusan clear boolean,
  koreksi 4 komponen (jsonb), catatan, waktu).
- Tabel `var_snapshot_nilai` (session VAR, juri_id, kriteria/komponen, nilai sebelum, nilai sesudah)
  untuk berita acara; hanya insert (tidak bisa diubah/dihapus).
- Tabel `peninjauan_kembali` (peserta_id, pemohon IP 2, alasan, status, admin penyetuju, waktu).
- RPC baru: `ip2_putuskan_var(_peserta uuid, _clear boolean, _koreksi jsonb, _catatan text)` —
  menimpa Clear Text + 4 komponen VAR semua juri, menyimpan snapshot, refresh cache nilai;
  `ip2_ajukan_peninjauan(_peserta uuid, _alasan text)` dan `admin_putuskan_peninjauan(...)`;
  `var_berita_acara(_session uuid)` untuk data report;
  `ip_daftar_keberatan()`, `ip_putuskan_keberatan(...)`.


Frontend:
- Halaman baru `/keberatan` dan `/keberatan/status` (publik, dengan metadata SEO tersendiri).
- Halaman Inspektur: tab "Keberatan" dan tab "Koreksi VAR" dengan tombol
  Clear Text / Tidak Clear Text + catatan, menampilkan status keputusan IP lain.
- Tombol **Unduh Berita Acara VAR** (PDF per kasus) di halaman Inspektur dan Admin.

- Sidebar Admin: entri "Keberatan" (read-only + ekspor).
- Halaman Operator: pemilih kategori dan kontrol sesi per kategori.
- Halaman Admin > Juri: pengaturan kategori penugasan tiap juri.

## Catatan

Bagian 3 menyentuh inti alur sesi dan perhitungan nilai, jadi sebaiknya dikerjakan setelah
bagian 1 dan 2 stabil. Jika Anda setuju, saya mulai dari bagian 1 (E-Form Keberatan),
lalu bagian 2, lalu bagian 3 — setiap bagian dengan migrasi database yang perlu Anda setujui.
