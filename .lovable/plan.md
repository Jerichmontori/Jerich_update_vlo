# Dua Jalur "Buka Perbaikan"

Saat ini tombol Buka Perbaikan bercampur: Admin bisa membuka penilaian ulang untuk siapa saja, dan notifikasi keberatan juga menampilkan tombol buka perbaikan. Rencana ini memisahkannya menjadi dua alur resmi yang tidak bisa saling menimpa.

## Jalur 1 — Perbaikan atas permintaan Juri (nilai sudah final)

Untuk kasus juri salah input nilai.

1. Juri mengajukan permintaan perbaikan dari dashboard juri: pilih peserta yang sudah dikirim, isi alasan. Permintaan disimpan sebagai pengajuan berstatus "menunggu" (memakai tabel peninjauan kembali yang sudah ada).
2. Admin melihat daftar permintaan juri di dashboard (badge jumlah menunggu), lengkap dengan nama juri, peserta, dan alasan.
3. Admin menyetujui atau menolak.
   - Disetujui: penilaian peserta dibuka kembali **hanya untuk juri pemohon** — kiriman juri tersebut dihapus sehingga ia dapat menilai ulang; kiriman juri lain tetap utuh.
   - Ditolak: permintaan ditutup dengan catatan admin.
4. Setelah juri mengirim ulang, nilai dihitung otomatis dan status peserta kembali final.
5. Semua langkah tercatat di log audit.

Tombol "Buka Penilaian Ulang" bebas (tanpa permintaan juri) tetap ada untuk admin, tetapi diberi konfirmasi tegas dan wajib catatan alasan.

## Jalur 2 — Perbaikan karena Keberatan berkeputusan VAR

Untuk kasus keberatan diterima dengan tindak lanjut VAR.

1. Admin **tidak** membuka perbaikan. Panel notifikasi di dashboard admin hanya bersifat informasi: "Keberatan diterima, menunggu Inspektur Pertandingan (VAR)".
2. Data otomatis masuk ke daftar antrean VAR di halaman Inspektur VAR.
3. Hanya Inspektur VAR yang memiliki tombol Buka Perbaikan. Tombol ini membuka sesi koreksi VAR, bukan mengembalikan penilaian ke juri.
4. Inspektur VAR mengoreksi nilai per juri terbatas pada parameter penyebab VAR, sistem menghitung ulang, dan menyimpan snapshot sebelum/sesudah sebagai bukti pertanggungjawaban (mekanisme yang sudah ada).
5. Inspektur VAR menutup perbaikan; keberatan ditandai selesai dan peserta kembali final.

## Aturan penguncian (agar dua jalur tidak bertabrakan)

- Jika ada keberatan diterima dengan tindak lanjut VAR yang belum selesai, permintaan buka penilaian ulang oleh Admin/Juri ditolak dengan pesan: "Peserta sedang dalam penanganan VAR Inspektur Pertandingan".
- Sebaliknya, jika penilaian sedang dibuka untuk juri (jalur 1), Inspektur VAR tidak dapat membuka koreksi sampai juri mengirim ulang.
- Peserta yang belum final tidak bisa masuk kedua jalur.

## Jika Admin salah membuka perbaikan

Agar kesalahan klik dapat dibatalkan tanpa merusak nilai:

1. **Pencegahan.** Sebelum perbaikan dibuka, sistem menampilkan dialog konfirmasi berisi nama peserta, nilai akhir saat ini, daftar juri yang terdampak, dan kolom alasan yang wajib diisi.
2. **Cadangan otomatis.** Saat perbaikan dibuka, sistem menyimpan salinan kiriman dan nilai seluruh juri untuk peserta tersebut (snapshot) sebelum apa pun dihapus.
3. **Tombol "Batalkan Buka Perbaikan".** Selama belum ada juri yang mengirim nilai baru, Admin dapat membatalkan: sistem memulihkan kiriman dan nilai dari snapshot, menutup kembali sesi, dan peserta kembali final seperti semula.
4. **Bila sudah terlanjur ada nilai baru.** Pembatalan cepat tidak lagi tersedia. Admin memilih salah satu:
   - lanjutkan perbaikan sampai semua juri mengirim ulang, atau
   - ajukan pemulihan ke Inspektur Pertandingan, yang dapat mengembalikan nilai lama dari snapshot dan mencatat keputusannya sebagai bukti.
5. **Salah jalur.** Jika perbaikan dibuka ke juri padahal kasusnya keberatan berkeputusan VAR, Admin membatalkan dulu (langkah 3), lalu kasus diteruskan ke antrean Inspektur VAR. Aturan penguncian di atas membuat kesalahan ini jarang terjadi karena sistem menolaknya sejak awal.
6. Setiap pembukaan, pembatalan, dan pemulihan tercatat di log audit beserta nama pelaku, waktu, dan alasan.

## Rincian teknis

- Fungsi database baru: `juri_ajukan_perbaikan(_peserta, _alasan)`, `admin_list_permintaan_perbaikan()`, `admin_putuskan_perbaikan_juri(_id, _setuju, _catatan)` — yang terakhir menghapus baris `penilaian_submission` milik juri pemohon saja, mengaktifkan kembali sesi, dan mencatat audit.
- `admin_buka_penilaian_ulang` ditambah pemeriksaan: gagal jika ada `keberatan` berstatus diterima + `tindak_lanjut='var'` dengan `perbaikan_selesai_at` kosong; dan wajib `_catatan`.
- `ip2_buka_perbaikan` ditambah pemeriksaan role `inspektur_var`/`inspektur` saja (bukan admin), plus penolakan bila ada permintaan perbaikan juri yang aktif.
- UI: `PerbaikanNotifikasi` dipakai read-only di dashboard admin (`canOpen` selalu false di sana), tetap `canOpen` di halaman Inspektur VAR.
- UI baru: kartu "Permintaan Perbaikan Juri" di dashboard admin, dan form pengajuan perbaikan di dashboard juri.
- GRANT EXECUTE untuk fungsi baru hanya ke `authenticated`, dengan pemeriksaan role di dalam fungsi.
