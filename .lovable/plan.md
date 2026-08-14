# Rincian Bobot & Cara Perhitungan Nilai

Menampilkan bobot tiap kriteria dan langkah perhitungan nilai (termasuk bonus catatan juri dan penalti perhatian) di halaman juri, form penilaian, dan detail catatan peserta.

## Yang akan dibuat

### 1. Fungsi database: rincian perhitungan
Fungsi baru `rincian_nilai_juri(_peserta, _juri)` yang mengembalikan rincian langkah demi langkah persis seperti rumus yang dipakai sekarang, tanpa mengubah rumusnya:

- Bobot tiap kriteria (Vokal/Interpretasi, Penghayatan, Intonasi/Artikulasi, Penampilan, Catatan Juri, Perhatian) beserta grade yang diberikan juri dan kontribusi skornya.
- Total skor berbobot dan bobot terpakai.
- Bonus Catatan Juri (rata-rata aspek yang diisi x bobot catatan).
- Penalti Perhatian (jumlah tanda / 15, maksimal 1, x bobot perhatian).
- Normalisasi 0–1 (nilai mentah terhadap batas maksimum/minimum).
- Pemetaan ke skala kategori peserta: batas bawah, nilai tengah, batas atas, nilai standar.
- Jalur khusus: Clear Text = Tidak, Clear Text = Ya, dan kondisi VAR.
- Nilai akhir juri (dibulatkan 3 desimal).

Akses: juri hanya boleh melihat rinciannya sendiri; admin, panitia, ketua juri, inspektur, dan inspektur VAR boleh melihat semua.

### 2. Komponen tampilan bersama
Komponen `RincianPerhitungan` (dialog/panel) yang menampilkan:

- Tabel: Kriteria | Bobot | Grade | Nilai terkonversi | Kontribusi.
- Blok langkah perhitungan berurutan dengan angka nyata di tiap langkah (skor berbobot → bonus catatan → penalti perhatian → normalisasi → pemetaan skala kategori → nilai akhir).
- Catatan singkat penjelas untuk tiap langkah dalam bahasa Indonesia.

### 3. Penempatan
- **Hasil Penilaian Saya (juri)** — tombol "Rincian Perhitungan" per baris, dan bagian rincian ditambahkan ke PDF hasil.
- **Form penilaian juri** — panel bobot tiap kriteria selalu terlihat, plus rincian perhitungan setelah nilai tersimpan.
- **Detail catatan peserta (viewer/panitia)** — rincian per juri ditampilkan sesuai hak akses peran.

## Catatan teknis

- Fungsi baru bersifat `SECURITY DEFINER` dengan `search_path` tetap dan cek peran internal, lalu `GRANT EXECUTE` hanya ke `authenticated` (mengikuti pola pengetatan izin fungsi yang sudah diterapkan di proyek ini).
- Rincian dihitung ulang dengan urutan logika identik dengan `hitung_nilai_juri`, sehingga angka akhir yang ditampilkan selalu sama dengan nilai yang tersimpan.
- Bobot default dipakai bila tabel kriteria kosong (Vokal 25, Penghayatan 20, Intonasi 30, Penampilan 25, Catatan 10, Perhatian -10), sama seperti perilaku fungsi saat ini.
- Ekspor PDF memakai jsPDF + autoTable yang sudah dipakai di komponen hasil juri.
