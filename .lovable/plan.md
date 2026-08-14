# Bobot Aspek Catatan Juri Mengikuti Bobot Kriteria Induk

## Kondisi saat ini

Bobot Catatan Juri (10) dibagi **rata** ke aspek yang diisi. Contoh: 5 aspek terisi → 2,0 poin per aspek, tanpa memandang aspek itu milik Interpretasi (bobot 35) atau Penampilan (bobot 10). Rasio induk sudah dipakai sebagai pengali, tetapi bobotnya belum.

Bobot kriteria aktif: Interpretasi 35, Penghayatan 30, Artikulasi 25, Penampilan 10, Catatan Juri 10, Perhatian -10.

## Rumus baru (bobot tetap per aspek)

```text
bobot_aspek = (bobot_induk / bobot_catatan_juri) / jumlah aspek dalam induk itu
kontribusi  = rasio(grade aspek) x rasio(grade kriteria induk) x bobot_aspek
bonus       = jumlah kontribusi seluruh aspek yang diisi
```

Bobot tiap aspek tetap, tidak berubah walau juri hanya mengisi sebagian aspek.

| Kriteria induk | Bobot induk | Jumlah aspek | Bobot per aspek |
|---|---|---|---|
| Interpretasi / Vokal | 35 | 2 | (35/10)/2 = 1,75 |
| Penghayatan | 30 | 4 | (30/10)/4 = 0,75 |
| Artikulasi / Intonasi | 25 | 2 | (25/10)/2 = 1,25 |
| Penampilan | 10 | 2 | (10/10)/2 = 0,50 |

Total bobot bila semua 10 aspek diisi = 10, tepat sama dengan bobot Catatan Juri.

### Contoh singkat

Interpretasi grade 4 (rasio induk 0,81), aspek "Kesan dari teks bacaan" grade 5 (rasio 1,00):
kontribusi = 1,00 x 0,81 x 1,75 = **1,4175**

Penampilan grade 3 (rasio 0,52), aspek "Penguasaan Panggung" grade 4 (rasio 0,81):
kontribusi = 0,81 x 0,52 x 0,50 = **0,2106**

## Contoh perhitungan lengkap (satu juri, satu peserta)

Rasio grade: 1 = 0,05 · 2 = 0,22 · 3 = 0,52 · 4 = 0,81 · 5 = 1,00
Peserta kategori P/KB: batas bawah 81 · nilai tengah 82 · batas atas 82,999 · nilai standar 82,199

**Langkah 1 — Nilai kriteria utama**

| Kriteria | Grade | Rasio | Bobot | Kontribusi |
|---|---|---|---|---|
| Interpretasi | 4 | 0,81 | 35 | 28,350 |
| Penghayatan | 3 | 0,52 | 30 | 15,600 |
| Artikulasi | 4 | 0,81 | 25 | 20,250 |
| Penampilan | 3 | 0,52 | 10 | 5,200 |

Skor = **69,400** · bobot terpakai = 100

**Langkah 2 — Bonus Catatan Juri (rumus baru)**

| Aspek | Grade aspek | Rasio aspek | Induk (rasio) | Bobot aspek | Kontribusi |
|---|---|---|---|---|---|
| Kesan dari teks bacaan | 5 | 1,00 | Interpretasi (0,81) | 1,75 | 1,4175 |
| Emosi | 4 | 0,81 | Penghayatan (0,52) | 0,75 | 0,3159 |
| Sesuai Tanda Baca | 3 | 0,52 | Artikulasi (0,81) | 1,25 | 0,5265 |
| Penguasaan Panggung | 4 | 0,81 | Penampilan (0,52) | 0,50 | 0,2106 |

Bonus catatan = **2,4705** (dari maksimum 10)

**Langkah 3 — Penalti Perhatian**

2 tanda pelanggaran → 2/15 = 0,1333 → 0,1333 x (-10) = **-1,3333**

**Langkah 4 — Nilai mentah dan normalisasi**

```text
raw     = 69,400 + 2,4705 - 1,3333 = 70,5372
raw_max = 100 + 10 = 110
raw_min = -10
n       = (70,5372 + 10) / (110 + 10) = 0,6711
```

**Langkah 5 — Pemetaan ke skala kategori**

n > 0,5 → `t = 1 - ((1 - n) x 2)^1,15 = 1 - 0,6577^1,15 = 0,3824`
Nilai = 82 + (82,999 - 82) x 0,3824 = **82,382** (sebelum jitter anti-seri ±0,0009)

**Variasi jalur khusus (angka yang sama)**
- Clear Text = Ya → nilai = 82,199 + 0,6711 x (82,999 - 82,199) = **82,736**
- Clear Text = Tidak → basis = 81 + 0,24705 x (82,199 - 81) = 81,296; setelah penalti = **81,257** (dibatasi maksimal 82,199)
- Peserta berstatus VAR → nilai = 82,999 - (82,999 - 82,199) x 0,1333 = **82,892**

Catatan: `bonus_ratio` yang dipakai jalur Clear Text = Tidak menjadi bonus poin dibagi bobot Catatan Juri (2,4705 / 10 = 0,24705), agar rumus lain tetap konsisten.


## Cakupan pekerjaan

**Database**
- Perbarui `public.hitung_nilai_juri`: hapus rata-rata `bonus_ratio / bonus_n`; hitung bobot tiap aspek dengan rumus di atas memakai bobot kriteria induk dari tabel `kriteria` dan jumlah aspek tetap per induk (2/4/2/2), lalu jumlahkan kontribusinya.
- Aspek yang kriteria induknya belum dinilai tetap memakai pengali induk 1.
- Jalankan `refresh_nilai_cache()` agar nilai tersimpan ikut menyesuaikan.

**Form juri (`src/routes/_authenticated/dashboard.tsx`)**
- Ganti `bobotAspek = bobotCat / terisi` dengan bobot tetap per aspek sesuai induk.
- Tiap kartu aspek menampilkan: bobot induk, bobot aspek, pengali induk, dan kontribusi poin.
- Ringkasan bawah dialog menampilkan total bonus dan bobot maksimum yang tersedia.

**Rincian perhitungan / ekspor PDF**
- Samakan bagian rincian catatan juri agar angka di layar, PDF, dan database identik.
