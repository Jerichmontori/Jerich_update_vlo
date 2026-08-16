# Pedoman Pita Nilai 81,000–83,000 — catatan acuan (tanpa perubahan kode)

Status: **tidak ada perubahan kode**. Isi gambar dicatat sebagai aturan acuan untuk pekerjaan berikutnya. Berlaku untuk semua peserta.

## Isi pedoman (verbatim dari gambar)

RANGE NILAI: 81,000–83,000
NILAI TENGAH 81,099 (TIDAK clear text)

- 81,301–500 (clear text tapi interpretasi, artikulasi, intonasi masih biasa)
- 81,501–700 (clear text, lain-lain baik tapi interpretasi kurang tepat)
- 81,701–800 (clear text, interpretasi baik, artikulasi biasa, gestur kurang, monoton, tidak ada dinamika, irama cenderung sama)
- 81,801–900 (clear text, interpretasi baik, penghayatan baik, artikulasi baik, intonasi irama masih monoton, kurang gestur/ekspresi/mimik)
- 81,901–990 (clear text, interpretasi baik, penghayatan baik, intonasi irama baik, vokal belum maksimal/terganggu, gestur/ekspresi/mimik baik, irama & dinamika kurang variatif)
- 81,991–999 (memenuhi semua kriteria, tinggal 1,2,3,4 dst dibedakan dari rasa/kesan yang tersampaikan ke juri)

## Perbedaan dengan sistem penilaian sekarang

| Aspek | Pedoman gambar | Sistem aktif (`hitung_nilai_juri`) |
|---|---|---|
| Rentang | tetap 81,000–83,000 untuk semua peserta | per kategori dari tabel `kategori` (P/KB: 81–82,999, tengah 82, standar 82,199) |
| Tidak clear text | satu angka tetap 81,099 | `bawah + bonus_ratio×(standar−bawah) − penalti`, dibatasi ≤ standar (bisa 81–82,199) |
| Clear text | pita diskrit 81,301–999 berbasis kualitatif | kurva kontinu `standar + n×(atas−standar)` = 82,199–82,999 |
| Penentu posisi | juri memilih pita lewat urutan pembeda hierarkis | rumus rasio×bobot, dinormalisasi, kurva pangkat 1,15 |
| Sifat keluaran | diskrit (kotak pita) | kontinu (3 desimal + jitter anti-seri) |
| Lantai clear text | 81,301 | 82,199 |

Inti: gambar = rubrik manual berbasis pita kualitatif; sistem sekarang = rumus otomatis kontinu. Keduanya menghasilkan angka yang berbeda untuk clear-text maupun tidak-clear-text.

## Yang TIDAK dikerjakan sekarang
- Tidak ada migrasi database.
- Tidak ada perubahan `hitung_nilai_juri`.
- Tidak ada perubahan frontend.

## Jika nanti disetujui untuk diterapkan, langkah lanjutan
1. Menyesuaikan `hitung_nilai_juri` agar peserta tidak-clear-text ditahan di 81,099 dan peserta clear-text dipetakan ke pita 81,301–999 sesuai urutan pembeda (interpretasi → penghayatan/artikulasi → intonasi & dinamika → gestur/mimik → vokal → kesan akhir).
2. Atau, sebagai alternatif ringan, menampilkan tabel pedoman ini di form juri sebagai panduan pemberian grade tanpa mengubah rumus.
