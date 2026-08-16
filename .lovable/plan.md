# Grade setengah (mis. 4,5) untuk aspek Catatan Juri

## Kondisi saat ini
- Kriteria induk (Interpretasi, Penghayatan, Artikulasi, Penampilan) sudah punya pilihan grade setengah: 1, 1½, 2, 2½, … 5.
- Tabel rasio (`lookup_nilai` di database dan `lookupNilaiClient` di form) sudah memuat nilai tersendiri untuk tiap setengah langkah:
  1,0=0,050 · 1,5=0,120 · 2,0=0,220 · 2,5=0,360 · 3,0=0,520 · 3,5=0,680 · 4,0=0,810 · **4,5=0,910** · 5,0=1,000.
- Yang belum: tombol aspek Catatan Juri hanya menyediakan angka bulat 1–5, sehingga grade 4,5 (rasio 0,910) tidak bisa dipilih juri.

## Yang akan dikerjakan
1. Ganti baris tombol tiap aspek Catatan Juri dari 5 tombol (1–5) menjadi 9 tombol: 1, 1½, 2, 2½, 3, 3½, 4, 4½, 5 — dengan tampilan angka "4½" untuk nilai setengah, tata letak tetap rapi di layar kecil.
2. Perhitungan kontribusi tidak berubah rumusnya, hanya kini menerima nilai setengah:
   `kontribusi = rasio(grade aspek) × rasio(grade induk) × bobot aspek`.
   Contoh: aspek grade 4,5 (0,910) di bawah Interpretasi grade 4 (0,810), bobot aspek 1,75 → 0,910 × 0,810 × 1,75 = **1,2900**.
3. Label ringkasan di dalam dialog (badge `×rasio`, baris "kontribusi = …", total bonus) menampilkan grade setengah dengan format 1 desimal.
4. Teks bantuan diperbarui: "beri nilai 1–5 (boleh setengah langkah, mis. 4½)".
5. Tampilan rincian/ekspor PDF menampilkan grade aspek Catatan Juri dengan format setengah yang sama, agar angka di form, database, dan PDF konsisten.

## Catatan teknis
- Tidak perlu migrasi database: `lookup_nilai` dan `hitung_nilai_juri` sudah menginterpolasi/menghitung nilai setengah, dan kolom `catatan` disimpan sebagai JSON numerik.
- Perubahan terbatas pada `src/routes/_authenticated/dashboard.tsx` (dialog Catatan Juri, helper format grade, blok ekspor rincian).
- Aturan wajib-isi saat Clear Text = "Tidak" tetap sama: aspek dianggap terisi bila nilainya bukan kosong.
