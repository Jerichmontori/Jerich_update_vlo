# Bobot Aspek Catatan Juri Mengikuti Bobot Kriteria Induk

## Kondisi saat ini

Bobot Catatan Juri (10) dibagi **rata** ke setiap aspek yang diisi. Contoh: 5 aspek terisi → 2,0 poin per aspek, tanpa memandang aspek itu milik Interpretasi (bobot 35) atau Penampilan (bobot 10). Rasio induk sudah dipakai sebagai pengali, tetapi bobotnya belum.

Bobot kriteria aktif: Interpretasi 35, Penghayatan 30, Artikulasi 25, Penampilan 10, Catatan Juri 10, Perhatian -10.

## Perubahan yang diusulkan

Bobot tiap aspek catatan ditentukan proporsional terhadap bobot kriteria induknya, bukan dibagi rata.

```text
bobot_aspek(i) = bobot_catatan x  bobot_induk(i) / SUM bobot_induk(j) untuk semua aspek j yang terisi
kontribusi(i)  = rasio(grade aspek i) x rasio(grade kriteria induk i) x bobot_aspek(i)
bonus_catatan  = SUM kontribusi(i)
```

Total bonus tetap tidak pernah melebihi bobot Catatan Juri (10), dan aspek di bawah kriteria berbobot besar memberi kontribusi lebih besar.

### Contoh

Terisi: "Kesan dari teks bacaan" (induk Interpretasi 35) dan "Keserasian Penampilan" (induk Penampilan 10).
- Total bobot induk terisi = 45
- Bobot aspek 1 = 10 x 35/45 = 7,78 ; bobot aspek 2 = 10 x 10/45 = 2,22
- Jika Interpretasi grade 4 (rasio 0,81) dan aspek 1 grade 5 (1,0): kontribusi = 1,0 x 0,81 x 7,78 = 6,30

## Cakupan pekerjaan

**Database**
- Perbarui `public.hitung_nilai_juri` agar loop aspek catatan menyimpan bobot induk tiap aspek, lalu menghitung bonus dengan pembagian proporsional di atas (menggantikan rata-rata `bonus_ratio / bonus_n`).
- Aspek yang induknya belum dinilai memakai rasio 1 seperti sekarang, dan bobot induknya tetap ikut hitungan proporsi.
- Jalankan `refresh_nilai_cache()` agar nilai tersimpan ikut diperbarui.

**Form juri (`src/routes/_authenticated/dashboard.tsx`)**
- Ganti perhitungan `bobotAspek = bobotCat / terisi` menjadi proporsional terhadap bobot induk.
- Tampilkan pada tiap kartu aspek: bobot induk, bobot aspek hasil proporsi, dan kontribusi poinnya.
- Perbarui ringkasan bawah dialog: daftar bobot per aspek + total bonus.

**Rincian perhitungan / ekspor PDF**
- Sesuaikan bagian rincian catatan juri agar memakai bobot proporsional yang sama sehingga angka di layar, PDF, dan database identik.

## Catatan

Aturan ini membuat bobot per aspek berubah dinamis mengikuti aspek mana saja yang diisi juri. Bila Anda ingin bobot per aspek tetap (misalnya porsi tiap kriteria induk dikunci walau aspeknya tidak diisi), beri tahu — implementasinya sedikit berbeda.
