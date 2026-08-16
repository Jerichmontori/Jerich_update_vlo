# Keterangan Pita Nilai: tambah acuan grade

Tujuan: juri bisa langsung tahu "kalau saya memberi grade sekian, nilai akhir peserta jatuh di pita mana".

## Masalah saat ini

Keterangan tiap pita hanya berisi deskripsi kualitatif (mis. "Clear text, interpretasi baik, artikulasi biasa"). Tidak ada petunjuk angka grade, padahal pemilihan pita dihitung dari skor normalisasi `n` yang dipotong menjadi 6 irisan sama lebar (`floor(n × 6)`), sedangkan rasio grade tidak linier (1 = 0,050; 2 = 0,220; 3 = 0,360; 4 = 0,680; 4,5 = 0,910; 5 = 1,000). Akibatnya grade 2 terlihat "rendah" tapi mendarat di pita ke-2, dan pita ke-3 hampir tidak pernah tercapai — juri tidak punya acuan.

## Yang akan dikerjakan

1. **Perbaiki teks keterangan tiap pita** (data `pita_nilai` kategori P/KB) sehingga tiap deskripsi diawali acuan grade rata-rata yang menghasilkan pita tersebut, lalu deskripsi kualitatif yang sudah ada. Contoh format:
   - Pita 1 — "Grade rata-rata ±1 (n 0,000–0,167). Clear text tapi interpretasi, artikulasi, intonasi masih biasa."
   - Pita 2 — "Grade rata-rata ±2–3 (n 0,167–0,333). ..."
   - dan seterusnya sampai pita 6 ("Grade rata-rata ±5").
   - Pita "Tidak clear text" — jelaskan bahwa semua grade jatuh di satu pita 81,099–81,999, posisi di dalamnya bergerak naik sesuai grade dan catatan juri.

2. **Panduan Pita Nilai (dilihat juri)** — tiap baris pita menampilkan chip tambahan "Grade ±X" di samping rentang nilai, plus satu kalimat pengantar cara membacanya.

3. **Skema Pita Nilai (tab admin)** — tabel simulasi diberi kolom "pita yang dicapai" per grade 1–5 supaya konsistensi antara keterangan dan hasil hitung bisa dicek sekali lihat.

Tidak ada perubahan rumus perhitungan — hanya keterangan dan tampilan.

## Detail teknis

- Migration `UPDATE public.pita_nilai SET deskripsi = ... WHERE kategori = 'P/KB' AND urutan = ...` untuk 7 baris (1 non-clear + 6 clear).
- Ambang tiap pita dihitung dari `n_min = urutan_index / 6`, `n_max = (urutan_index + 1) / 6`; grade acuan diperoleh dengan membandingkan `lookup_nilai(grade) × 100 / 110` terhadap rentang tersebut.
- `src/components/PitaNilaiPanduan.tsx`: tambahkan badge grade acuan (dihitung di klien dari tabel rasio yang sama) dan kalimat pengantar.
- `src/components/SkemaPitaNilai.tsx`: tambahkan kolom pita hasil per grade pada tabel simulasi clear text dan non-clear text.
