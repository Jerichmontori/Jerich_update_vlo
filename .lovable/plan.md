# Panel Hubungan Pita Nilai dengan Batas Kategori

Menampilkan secara jelas di tab **Pita Nilai** bagaimana pita yang diatur admin berhubungan dengan pengaturan **batas bawah / batas atas kategori**, serta apa pengaruhnya ke nilai akhir peserta.

## Yang ditambahkan

### 1. Kartu ringkasan "Rentang Kategori"
Di atas tabel pita, untuk kategori yang sedang dipilih:
- Batas bawah, nilai tengah, nilai standar, dan batas atas kategori.
- Kalimat penjelas: semua pita wajib berada di dalam rentang kategori; pita di luar rentang ditolak saat simpan.

### 2. Diagram batang rentang (visual)
Sebuah bar horizontal yang mewakili rentang kategori (batas bawah → batas atas), dengan setiap pita digambar sebagai segmen berwarna pada posisi proporsionalnya:
- Warna berbeda untuk pita Clear Text dan Tidak Clear Text.
- Hover/tooltip menampilkan label, rentang, dan deskripsi pita.
- Area yang tidak tertutup pita mana pun ditandai sebagai "celah" (tidak terpakai).

```text
81.000                                              83.000
|--[TCT 81.099]---[CT 81.301-500][CT .501-700]...----|
      ^ tidak clear text          ^ clear text
```

### 3. Panel "Pengaruh ke Perhitungan"
Daftar poin singkat yang menjelaskan alur nilai:
- Nilai juri dinormalisasi jadi skor 0–1 dari kriteria + catatan juri − perhatian.
- Jika kategori punya pita aktif: skor dipetakan ke pita sesuai status Clear Text, lalu diinterpolasi di dalam rentang pita tersebut.
- Jika tidak ada pita aktif: sistem memakai kurva lama antara batas bawah, nilai standar, dan batas atas kategori.
- Mengubah batas kategori tidak otomatis mengubah pita — pita harus disesuaikan dan nilai dihitung ulang.

### 4. Peringatan konsistensi (read-only)
Badge peringatan bila terdeteksi:
- Pita keluar dari rentang kategori.
- Pita tumpang tindih dalam satu kelompok (Clear Text / Tidak).
- Kelompok Clear Text atau Tidak Clear Text kosong.
- Ada celah besar antar pita.

Peringatan bersifat informatif; validasi keras saat simpan tetap seperti sekarang.

## Catatan teknis
- Perubahan hanya di `src/components/PitaNilaiTab.tsx` (plus komponen kecil baru untuk diagram bila perlu).
- Data batas kategori sudah tersedia dari query `kategori`; tambahkan kolom `nilai_tengah` dan `nilai_standart` ke select yang ada.
- Tidak ada perubahan database, RPC, atau logika perhitungan.
