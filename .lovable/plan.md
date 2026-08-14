# Kontribusi Catatan Juri Diskala oleh Grade Kriteria Induk

Kontribusi tiap aspek Catatan Juri dihitung sebagai rasio grade aspek dikali rasio grade kriteria induknya dikali bobot aspek, sehingga catatan selalu proporsional terhadap penilaian utama juri.

## Pemetaan aspek ke kriteria induk

| Kriteria induk | Aspek Catatan Juri |
|---|---|
| Vokal / Interpretasi | Kesan dari teks bacaan, Penguasaan teks |
| Penghayatan | Emosi, Ekspresi, Kesesuaian Vokal, Intonasi dan Irama |
| Intonasi / Artikulasi | Penggunaan kata dan kalimat sesuai teks bacaan, Sesuai Tanda Baca |
| Penampilan | Keserasian Penampilan, Penguasaan Panggung |

## Aturan perhitungan

Setiap aspek catatan punya porsi bobot sendiri, yaitu bobot Catatan Juri dibagi rata ke aspek yang diisi:

```text
bobot_aspek = bobot Catatan Juri (default 10) / jumlah aspek yang diisi
```

Rasio tiap aspek dikalikan rasio grade kriteria induknya:

```text
rasio_efektif = lookup_nilai(grade_aspek) x lookup_nilai(grade_induk)
kontribusi    = rasio_efektif x bobot_aspek
bonus catatan = jumlah seluruh kontribusi aspek
```

Contoh: Interpretasi diberi grade 4 → rasio induk 0,81. Juri memberi 5 pada "Kesan dari teks bacaan" (rasio 1,00) → rasio efektif 1,00 x 0,81 = 0,81, kontribusi = 0,81 x bobot aspek. Bila juri memberi 3 (rasio 0,52) → rasio efektif 0,52 x 0,81 = 0,4212.

Jika kriteria induk belum dinilai, aspek catatan dihitung apa adanya (pengali induk = 1). Aturan lain (Clear Text, penalti Perhatian, normalisasi, pemetaan skala kategori) tidak berubah. Konsekuensi: bonus catatan kini selalu lebih kecil dari rumus lama kecuali induk bergrade 5, dan nilai lama akan bergeser turun setelah penyegaran cache.


## Tampilan di form juri

- Pada dialog Catatan Juri, setiap aspek menampilkan pengali induk, mis. "x0,81 (Penghayatan grade 4)".
- Semua grade tetap bisa dipilih; di bawah pilihan ditampilkan rasio efektif hasil perkalian.
- Ringkasan kecil di bawah daftar aspek menampilkan bobot per aspek dan total bonus catatan setelah penskalaan.

## Catatan teknis

- Migrasi memperbarui `public.hitung_nilai_juri`: saat menjumlahkan bonus, ambil grade kriteria induk dari baris `penilaian` juri yang sama, cocokkan aspek ke induk lewat pemetaan konstan di dalam fungsi, lalu pakai `lookup_nilai(grade_aspek) * COALESCE(lookup_nilai(grade_induk), 1)` sebagai rasio efektif sebelum dikali bobot aspek.

- Pencocokan kriteria induk memakai logika nama yang sama dengan `kriteriaKey` di frontend (mengandung "interpretasi/vokal", "hayat", "artikulasi/intonasi", "penampilan").
- Nilai tersimpan di `penilaian.detail` tidak diubah — pemotongan hanya di perhitungan, sehingga pilihan asli juri tetap terekam untuk audit.
- `penilaian_submission.nilai_cache` disegarkan lewat `refresh_nilai_cache()` setelah migrasi agar nilai lama ikut menyesuaikan.
- Frontend: `src/routes/_authenticated/dashboard.tsx` menambahkan konstanta pemetaan aspek→kriteria dan penandaan batas pada tombol grade aspek catatan.
