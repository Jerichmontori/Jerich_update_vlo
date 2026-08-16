# Pita Nilai Clear Text / Tidak Clear Text yang Bisa Diatur Sendiri

Jawaban singkat: **bisa**. Sekarang batas-batas itu masih tertanam di rumus database, jadi hanya bisa diubah lewat perubahan kode. Rencana ini memindahkannya ke pengaturan yang dapat diedit Admin dari halaman Pengaturan.

## Keadaan sekarang (sudah diverifikasi)

- Tabel `kategori` menyimpan `batas_bawah`, `nilai_tengah`, `batas_atas`, `nilai_standart`. Saat ini hanya ada satu baris: **P/KB → 81 / 82 / 82,999 / 82,199**.
- Fungsi `hitung_nilai_juri` memakai angka-angka itu, tetapi cara pemetaannya tetap (hard-coded):
  - **Tidak clear text**: `batas_bawah + bonus × (nilai_standart − batas_bawah)`, dikurangi penalti, dibatasi maksimal `nilai_standart`.
  - **Clear text**: `nilai_standart + n × (batas_atas − nilai_standart)`.
- Tidak ada pita bertingkat (81,301–500, 81,501–700, dst.) seperti pedoman pada gambar, dan lantai clear text tidak bisa diatur terpisah.

## Yang akan dibuat

### 1. Pengaturan pita per kategori
Tabel baru `public.pita_nilai` berisi, untuk tiap kategori:
- nama pita (mis. "Tidak clear text", "Clear text — dasar", dst.)
- apakah pita berlaku untuk clear text atau tidak clear text
- batas bawah dan batas atas pita
- urutan tampil dan deskripsi kriteria kualitatif
- saklar aktif/nonaktif

Admin bisa menambah, mengubah, menghapus, dan mengurutkan pita. Nilai awal diisi sesuai pedoman gambar (tidak clear text 81,099; clear text 81,301–500, 501–700, 701–800, 801–900, 901–990, 991–999).

### 2. Rumus mengikuti pengaturan
`hitung_nilai_juri` diubah agar:
- Menentukan status clear text seperti sekarang.
- Mengambil daftar pita aktif untuk kategori peserta tersebut.
- Memetakan hasil normalisasi `n` (0–1) ke deretan pita yang sesuai statusnya, secara berurutan — nilai jatuh di dalam pita yang cocok, lalu diinterpolasi di dalam batas pita itu.
- Untuk pita "tidak clear text" yang batas bawah dan atasnya sama (mis. 81,099–81,099), hasilnya jadi satu angka tetap.
- Jika kategori belum punya pita sama sekali, rumus tetap memakai perilaku lama, sehingga tidak ada yang rusak.

Penalti perhatian dan jitter anti-seri tetap berlaku, tetap dijaga di dalam batas pita.

### 3. Halaman pengaturan Admin
Tambahan tab **Pita Nilai** pada halaman pengaturan Admin:
- Pilih kategori, lihat daftar pita dalam bentuk tabel yang bisa diedit langsung.
- Tambah/hapus baris pita, atur batas bawah–atas, label, dan deskripsi.
- Validasi: batas bawah ≤ batas atas, pita tidak boleh saling tumpang tindih dalam satu status, dan seluruh pita harus berada di dalam `batas_bawah`–`batas_atas` kategori.
- Tombol "Hitung ulang nilai" untuk menyegarkan cache setelah pengaturan diubah.

### 4. Tampilan pedoman untuk juri
Pita beserta deskripsi kualitatifnya ditampilkan sebagai panduan baca-saja di form penilaian juri, supaya juri tahu pita mana yang sedang dituju.

## Catatan teknis

- Migrasi: buat `public.pita_nilai` (id, kategori, clear_text boolean, label, batas_bawah numeric, batas_atas numeric, urutan int, deskripsi text, aktif boolean, timestamps), lengkap dengan GRANT, RLS (baca: authenticated; tulis: admin saja lewat `has_role`), dan trigger `set_updated_at`.
- RPC baru `admin_set_pita_nilai(_kategori text, _pita jsonb)` dan `get_pita_nilai(_kategori text)`, keduanya SECURITY DEFINER dengan `search_path` tetap; EXECUTE hanya untuk `authenticated` (dan admin diperiksa di dalam fungsi).
- `hitung_nilai_juri` dimodifikasi, lalu `refresh_nilai_cache()` dijalankan agar semua nilai lama ikut menyesuaikan.
- Frontend: komponen pengaturan pita di halaman admin, dan panel panduan baca-saja di dashboard juri.
