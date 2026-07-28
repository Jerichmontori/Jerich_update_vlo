## Ringkasan

Membangun engine perhitungan **Nilai Akhir 3 desimal** menggunakan lookup table non-linear untuk 4 kriteria utama, ditambah bonus dari Catatan Juri (10 pertanyaan) dan penalty dari Perhatian (11 pertanyaan). Nilai akhir dinormalisasi ke rentang `batas_bawah — nilai_tengah — batas_atas` dari tabel `kategori` berdasarkan kategori peserta.

## Aturan Perhitungan

### 1. Lookup Table Non-Linear (pilihan 1–9)
Kurva S ringan agar rendah naik pelan, tengah pembeda besar, tinggi naik kecil:

```text
pilihan  1     2     3     4     5     6     7     8     9
bobot   0.050 0.120 0.220 0.360 0.520 0.680 0.810 0.910 1.000
```

### 2. Raw Score per Juri
```
skor_kriteria = Σ (lookup(pilihan_i) × bobot_kriteria_i)   // 4 kriteria utama
bonus         = Σ lookup_catatan(1..5) × bobot_kriteria_Catatan  (10 aspek, tiap aspek 1-5)
penalty       = Σ (jumlah_tanda_perhatian) × bobot_kriteria_Perhatian  (11 aspek, sudah negatif)
raw = skor_kriteria + bonus + penalty
```
`bobot_kriteria_*` diambil dari kolom `bobot` di tabel `kriteria`.

### 3. Clamp & Normalisasi ke Rentang Kategori
- Ambil `batas_bawah`, `nilai_tengah`, `batas_atas` dari `kategori` sesuai `peserta.kategori`
- Clamp `raw` ke `[raw_min, raw_max]` (batas raw teoritis)
- Peta ke rentang akhir dengan **kurva 2-segmen** (tengah sebagai anchor):
  - jika normalized ≤ 0.5 → interpolasi (batas_bawah → nilai_tengah) dengan easing `t^1.15`
  - jika > 0.5 → interpolasi (nilai_tengah → batas_atas) dengan easing `1-(1-t)^1.15`
- Tambahkan **jitter deterministik ±0.0009** dari `hash(peserta_id + juri_id)` untuk meminimalkan tabrakan
- Clamp final ke `[batas_bawah, batas_atas]`
- Presisi 6 desimal dalam proses, round **3 desimal** di akhir

### 4. Nilai Akhir Peserta
Rata-rata nilai akhir dari semua juri yang sudah submit (via `penilaian_submission`), kembali round 3 desimal, tetap dalam rentang.

## Perubahan Database (1 migrasi)

- Function `public.lookup_nilai(_pilihan int) returns numeric` — tabel di atas
- Function `public.hitung_nilai_juri(_peserta uuid, _juri uuid) returns numeric`
- Function `public.hitung_nilai_akhir(_peserta uuid) returns numeric` — rata-rata juri
- Update `public.get_ranking()` — tambah kolom `nilai_akhir numeric` (3 desimal) dan sort berdasarkan itu
- GRANT EXECUTE ke `authenticated`

## Perubahan Frontend

- `src/routes/ranking.tsx` & `src/routes/posisi.tsx`: tampilkan kolom **Nilai Akhir** dengan `.toFixed(3)`, sort by `nilai_akhir`
- `src/routes/_authenticated/inspektur.tsx`: tampilkan Nilai Akhir per juri + rata-rata dengan 3 desimal
- `src/routes/_authenticated/dashboard.tsx` (tab Lihat Penilaian / Rincian Nilai): tambah kolom Nilai Akhir 3 desimal; PDF ikut memuat

Tidak ada perubahan alur input penilaian, VAR, atau operator.

## Catatan Teknis

- Semua perhitungan di SQL (`numeric` 6 desimal) → konsisten antara ranking, detail, dan PDF
- Jitter deterministik pakai `hashtext()` Postgres untuk reprodusibilitas
- Jika kategori peserta tidak punya baris di tabel `kategori`, fallback ke rentang 0–100
