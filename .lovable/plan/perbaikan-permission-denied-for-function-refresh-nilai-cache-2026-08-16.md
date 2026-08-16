# Perbaikan: "permission denied for function refresh_nilai_cache"

## Penyebab (terverifikasi)
Fungsi `public.refresh_nilai_cache()` saat ini hanya bisa dijalankan oleh peran internal (`service_role`). Peran pengguna yang login (`authenticated`) tidak punya hak eksekusi, sehingga tombol **Hitung Ulang Nilai** di tab Pita Nilai selalu gagal dengan pesan "permission denied".

## Perbaikan

### 1. Migrasi database
- Tambahkan pemeriksaan peran di dalam `refresh_nilai_cache()`: hanya pengguna dengan role **admin** (dan `service_role`) yang boleh menjalankannya; selain itu fungsi menolak dengan pesan berbahasa Indonesia yang jelas.
- Berikan hak eksekusi fungsi tersebut kepada pengguna login, sehingga admin dapat memanggilnya dari aplikasi. Fungsi tetap `SECURITY DEFINER` dengan `search_path` terkunci.

### 2. Pengetatan tambahan (sekalian, aman)
- Cabut hak eksekusi `admin_set_pita_nilai` dari pengunjung anonim (saat ini masih menempel walau fungsi sudah menolak non-admin di dalamnya).

### 3. Penanganan di UI
- Di tab Pita Nilai, tampilkan pesan error yang ramah bila hitung ulang ditolak ("Hanya admin yang dapat menghitung ulang nilai") dan tampilkan status berhasil setelah selesai.

Tidak ada perubahan pada rumus perhitungan nilai.
