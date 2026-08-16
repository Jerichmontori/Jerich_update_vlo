# Mode 1 atau 2 Inspektur

Menambahkan saklar global agar lomba bisa dijalankan dengan **dua inspektur** (seperti sekarang: Inspektur Pertandingan + Inspektur VAR) atau **satu inspektur** (semua tugas dipegang Inspektur Pertandingan).

## Perilaku kedua mode

**Mode 2 inspektur (default, seperti sekarang)**
- Inspektur Pertandingan (IP): monitoring sesi, catat perhatian, ajukan VAR, akhiri sesi.
- Inspektur VAR (IP2): antrean VAR, buka perbaikan VAR, koreksi per juri, pulihkan nilai, putusan keberatan.

**Mode 1 inspektur**
- Semua kewenangan IP2 ikut dipegang IP. Halaman Inspektur VAR tetap ada tapi bisa diakses oleh IP.
- Di halaman Inspektur muncul tab tambahan "VAR & Perbaikan" berisi antrean VAR, koreksi per juri, dan pulihkan nilai.
- **Menu Keberatan otomatis dikunci** (tidak menerima pengajuan keberatan baru dan panel keputusan keberatan disembunyikan/nonaktif). Perbaikan nilai hanya lewat jalur VAR dan permintaan juri.
- Notifikasi/alur yang selama ini dikirim ke IP2 diarahkan juga ke IP.
- Jika ada akun ber-peran `inspektur_var`, akun itu tetap bisa bekerja (tidak dikunci), hanya saja tidak wajib ada.

## Perubahan lain (berlaku di kedua mode)

Fitur "Ajukan Live Ranking" dihapus dari peran Inspektur Pertandingan — tombol/panel pengajuan beserta akses RPC-nya dicabut dari halaman inspektur.

## Alur penyelesaian VAR pada mode 1

```text
Potensi VAR terdeteksi / diajukan Inspektur
  -> notifikasi ke Admin + Inspektur (satu orang)
  -> Inspektur buka perbaikan dari tab "VAR & Perbaikan"
  -> Inspektur koreksi nilai per juri (hanya parameter pemicu VAR)
  -> Snapshot nilai sebelum/sesudah tersimpan otomatis
  -> Inspektur tutup perbaikan -> nilai final diperbarui
```

Tidak ada perubahan pada rumus nilai, pita nilai, maupun data yang sudah tersimpan.


## Pengaturan

Saklar "Jumlah Inspektur: 1 / 2" di dashboard **Admin → tab Pengaturan**. Hanya admin yang bisa mengubahnya, berlaku global dan langsung aktif tanpa perlu login ulang (halaman inspektur membaca nilai ini saat dibuka).

## Detail teknis

- Simpan mode di `public.system_config` dengan key `mode_inspektur` (nilai `{"jumlah": 2}`), plus RPC `get_mode_inspektur()` (boleh dibaca semua peran login) dan `set_mode_inspektur(_jumlah int)` (admin saja).
- Fungsi helper `public.is_inspektur_var(_uid uuid)`: `true` jika user punya peran `inspektur_var`, ATAU (mode = 1 DAN user punya peran `inspektur`).
- Ganti pemeriksaan `has_role(auth.uid(),'inspektur_var')` dengan helper tersebut pada fungsi: `ip2_buka_perbaikan`, `ip2_koreksi_per_juri`, `ip2_pulihkan_nilai`, `ip2_putuskan_var`, `ip2_ajukan_peninjauan`, dan RPC daftar/notifikasi terkait. RLS policy yang menyebut `inspektur_var` ikut memakai helper.
- Kunci keberatan saat mode 1: `keberatan_window()` mengembalikan status tertutup dan `ip_putuskan_keberatan` menolak eksekusi dengan pesan jelas.
- Cabut Live Ranking dari IP: `inspektur_ajukan_live_ranking` dan `inspektur_batalkan_live_ranking` tidak lagi bisa dipanggil peran `inspektur` (tetap tersedia untuk admin), dan komponen `SesiLiveRanking` dilepas dari halaman inspektur.
- Frontend:
  - `src/routes/_authenticated/inspektur-var.tsx`: gate akses memakai helper (RPC) alih-alih `has_role('inspektur_var')`.
  - `src/routes/_authenticated/inspektur.tsx`: saat mode = 1 tampilkan tab "VAR & Perbaikan" (`IpVarKoreksiPerJuri`, `PerbaikanAktifPanel`, `PeninjauanTab`); tab/panel keberatan disembunyikan; panel Live Ranking dihapus.
  - Tab Pengaturan admin: kontrol Select 1/2 inspektur + keterangan bahwa mode 1 mengunci menu Keberatan.
  - Halaman keberatan publik menampilkan pesan "pengajuan keberatan sedang ditutup" saat mode 1.

