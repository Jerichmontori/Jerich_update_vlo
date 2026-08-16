# Konfirmasi rasio grade 4,5 — tanpa perubahan kode

## Keputusan
- Grade setengah (mis. 4,5) **tidak perlu** ditambahkan ke tombol aspek Catatan Juri. Aspek Catatan Juri tetap memakai angka bulat 1–5.
- Tabel rasio `lookup_nilai` (database) dan `lookupNilaiClient` (form) sudah memuat nilai tersendiri untuk setiap setengah langkah pada **kriteria induk**:
  1,0=0,050 · 1,5=0,120 · 2,0=0,220 · 2,5=0,360 · 3,0=0,520 · 3,5=0,680 · 4,0=0,810 · **4,5=0,910** · 5,0=1,000.
- Artinya grade 4,5 pada kriteria induk sudah punya rasio tersendiri (0,910), bukan hasil rata-rata. Juri yang memilih 4,5 pada kriteria induk akan menghasilkan rasio induk 0,910 yang lalu membatasi semua aspek Catatan Juri di bawahnya.

## Yang TIDAK dikerjakan
- Tidak menambah tombol 4½ (atau setengah lain) pada aspek Catatan Juri — tetap 1–5 bulat.
- Tidak ada migrasi database.
- Tidak ada perubahan pada `src/routes/_authenticated/dashboard.tsx`.

## Hasil
Tidak ada perubahan kode yang diperlukan. Rasio 4,5 = 0,910 sudah aktif untuk kriteria induk, dan aspek Catatan Juri tetap bernilai bulat 1–5 yang dikalikan dengan rasio induk tersebut.
