
# Rencana: Role Panitia/Operator Lomba

## 1. Database (migration)

**Enum baru:**
- Tambah nilai `panitia` ke enum `app_role` (menjadi: `admin`, `juri`, `viewer`, `panitia`).

**Tabel baru `public.sesi_penilaian`:**
- `id`, `peserta_id`, `mazmur_id`, `kategori` (opsional untuk aturan "satu active per kategori"), `status` (`draft` | `active` | `selesai`), `started_at`, `ended_at`, `created_by`, `created_at`, `updated_at`.
- Unique partial index: hanya 1 baris dengan `status='active'` per `kategori`.
- Trigger `set_updated_at`.

**Tabel baru `public.operator_audit_log`:**
- `id`, `user_id`, `user_nama`, `role`, `action` (login / pilih_peserta / ubah_urutan / pilih_mazmur / ubah_mazmur / mulai_sesi / akhiri_sesi), `session_id`, `peserta_id`, `mazmur_id`, `ip_address`, `metadata jsonb`, `created_at`.

**RLS + GRANT (wajib per aturan public-schema-grants):**
- `sesi_penilaian`:
  - SELECT: semua `authenticated` (juri perlu tahu sesi aktif).
  - INSERT/UPDATE: hanya `admin` atau `panitia` (via `has_role`).
  - DELETE: hanya `admin`.
- `operator_audit_log`:
  - SELECT: admin saja.
  - INSERT: admin + panitia (menulis log sendiri).
- Perluas policy `peserta` UPDATE agar `panitia` juga bisa ubah `nomor_urut` (kolom lain tetap admin-only via kolom check — atau berikan UPDATE penuh untuk kesederhanaan, dengan catatan panitia dipercaya untuk field urutan).
- Grant `SELECT, INSERT, UPDATE` pada `sesi_penilaian` ke `authenticated`; `ALL` ke `service_role`.

**Fungsi:**
- `mulai_sesi(_peserta uuid, _mazmur uuid)` SECURITY DEFINER — cek role panitia/admin, tutup sesi aktif lain di kategori sama, buat sesi baru status `active`, tulis audit log.
- `akhiri_sesi(_id uuid)` SECURITY DEFINER — set status `selesai`, `ended_at=now()`, audit log.
- `ubah_mazmur_sesi(_id uuid, _mazmur uuid)` SECURITY DEFINER — tolak jika sudah ada baris di `penilaian_submission` untuk peserta sesi tersebut.
- Update `handle_new_user` tidak perlu berubah.

## 2. Frontend

**Route guard:**
- Halaman baru `src/routes/_authenticated/operator.tsx` — cek role `panitia` atau `admin` di komponen; redirect ke `/dashboard` jika bukan.

**Halaman Operator Lomba** menampilkan:
- Card **Peserta Aktif** (nomor tampil, nama, kategori, status).
- Card **Bacaan Mazmur Aktif**.
- Card **Status Penilaian** (Belum Dimulai / Sedang Berlangsung / Selesai).
- Card **Progress Juri** — realtime "X dari Y juri telah mengirim" via polling 3 detik terhadap `penilaian_submission` untuk `peserta_id` sesi aktif.
- Tabel **Daftar Peserta** dengan tombol ⬆⬇ untuk ubah `nomor_urut`, dan tombol "Pilih".
- Dropdown **Bacaan Mazmur** dari tabel `mazmur`.
- Tombol **Mulai Penilaian**, **Ubah Bacaan Mazmur**, **Akhiri Penilaian**.

**Perubahan dashboard juri (`_authenticated/dashboard.tsx`):**
- Di form Input Penilaian, ketika ada sesi `active`: field Peserta & Bacaan Mazmur di-autoset dari sesi aktif dan **dikunci** (read-only) untuk juri.
- Polling sesi aktif tiap 3 detik agar juri melihat pergantian peserta otomatis.
- Ketika sesi berubah, reset form input juri untuk peserta baru.
- Admin tetap punya semua akses lama.

**Navigasi:**
- Tambah link menu "Operator Lomba" di sidebar/nav dashboard untuk role `panitia` dan `admin`.

**Manajemen role admin:**
- Di halaman admin (kelola user/juri), tambahkan opsi tetapkan role `panitia` selain `admin`/`juri`.

## 3. Audit log
- Tulis log dari server function untuk setiap aksi operator (pilih peserta, ubah urutan, pilih/ubah mazmur, mulai/akhiri sesi). IP dibaca dari header `x-forwarded-for` di `createServerFn` handler.

## 4. Verifikasi
- Login sebagai panitia → hanya melihat halaman Operator + Input Penilaian miliknya (tidak melihat data juri lain).
- Login sebagai juri → Peserta & Mazmur otomatis mengikuti sesi aktif dan tidak bisa diubah.
- Tanpa sesi aktif → juri tidak bisa submit (validasi backend menolak insert `penilaian` jika `peserta_id` bukan sesi active — via trigger BEFORE INSERT).

## Detail teknis singkat
- Semua endpoint sensitif dilindungi RLS + fungsi SECURITY DEFINER yang mengecek `has_role`.
- Tidak menggunakan admin service_role untuk operasi normal panitia — cukup RLS + role check dalam fungsi.
- Realtime cukup polling ringan (3 dtk) mengikuti pola dashboard yang sudah ada; tidak perlu Realtime channel.

---

Fitur ini cukup besar dan menyentuh DB + juri flow. Setuju saya lanjut implementasi sesuai plan ini, atau ada bagian yang mau disesuaikan (mis. skip audit log dulu, atau tanpa trigger validasi sesi active di backend)?
