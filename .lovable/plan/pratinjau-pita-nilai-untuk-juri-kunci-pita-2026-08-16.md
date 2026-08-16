# Pratinjau Pita Nilai untuk Juri + Kunci Pita

Tujuan: setelah juri mengisi 4 kriteria induk, juri langsung diberi tahu peserta akan jatuh di pita mana; lalu pengisian catatan juri hanya menggeser nilai **di dalam** pita itu, tidak pernah melompat ke pita lain.

## Keadaan sekarang (sudah diperiksa)

Di `hitung_nilai_juri`, pemilihan pita memakai skor normalisasi `n` yang **sudah termasuk bonus catatan juri**:

```text
raw     = skor_4_kriteria + bonus_catatan
n       = raw / (bobot_4_kriteria + bobot_catatan)
band_idx = floor(n × jumlah_pita)     -- pita terpilih
band_frac = n × jumlah_pita − band_idx -- posisi di dalam pita
```

Karena bonus catatan ikut menaikkan `n`, tambahan catatan bisa mendorong hasil melewati batas pita — persis yang ingin dihindari.

## Perubahan yang diusulkan

1. **Pita ditentukan hanya oleh 4 kriteria induk.**
   - `n_inti = skor_4_kriteria / bobot_4_kriteria` → dipakai untuk `band_idx`.
   - Selama grade 4 kriteria tidak diubah, pita tidak akan berpindah.

2. **Catatan juri hanya menentukan posisi di dalam pita.**
   - Posisi dalam pita = campuran sisa `n_inti` di irisannya dan rasio catatan juri, keduanya sudah pasti berada pada rentang 0–1, lalu dipotong ke `batas_bawah`–`batas_atas` pita.
   - Efeknya tetap seperti sekarang: catatan memecah nilai kembar, tapi tidak bisa keluar pita.

3. **Hanya berlaku saat pita dinyalakan** (`kategori.gunakan_pita`). Kategori yang memakai rumus lama (interpolasi kontinu) tidak berubah sama sekali.

4. **Pratinjau pita di form juri.**
   - Fungsi baru `preview_pita_juri(_peserta, _juri)` yang mengembalikan label pita, rentang nilai, deskripsi, dan status clear text berdasarkan 4 kriteria yang sudah diisi (tanpa menyimpan apa pun).
   - Panel kecil di form penilaian juri: "Perkiraan pita: Clear text – interpretasi baik, artikulasi biasa (82,601–82,700)" dengan catatan "catatan juri hanya menggeser nilai di dalam pita ini".
   - Panel ikut memperbarui saat status clear text berubah (karena clear/non-clear memakai daftar pita berbeda).

## Yang tidak berubah

- Bobot kriteria, tabel rasio grade, tabel `pita_nilai`, aturan clear text otomatis, penalti (tetap nol), dan seluruh alur VAR/perbaikan.

## Detail teknis

- Migration: `CREATE OR REPLACE FUNCTION public.hitung_nilai_juri` — pisahkan `n_inti` (skor/used_weight) untuk `band_idx`, dan `band_frac` dari kombinasi sisa irisan + `bonus_ratio`; hasil tetap di-clamp ke `band_lo`/`band_hi`. Cabang non-pita (baris 218 ke bawah) dibiarkan apa adanya.
- Migration: fungsi baru `public.preview_pita_juri(uuid, uuid)` `SECURITY DEFINER`, `SET search_path = public`, memakai logika `n_inti` yang sama, `GRANT EXECUTE` ke `authenticated` saja.
- Frontend: panel pratinjau di form penilaian juri (`src/routes/_authenticated/dashboard.tsx`), memanggil RPC setelah 4 kriteria terisi; komponen baru `src/components/PratinjauPita.tsx`. `PitaNilaiPanduan.tsx` tetap dipakai sebagai referensi lengkap.
