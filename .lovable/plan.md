
# Rencana Perubahan

## 1. Halaman Inspektur — Progres Juri & Nilai
- Tambah panel "Progres Juri" pada peserta yang sesinya aktif: daftar semua juri approved, status **Sudah Kirim** / **Belum Kirim**, dan nilai yang sudah diinput per kriteria bila sudah kirim.
- Diperbarui otomatis (polling yang sudah ada di halaman inspektur).
- Data via RPC baru `inspektur_progres_juri(_peserta uuid)` yang mengembalikan daftar juri + status submission + nilai per kriteria (JSONB), dibungkus `SECURITY DEFINER` dengan gate role inspektur/admin.

## 2. Pindah tombol "Akhiri Penilaian"
- Hapus tombol **Akhiri Penilaian** di halaman **Operator** (`src/routes/_authenticated/operator.tsx`) — sisakan hanya Ubah Bacaan Mazmur.
- Tambah tombol **Akhiri Penilaian** di halaman **Inspektur** (`src/routes/_authenticated/inspektur.tsx`) untuk sesi aktif terpilih.
- Ketika diklik: memanggil `akhiri_sesi` (sudah ada) + menaikkan status peserta menjadi **Final** (menutup semua `var_clarification_session` yang masih terbuka untuk peserta itu → status `final`).

## 3. Tombol "Mulai Penilaian" auto-disable
- Di Operator, setelah **Mulai Penilaian** diklik dan sesi aktif tercipta, tombol dinonaktifkan.
- Baru kembali aktif setelah Inspektur mengklik **Akhiri Penilaian** (state ini sudah tercermin dari `sesi` polling; hanya perlu memastikan UI tidak menampilkan tombol Mulai saat ada sesi aktif — sudah demikian).

## 4. Ajukan VAR manual (Inspektur)
- Tombol **Ajukan VAR** di halaman Inspektur untuk sesi yang **sedang aktif** saja.
  - Disabled jika tidak ada sesi aktif untuk peserta.
- Dialog konfirmasi: input **Alasan VAR** (textarea wajib).
- Membuat/mengupdate `var_clarification_session` dengan status baru `menunggu_persetujuan_juri`, `komponen_berbeda` diisi `["manual"]`, catatan disimpan di metadata review + `komponen_berbeda` menyertakan alasan.
- RPC baru: `inspektur_ajukan_var(_peserta, _alasan)`.

## 5. Persetujuan VAR oleh semua juri
- Di halaman **Juri (dashboard)**, ketika ada VAR manual berstatus `menunggu_persetujuan_juri` untuk peserta yang sedang mereka nilai, tampilkan dialog: "Inspektur mengajukan VAR — alasan: … Setujui?" dengan tombol Setuju/Tolak.
- RPC baru: `juri_vote_var(_session_id, _setuju bool)` menyimpan suara di `var_clarification_response` (komponen=`manual_vote`, keputusan=bool).
- Bila **semua juri approved** menyetujui: 
  - Status VAR → `perbaikan_var_manual`.
  - Hapus baris `penilaian_submission` untuk peserta ini (mengaktifkan kembali form juri agar bisa mengubah nilai dan kirim ulang). Baris `penilaian` (nilai lama) tetap sehingga saat form dibuka nilai sebelumnya tampil untuk diedit.
  - Setelah semua juri kirim ulang, alur normal `after_submission_detect_var` → `potensi_var` / `final` seperti biasa.
- Bila ada juri menolak: status → `ditolak_juri`, tidak ada perubahan nilai.
- Kartu **Potensi VAR** tetap menampilkan riwayat VAR manual (tidak dihapus otomatis) agar jumlah kejadian VAR terlacak.

## 6. Sesi selesai → tidak bisa VAR
- Tombol Ajukan VAR disabled kecuali ada `sesi_penilaian` dengan `status='active'` untuk peserta.

## Detail teknis
Migrasi Supabase:
- `inspektur_progres_juri(_peserta uuid)` RETURNS jsonb.
- `inspektur_ajukan_var(_peserta uuid, _alasan text)` RETURNS uuid.
- `juri_vote_var(_session uuid, _setuju bool)` RETURNS jsonb.
- `inspektur_akhiri_sesi(_peserta uuid)` RETURNS void: panggil `akhiri_sesi` + finalisasi VAR session terbuka.
- Update fungsi terkait untuk menerima status baru `menunggu_persetujuan_juri`, `perbaikan_var_manual`, `ditolak_juri` (tetap dianggap "aktif" untuk `<> 'final'` filter).

Frontend:
- `operator.tsx`: hapus tombol Akhiri + dialog konfirmasi terkait.
- `inspektur.tsx`: 
  - Panel progres juri per peserta (expand di kartu Monitor).
  - Tombol Akhiri Penilaian (sesi aktif).
  - Tombol Ajukan VAR + dialog alasan.
- `dashboard.tsx` (juri): tambah polling status VAR manual + dialog persetujuan.

## Catatan
Perubahan besar dan menyentuh alur skoring inti. Setelah persetujuan, saya akan mengeksekusi migrasi terlebih dahulu (menunggu approval Anda), lalu menerapkan perubahan kode frontend.
