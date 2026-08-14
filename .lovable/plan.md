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

### Contoh

Interpretasi grade 4 (rasio induk 0,81), aspek "Kesan dari teks bacaan" grade 5 (rasio 1,00):
kontribusi = 1,00 x 0,81 x 1,75 = **1,4175**

Penampilan grade 3 (rasio 0,52), aspek "Penguasaan Panggung" grade 4 (rasio 0,81):
kontribusi = 0,81 x 0,52 x 0,50 = **0,2106**

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
