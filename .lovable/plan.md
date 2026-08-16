# Saklar Pita Nilai per Kategori

Admin dapat memilih, untuk tiap kategori, apakah perhitungan nilai memakai **pita nilai** atau **rumus lama**.

## Cara kerja

- Di tab **Pita Nilai** (halaman Pengaturan Admin) ditambahkan satu saklar: **"Gunakan pita nilai untuk kategori ini"**.
- Saklar **aktif** → nilai juri dipetakan ke pita yang sudah diatur (perilaku sekarang).
- Saklar **nonaktif** → nilai dihitung dengan rumus lama, yaitu interpolasi memakai `batas_bawah`, `nilai_standart`, dan `batas_atas` kategori:
  - Tidak clear text: `batas_bawah + n × (nilai_standart − batas_bawah)`
  - Clear text: `nilai_standart + n × (batas_atas − nilai_standart)`
- Daftar pita tetap tersimpan saat saklar dimatikan, jadi bisa dihidupkan lagi kapan saja tanpa mengisi ulang.
- Saat saklar mati, tabel pita di tab admin tetap bisa diedit tetapi diberi keterangan "tidak sedang dipakai", dan panel panduan pita di form juri disembunyikan.
- Setelah mengubah saklar, admin menekan **Hitung Ulang Nilai** agar nilai yang sudah ada menyesuaikan.

## Catatan teknis

- Kolom baru `public.kategori.gunakan_pita boolean not null default true` (default true agar kategori yang sudah punya pita tidak berubah perilakunya).
- `hitung_nilai_juri` memeriksa `gunakan_pita` sebelum mencari pita; bila false, langsung memakai jalur rumus lama yang sudah ada sebagai fallback.
- `get_pita_nilai(_kategori)` mengembalikan tambahan penanda status pemakaian, dan RPC baru `admin_set_gunakan_pita(_kategori text, _on boolean)` (SECURITY DEFINER, cek `has_role(auth.uid(),'admin')`, EXECUTE hanya untuk `authenticated`).
- Frontend: saklar + label status di `src/components/PitaNilaiTab.tsx`; `src/components/PitaNilaiPanduan.tsx` tidak menampilkan apa-apa saat kategori tidak memakai pita.
