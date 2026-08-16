# Keterangan Pita Nilai yang Lebih Menggambarkan Penilaian Peserta

Tujuan: setiap pita punya label singkat + deskripsi yang jelas menggambarkan mutu penampilan peserta, sehingga juri langsung paham "nilai segini artinya penampilan seperti apa".

Kategori yang ada saat ini: P/KB (1 pita non-clear text, 6 pita clear text).

## Usulan keterangan baru

### Tidak clear text — 81,099 s/d 81,999
- Label: Tidak clear text
- Deskripsi: Terdapat kesalahan teks (salah kata, menambah, mengurangi, atau mengulang kata). Penilaian mutu lain (vokal, penghayatan, intonasi, penampilan) tetap dihitung, namun posisi nilai peserta dibatasi pada rentang ini. Posisi di dalam rentang menunjukkan seberapa baik aspek non-teks peserta.

### Clear text — 6 pita

1. Clear text — dasar (82,301–82,500)
   Teks dibawakan benar seluruhnya, namun interpretasi, artikulasi, dan intonasi masih pada taraf biasa. Penampilan aman tetapi belum menonjol; pesan mazmur belum terasa hidup.

2. Interpretasi kurang tepat (82,501–82,600)
   Teks benar dan aspek teknis lain sudah baik, tetapi pemahaman/penafsiran isi mazmur belum tepat sehingga penekanan kalimat tidak sesuai maksud teks.

3. Interpretasi baik, artikulasi biasa (82,601–82,700)
   Isi mazmur dipahami dan disampaikan dengan tepat, namun artikulasi masih biasa, gestur minim, serta irama dan dinamika cenderung datar/monoton.

4. Interpretasi & penghayatan baik (82,701–82,800)
   Isi dipahami dan dihayati dengan baik, artikulasi jelas; kekurangan tinggal pada irama yang masih monoton serta gestur, ekspresi, dan mimik yang belum mendukung.

5. Vokal belum maksimal (82,801–82,900)
   Interpretasi, penghayatan, intonasi, gestur, ekspresi, dan mimik sudah baik; hanya kualitas vokal yang belum maksimal atau terganggu, dan variasi irama/dinamika masih kurang.

6. Memenuhi semua kriteria (82,901–82,999)
   Seluruh kriteria terpenuhi dengan baik: teks benar, interpretasi dan penghayatan tepat, vokal dan intonasi prima, gestur serta ekspresi mendukung. Pembeda antar peserta tinggal rasa/kesan yang tersampaikan kepada juri.

## Teknis

- Update kolom `deskripsi` (dan label bila perlu) pada tabel `public.pita_nilai` untuk kategori P/KB melalui operasi data — tanpa perubahan skema, rumus, atau batas nilai.
- Batas bawah/atas, urutan, dan flag `aktif` tidak diubah, sehingga hasil perhitungan nilai tetap sama persis.
- Deskripsi baru otomatis tampil di tab Pita Nilai (admin) dan di panel panduan pita untuk juri, karena keduanya membaca langsung dari tabel.
