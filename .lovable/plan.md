# Batas Kontribusi Catatan Juri Mengikuti Grade Kriteria Induk

Nilai tiap aspek Catatan Juri tidak boleh melebihi grade yang diberikan juri pada kriteria induknya. Jika juri memberi grade lebih tinggi pada aspek catatan, nilainya dipotong ke batas grade induk (clamp) saat perhitungan.

## Pemetaan aspek ke kriteria induk

| Kriteria induk | Aspek Catatan Juri |
|---|---|
| Vokal / Interpretasi | Kesan dari teks bacaan, Penguasaan teks |
| Penghayatan | Emosi, Ekspresi, Kesesuaian Vokal, Intonasi dan Irama |
| Intonasi / Artikulasi | Penggunaan kata dan kalimat sesuai teks bacaan, Sesuai Tanda Baca |
| Penampilan | Keserasian Penampilan, Penguasaan Panggung |

## Aturan perhitungan

Untuk setiap aspek catatan yang diisi:

```text
nilai_efektif_aspek = MIN(grade_aspek, grade_kriteria_induk)
```

Lalu bonus catatan dihitung seperti sekarang, tetapi memakai nilai efektif:

```text
bonus_ratio = rata-rata( lookup_nilai(nilai_efektif_aspek) )   // hanya aspek yang diisi
bonus       = bonus_ratio x bobot Catatan Juri (default 10)
```

Contoh: Interpretasi diberi grade 4. Juri memberi 5 pada "Kesan dari teks bacaan" → aspek itu dihitung sebagai grade 4 (persentase grade 4), bukan 5. Aspek dengan nilai 3 tetap dihitung 3.

Jika kriteria induk belum dinilai, aspek catatan dihitung apa adanya (tanpa pemotongan). Aturan lain (Clear Text, penalti Perhatian, normalisasi, pemetaan skala kategori) tidak berubah.

## Tampilan di form juri

- Pada dialog Catatan Juri, setiap aspek menampilkan label batas, mis. "Maks. dihitung grade 4 (Penghayatan)".
- Grade di atas batas tetap bisa dipilih, tetapi ditandai (warna redup + keterangan "dihitung sebagai grade 4").
- Ringkasan kecil di bawah daftar aspek menampilkan bonus catatan hasil hitungan setelah pemotongan.

## Catatan teknis

- Migrasi memperbarui `public.hitung_nilai_juri`: saat menjumlahkan `bonus_ratio`, ambil grade kriteria induk dari baris `penilaian` juri yang sama, cocokkan aspek ke induk lewat tabel pemetaan konstan di dalam fungsi (berdasarkan indeks/nama aspek), lalu pakai `LEAST(grade_aspek, grade_induk)` sebelum `lookup_nilai`.
- Pencocokan kriteria induk memakai logika nama yang sama dengan `kriteriaKey` di frontend (mengandung "interpretasi/vokal", "hayat", "artikulasi/intonasi", "penampilan").
- Nilai tersimpan di `penilaian.detail` tidak diubah — pemotongan hanya di perhitungan, sehingga pilihan asli juri tetap terekam untuk audit.
- `penilaian_submission.nilai_cache` disegarkan lewat `refresh_nilai_cache()` setelah migrasi agar nilai lama ikut menyesuaikan.
- Frontend: `src/routes/_authenticated/dashboard.tsx` menambahkan konstanta pemetaan aspek→kriteria dan penandaan batas pada tombol grade aspek catatan.
