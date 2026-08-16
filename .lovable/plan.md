# Perbaikan "This page didn't load" saat juri memilih grade (perangkat Samsung)

## Masalah
Di HP/Tab Samsung, setiap kali juri menekan salah satu grade pada kriteria penilaian, halaman jatuh ke layar "This page didn't load". Di perangkat lain alur ini berjalan normal.

Penyebab pastinya belum terkonfirmasi. Yang sudah dipastikan dari kode saat ini: penekanan grade langsung menyimpan ke database, menutup dialog, mereset beberapa state, lalu memanggil pemuatan ulang seluruh data penilaian dalam satu rangkaian. Ada beberapa titik yang bisa gagal di browser Samsung Internet, jadi langkah pertama adalah membuktikan titik gagalnya, bukan menebak.

## Langkah 1 — Tangkap penyebab aslinya
- Reproduksi alur "pilih peserta → buka kriteria → tekan grade" dengan browser uji yang memakai user-agent Samsung Internet dan layar tablet, sambil merekam console error, permintaan jaringan yang gagal, dan stack trace.
- Tambahkan pelaporan error yang lebih jelas pada langkah simpan grade sehingga pesan aslinya terlihat (bukan hanya layar putih "This page didn't load"), termasuk untuk error jaringan/penyimpanan browser.

## Langkah 2 — Perkuat alur simpan grade
Perubahan ini aman diterapkan apa pun hasil Langkah 1, karena semuanya menghilangkan cara-cara yang paling mungkin membuat satu penekanan tombol mematikan seluruh halaman:
- Bungkus proses simpan grade dalam penanganan error penuh: kegagalan menampilkan notifikasi "Gagal menyimpan, coba lagi" dan mempertahankan dialog, tidak pernah melempar error ke pembatas error halaman.
- Jalankan pemuatan ulang data setelah simpan secara terpisah dan tahan-error, supaya kegagalan memuat ulang tidak membatalkan penyimpanan yang sudah berhasil.
- Pastikan reset state setelah simpan mengembalikan bentuk data yang sama seperti nilai awal (baris per pertanyaan tetap ada), sehingga render berikutnya tidak menemui bentuk data tak terduga.
- Amankan efek samping browser (penyimpanan lokal, gulir otomatis, `crypto.randomUUID`) di sekitar alur penilaian dengan pengaman, karena beberapa di antaranya berperilaku berbeda di Samsung Internet dan mode privasi.

## Langkah 3 — Pastikan kegagalan tetap lokal
- Pastikan panel penilaian juri berada di dalam pembatas error lokal yang sudah ada, sehingga bila tetap ada kegagalan tak terduga, hanya panel itu yang menampilkan tombol "Coba lagi" dan nilai yang sudah tersimpan tidak hilang.

## Langkah 4 — Verifikasi
- Uji ulang di browser uji dengan user-agent Samsung: pilih grade pada keempat kriteria berturut-turut, pastikan tidak ada layar error, nilai tersimpan, dan console bersih.
- Uji ulang alur yang sama pada tampilan desktop untuk memastikan tidak ada regresi.

## Catatan teknis
- File utama: `src/routes/_authenticated/dashboard.tsx` (fungsi `saveNilai`, `loadAll`, reset state `perhatianChecks`/`catatanValues`, callback `scrollKePilihan`).
- Pembatas error lokal: `src/components/PanelErrorBoundary.tsx` (sudah membungkus `PenilaianTab`).
- Tidak ada perubahan skema database, rumus nilai, atau alur VAR/perbaikan.
