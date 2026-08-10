# Operator Lomba: Alur Berkelanjutan (Non-Blocking)

Dengan adanya Inspektur VAR (IP 2) yang menyelesaikan kasus VAR/keberatan secara terpisah, panggung tidak perlu lagi berhenti menunggu penilaian peserta sebelumnya selesai. Operator Lomba diubah menjadi pengatur antrian panggung yang bisa terus jalan, sementara penyelesaian nilai berjalan paralel di belakang layar.

## Kondisi saat ini

- Tombol **Mulai Penilaian** dinonaktifkan selama masih ada sesi aktif; operator harus menunggu Inspektur menekan "Akhiri Sesi".
- Fungsi mulai sesi di database sebenarnya sudah otomatis menutup sesi aktif pada kategori yang sama, jadi memulai peserta berikutnya aman tanpa merusak nilai yang sudah masuk.
- Halaman operator hanya menampilkan 1 peserta aktif, tanpa gambaran peserta mana yang masih menggantung (juri belum lengkap / VAR belum diputus IP 2).

## Yang akan dibangun

### 1. Tombol "Peserta Berikutnya" (tanpa menunggu)
- Operator dapat langsung memilih peserta berikutnya + bacaan mazmur dan menekan **Tampilkan Peserta Berikutnya** meski sesi sebelumnya belum diakhiri Inspektur.
- Muncul dialog konfirmasi yang merangkum status peserta sebelumnya (mis. "3 dari 5 juri sudah mengirim; VAR menunggu keputusan IP 2"). Nilai dan catatan juri peserta sebelumnya tidak dihapus — juri yang belum mengirim tetap bisa menyelesaikan.
- Tombol lama tetap ada saat tidak ada sesi aktif.

### 2. Panel "Antrian Panggung"
Tiga kolom ringkas:
- **Sedang Tampil** — peserta aktif, mazmur, progres juri (x dari y).
- **Berikutnya** — peserta terpilih berikut, siap dengan mazmur (validasi kategori).
- **Menunggu Penyelesaian** — daftar peserta yang sudah turun panggung tetapi belum final, dengan label statusnya.

### 3. Label status berkelanjutan per peserta
Status pada daftar peserta diperluas dari "Belum/Sudah dinilai" menjadi:
- `Belum tampil`
- `Sedang tampil`
- `Menunggu juri (x/y)`
- `Proses VAR — IP 2`
- `Final`
- `Terlambat`

### 4. Indikator backlog + pengingat
- Badge jumlah peserta yang belum final di header operator; jika melebihi ambang (mis. 3), muncul peringatan lembut agar operator mengoordinasikan dengan Inspektur/IP 2 — tanpa memblokir.
- Panel tetap disegarkan berkala mengikuti polling yang sudah ada.

### 5. Informasi status VAR peserta + tayang otomatis di vMix
- Di panel operator, peserta yang terdeteksi **Potensi VAR** atau **VAR Diajukan** diberi penanda mencolok beserta keterangan tahapannya (menunggu klarifikasi juri / menunggu keputusan IP 2 / selesai).
- Status VAR ini juga dikirim ke sumber data tayangan, sehingga overlay vMix (`vmix.nowreading`) otomatis menampilkan badge "POTENSI VAR" / "VAR — Peninjauan Inspektur" saat peserta yang sedang tampil berstatus VAR, dan badge hilang sendiri begitu kasus final.
- Operator mendapat sakelar **Tayangkan status VAR di vMix** (aktif secara default) bila suatu saat ingin disembunyikan dari layar penonton.

### 6. Jejak audit
Setiap perpindahan peserta saat sesi lama masih berjalan dicatat di log audit operator dengan metadata status peserta sebelumnya, sehingga bisa dipertanggungjawabkan dalam laporan.

## Catatan teknis

- Frontend: `src/routes/_authenticated/operator.tsx` — hapus penonaktifan tombol saat `sesi` aktif, tambah dialog konfirmasi, panel antrian, dan perluasan status.
- Data status diambil dari sumber yang sudah ada: `penilaian_submission` (progres juri), `var_clarification_session` (status VAR), `peserta.terlambat`, serta pool juri aktif — tidak perlu tabel baru.
- Status VAR untuk tayangan ditambahkan ke `public_live_state()` (field baru `var_status`), dibaca `src/routes/vmix.nowreading.tsx`; sakelar tampil/sembunyi disimpan di `system_config`.
- Perpindahan peserta memakai RPC `mulai_sesi` yang sudah menutup sesi aktif kategori yang sama; `akhiri_sesi` (yang menghapus catatan juri) tidak dipakai di alur ini.
- Tidak ada perubahan aturan perhitungan nilai, VAR, maupun kewenangan IP 1 / IP 2.

