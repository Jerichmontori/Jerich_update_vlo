# Menetapkan Pilihan Grade "Biasa" dan "Baik" agar Sesuai Pita Nilai

Tujuan: menyamakan bahasa penilaian juri (grade 1–5) dengan deskripsi pita nilai yang memakai kata "biasa", "baik", "kurang", supaya nilai akhir jatuh di pita yang memang dimaksud.

## Keadaan sekarang (sudah diverifikasi)

- Kriteria induk beserta bobotnya: Interpretasi 35, Penghayatan 30, Artikulasi 25, Penampilan 10, Catatan Juri 10, Perhatian -10.
- Grade diubah jadi rasio lewat `lookup_nilai`, langkah 0,5: 1→0,050 · 1,5→0,120 · 2→0,220 · 2,5→0,360 · 3→0,520 · 3,5→0,680 · 4→0,810 · 4,5→0,910 · 5→1,000.
- Pita kategori P/KB sudah terisi: tidak clear text 81,099–81,999; clear text 6 pita mulai 81,301–81,500 ("interpretasi, artikulasi, intonasi masih biasa") sampai 82,901–82,999 ("memenuhi semua kriteria").
- Deskripsi pita memakai istilah kualitatif ("biasa", "baik", "kurang"), tetapi tidak ada aturan yang menghubungkan istilah itu ke angka grade — juri menebak sendiri.

## Yang akan dibuat

### 1. Kamus grade kualitatif (baku, satu untuk semua kriteria)

| Grade | Sebutan | Makna singkat |
|---|---|---|
| 1 – 1,5 | Kurang | Banyak kesalahan mendasar |
| 2 – 2,5 | Cukup | Terpenuhi seadanya, belum stabil |
| 3 – 3,5 | **Biasa** | Benar dan wajar, tanpa kelebihan |
| 4 – 4,5 | **Baik** | Terkendali, ekspresif, konsisten |
| 5 | Sangat baik | Nyaris tanpa cela |

Kamus ini disimpan sebagai pengaturan (bukan hard-code) supaya Admin bisa mengubah ambang "biasa" dan "baik" bila pedoman lomba berubah.

### 2. Syarat grade per pita

Tiap pita clear text diberi syarat minimum grade per kriteria induk, mengikuti deskripsi yang sudah ada. Nilai awal yang diusulkan:

| Pita | Interpretasi | Penghayatan | Artikulasi | Penampilan |
|---|---|---|---|---|
| Clear text – dasar (81,301–500) | biasa (3) | biasa (3) | biasa (3) | biasa (3) |
| Interpretasi kurang tepat (81,501–700) | biasa (3) | baik (4) | baik (4) | baik (4) |
| Interpretasi baik, artikulasi biasa (81,701–800) | baik (4) | baik (4) | biasa (3) | biasa (3) |
| Interpretasi & penghayatan baik (81,801–900) | baik (4) | baik (4) | baik (4) | biasa (3) |
| Vokal belum maksimal (81,901–990) | baik (4) | baik (4) | baik (4) | baik (4) |
| Memenuhi semua kriteria (82,901–999) | sangat baik (5) | baik (4,5) | baik (4,5) | baik (4,5) |

Admin dapat mengedit angka-angka ini di tab Pita Nilai.

### 3. Bantuan saat juri menilai

- Di bawah tiap tombol grade muncul sebutannya (Kurang / Cukup / Biasa / Baik / Sangat baik), bukan hanya angka.
- Panel ringkas "Pita yang dituju": setelah keempat grade dipilih, sistem menampilkan pita mana yang akan tercapai berdasarkan syarat di atas, plus pita yang sedang dihitung dari rumus.
- Bila keduanya berbeda, tampil peringatan lembut: "Grade Anda mengarah ke pita X, tetapi perhitungan jatuh di pita Y" — sifatnya informasi, tidak memblokir simpan.

### 4. Tab Pita Nilai (Admin)

- Kolom baru per pita: grade minimum untuk Interpretasi, Penghayatan, Artikulasi, Penampilan.
- Pengaturan ambang kamus grade (biasa = 3, baik = 4) di satu tempat.
- Validasi: syarat pita yang urutannya lebih tinggi tidak boleh lebih longgar dari pita di bawahnya.

## Catatan teknis

- Tambah kolom `syarat_grade jsonb` pada `public.pita_nilai` (mis. `{"interpretasi":3,"penghayatan":3,"artikulasi":3,"penampilan":3}`), plus baris `system_config` `grade_kamus` untuk ambang sebutan.
- `admin_set_pita_nilai` diperluas menerima `syarat_grade`; `get_pita_nilai` mengembalikannya.
- Fungsi baru `pita_dari_grade(_kategori text, _grades jsonb)` (SECURITY DEFINER, search_path tetap, EXECUTE untuk `authenticated`) mengembalikan pita tertinggi yang syaratnya terpenuhi — dipakai untuk panel indikator juri.
- `hitung_nilai_juri` tidak diubah pada tahap ini: kamus dan syarat bersifat panduan/indikator, sehingga tidak ada nilai lama yang bergeser. Jika nanti diinginkan pita hasil grade menjadi penentu keras, itu perubahan terpisah.
- Frontend: kamus grade di form penilaian juri (`dashboard.tsx`), indikator pita, dan kolom syarat di `PitaNilaiTab.tsx` serta tampilan syarat di `PitaNilaiPanduan.tsx`.
