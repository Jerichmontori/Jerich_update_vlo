# Rencana: Role "Inspektur Pertandingan"

Role pengawas independen — **read-only** untuk seluruh data pertandingan, ditambah dua aksi terbatas: **memberi catatan** dan **menyetujui / menolak penyelesaian VAR** (bila diaktifkan di konfigurasi sistem).

---

## 1. Database (migration)

**Enum & konfigurasi**
- Tambah nilai baru ke `app_role`: `inspektur` (dan `ketua_juri` untuk melengkapi hierarki — hanya enum, halaman ketua di luar cakupan permintaan ini).
- Tabel baru `public.system_config` (key/value) dengan flag awal:
  - `inspektur_var_approval_required` (boolean, default `false`).
  - RLS: SELECT semua authenticated, UPDATE hanya `admin`.

**Tabel baru `public.var_review`** — catatan & keputusan Inspektur per peserta/sesi:
- `id`, `session_id`, `peserta_id`, `inspektur_id`, `catatan text`, `keputusan text` (`pending` | `disetujui` | `ditolak` | `catatan_saja`), `created_at`.
- RLS:
  - SELECT: admin, panitia, inspektur, ketua_juri.
  - INSERT: hanya inspektur (dan admin).
  - UPDATE/DELETE: hanya admin.

**Perluasan `operator_audit_log`** — dipakai bersama Inspektur (tanpa ubah skema; hanya menambah nilai `action`: `inspektur_login`, `inspektur_view_var`, `inspektur_catatan`, `inspektur_setuju_var`, `inspektur_tolak_var`, `inspektur_view_penilaian`, dsb).
- Perluas policy INSERT audit agar `inspektur` juga bisa menulis log miliknya sendiri.
- SELECT audit: tambahkan inspektur (read-only pengawasan).

**RLS baca lintas juri untuk Inspektur**
- Policy tambahan pada `penilaian`: SELECT untuk `inspektur` bila **semua juri sudah submit** untuk peserta itu (dicek via fungsi SECURITY DEFINER `all_juri_submitted(_peserta uuid)`), sehingga Inspektur hanya melihat nilai setelah pertandingan selesai — sesuai spesifikasi.
- `penilaian_submission`, `sesi_penilaian`, `peserta`, `mazmur`, `kategori`, `kriteria`, `juri` (via `juri_public`): tambahkan SELECT untuk role `inspektur`.

**Fungsi baru (SECURITY DEFINER)**
- `inspektur_list_var()` → daftar peserta berstatus Potensi VAR (bacaan berbeda atau perhatian Q2/Q4/Q5 berbeda) beserta ringkasannya.
- `inspektur_var_detail(_peserta uuid)` → payload lengkap: peserta, mazmur, kriteria, nilai per juri, komponen yang berbeda.
- `inspektur_ringkasan()` → total peserta, sudah tampil, belum tampil, sedang tampil, sesi aktif/selesai, total VAR.
- `inspektur_monitor()` → tabel peserta + nomor tampil + mazmur + status + progress juri (x/y).
- `inspektur_catat(_peserta uuid, _catatan text, _keputusan text)` → validasi role + config, tulis `var_review` + audit.
- Semua fungsi cek `has_role(auth.uid(), 'inspektur') OR has_role('admin')`.

**GRANT** untuk semua tabel/fungsi baru ke `authenticated` + `service_role` sesuai standar.

## 2. Backend server functions (`src/lib/inspektur.functions.ts`)
Wrapper `createServerFn` + `requireSupabaseAuth` untuk memanggil RPC di atas:
- `getInspekturRingkasan`, `getInspekturMonitor`, `getInspekturVarList`, `getInspekturVarDetail`, `catatVar`, `getSystemConfig`, `setSystemConfig` (admin-only).
- `logInspekturAction(action, metadata)` untuk mencatat login / buka detail / unduh.

## 3. Frontend

**Route guard & navigasi**
- Halaman baru `src/routes/_authenticated/inspektur.tsx` — cek role `inspektur` atau `admin`; redirect ke `/dashboard` kalau bukan.
- Tambah tombol "Inspektur Pertandingan" di header `dashboard.tsx` & `operator.tsx` untuk role terkait.
- Dropdown role di tab Juri (admin) tambah pilihan `inspektur` (dan `ketua_juri`).

**Halaman Inspektur** (tabbed, polling 3 dtk, tanpa reload):
1. **Ringkasan** — kartu-kartu total peserta / sudah tampil / belum tampil / sedang tampil / sesi aktif / sesi selesai / total VAR.
2. **Monitoring Real-time** — tabel Peserta · Nomor Tampil · Bacaan Mazmur · Status (Menunggu / Sedang Dinilai / Menunggu Juri / Potensi VAR / Final) · Progress Juri (x/y, dengan progress bar).
3. **Potensi VAR** — kartu merah tiap peserta VAR: nama, nomor tampil, mazmur, komponen berbeda, jumlah juri berbeda, waktu deteksi, tombol **Lihat Detail**.
4. **Detail VAR (dialog)** — info peserta + tabel nilai semua juri, komponen berbeda ditandai merah (⚠ Tidak Konsisten) vs ✓ Konsisten. Textarea **Catatan Inspektur** + tombol **Simpan Catatan**. Jika `inspektur_var_approval_required=true`: tombol **Setujui Penyelesaian VAR** dan **Tolak Penyelesaian VAR**.
5. **Audit Log** — tabel read-only dari `operator_audit_log` (aksi Inspektur & operator terkait sesi/mazmur/urutan/VAR).

**Konfigurasi sistem** (admin): kartu kecil di dashboard admin (tab Juri atau tab baru "Konfigurasi") berisi toggle `inspektur_var_approval_required`.

**Hardening read-only**
- Semua tombol edit/hapus/tambah di modul lain (dashboard admin, operator) disembunyikan bila `role === 'inspektur'`.
- Backend tetap menolak: policies UPDATE/DELETE/INSERT pada peserta/mazmur/kriteria/penilaian tidak mencakup `inspektur`.

## 4. Audit log
Ditulis dari server function tiap: buka halaman inspektur (login inspektur), buka detail VAR, buka riwayat nilai, memberi catatan, setuju/tolak VAR, unduh laporan. IP diambil dari header `x-forwarded-for`.

## 5. Verifikasi
- Login sebagai Inspektur → hanya melihat halaman `/inspektur` + read-only ke data terkait; tidak ada tombol edit di mana pun; backend menolak setiap mutasi.
- Nilai juri baru terlihat setelah semua juri submit peserta tsb.
- Toggle `inspektur_var_approval_required` mengaktif/nonaktifkan tombol Setujui/Tolak.
- Semua aksi tercatat di `operator_audit_log`.

## Detail teknis singkat
- RBAC: role check di backend (RPC SECURITY DEFINER + policy per role) + guard di UI.
- Realtime pakai polling 3 dtk (konsisten dgn pola dashboard/operator sekarang) — tanpa Realtime channel.
- Ketua Dewan Juri hanya ditambahkan sebagai enum agar hirarki lengkap; halaman & workflow ketua di luar cakupan permintaan ini (bisa dilanjutkan terpisah).

---

Setuju saya lanjut implementasi sesuai plan ini, atau ada bagian yang mau disesuaikan (mis. skip halaman Konfigurasi admin dan pakai default `false`, atau sekalian buat halaman Ketua Dewan Juri sekarang)?
