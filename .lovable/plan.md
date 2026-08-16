# Konsistensi Nilai Pita P/KB

## Temuan terverifikasi

- Batas bawah pita clear text pertama P/KB sudah diturunkan menjadi **82,199**.
- Namun pengaturan kategori P/KB saat ini adalah **`gunakan_pita = false`**, sehingga nilai aktif masih dihitung dengan rumus tanpa pita.
- Walaupun batas bawah sudah sama, hasil kedua mode tetap berbeda karena mekanismenya berbeda:
  - mode pita memilih satu dari enam pita berdasarkan empat kriteria induk, lalu catatan juri menentukan posisi di dalam pita;
  - mode tanpa pita memetakan skor secara kontinu dari nilai standar sampai batas atas kategori.
- Ada pula jitter anti-seri hingga sekitar **±0,0009**, tetapi setelah pembulatan tiga desimal pengaruhnya hanya sekitar **±0,001** dan bukan sumber selisih utama.

## Tindakan

1. Aktifkan kembali penggunaan pita untuk kategori **P/KB** tanpa mengubah rumus, rentang pita, bobot, atau aturan catatan juri.
2. Jalankan penghitungan ulang cache nilai agar nilai lama mengikuti mode pita yang aktif.
3. Verifikasi konfigurasi P/KB, cache submission, dan hasil ranking setelah penyegaran.

## Hasil yang diharapkan

Nilai tetap mengikuti sistem pita seperti sekarang. Perbedaan terhadap mode tanpa pita tetap wajar dan disengaja; seluruh halaman hanya akan konsisten menampilkan hasil mode pita yang aktif.
