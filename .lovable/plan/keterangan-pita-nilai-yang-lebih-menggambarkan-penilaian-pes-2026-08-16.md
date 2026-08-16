# Keterangan Pita Nilai yang Lebih Menggambarkan Penilaian Peserta

Tujuan: setiap pita punya label singkat + deskripsi yang jelas menggambarkan mutu penampilan peserta, sehingga juri langsung paham "nilai segini artinya penampilan seperti apa".

Kategori yang ada saat ini: P/KB (1 pita non-clear text, 6 pita clear text).

## Usulan keterangan baru (tanpa menyebut aspek penilaian)

Keterangan ditulis sebagai kesan menyeluruh atas penampilan peserta, bukan uraian per aspek (vokal, intonasi, artikulasi, gestur, dsb.).

### Tidak clear text — 81,099 s/d 81,999
- Label: Tidak clear text
- Deskripsi: Pembawaan mazmur terganggu karena teks tidak utuh, sehingga pesan yang sampai ke pendengar belum utuh.

### Clear text — 6 pita

1. Clear text — dasar (82,301–82,500)
   Teks dibawakan utuh, namun pesan mazmur belum terasa hidup.

2. Interpretasi kurang tepat (82,501–82,600)
   Pembawaan sudah rapi, tetapi maksud pesan mazmur belum tersampaikan sebagaimana mestinya.

3. Interpretasi baik, artikulasi biasa (82,601–82,700)
   Pesan mazmur mulai tersampaikan, namun pembawaannya masih datar dan belum menyentuh.

4. Interpretasi & penghayatan baik (82,701–82,800)
   Pesan mazmur tersampaikan dengan jelas dan mulai terasa, meski belum sepenuhnya memikat.

5. Vokal belum maksimal (82,801–82,900)
   Pembawaan sudah menyentuh dan meyakinkan, hanya belum tampil dalam kondisi terbaiknya.

6. Memenuhi semua kriteria (82,901–82,999)
   Pesan mazmur hidup dan berkesan kuat; pembeda tinggal rasa yang tertinggal pada pendengar.


## Teknis

- Update kolom `deskripsi` (dan label bila perlu) pada tabel `public.pita_nilai` untuk kategori P/KB melalui operasi data — tanpa perubahan skema, rumus, atau batas nilai.
- Batas bawah/atas, urutan, dan flag `aktif` tidak diubah, sehingga hasil perhitungan nilai tetap sama persis.
- Deskripsi baru otomatis tampil di tab Pita Nilai (admin) dan di panel panduan pita untuk juri, karena keduanya membaca langsung dari tabel.
