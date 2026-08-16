# Perhatian: Clear Text sebagai satu-satunya pemicu VAR, tanpa penalti

## Tujuan

1. Potensi VAR hanya dipicu oleh perbedaan jawaban **Clear Text** antar juri.
2. Penalti dari kriteria Perhatian dihapus — tidak lagi mengurangi nilai.
3. Menambah pertanyaan baru **Mengulang kata** pada kriteria Perhatian.
4. Semua jawaban Perhatian selain Clear Text hanya bersifat **informasi** (menunjukkan letak kesalahan pada ayat), tanpa pengaruh ke nilai dan tanpa memicu VAR.
5. Bila semua juri menjawab sama — sama-sama "Tidak clear" maupun sama-sama "Clear" — **tidak ada potensi VAR**, walaupun penandaan ayat antar juri berbeda.

## Perubahan Perilaku

| Hal | Sekarang | Sesudah |
| --- | --- | --- |
| Pemicu VAR | Clear Text + Salah kata + Menambah kata + Mengurangi kata | Hanya Clear Text |
| Penandaan ayat | Mengurangi nilai (penalti sampai bobot -10) | Tanpa pengaruh nilai, hanya catatan lokasi kesalahan |
| Pertanyaan Perhatian | Clear Text, Salah kata, Menambah kata, Mengurangi kata | + **Mengulang kata** |
| Nilai Perhatian | Ikut hitungan akhir | Disimpan sebagai informasi saja |

## Perubahan Database (satu migrasi)

- `detect_potensi_var`: hapus loop 3 komponen penandaan; hanya bandingkan `clearText` antar juri. `komponen_berbeda` maksimal berisi `["clear_text"]`.
- `hitung_nilai_juri`: hentikan akumulasi `penalty_marks` (set `pen = 0`), hilangkan komponen `bobot_per` dari `raw` dan `raw_min`. Clear Text tetap menentukan pita nilai / batas atas–bawah seperti sekarang; penandaan ayat tidak lagi menurunkan nilai.
- `var_detail_persepsi` / `var_berita_acara`: tetap menampilkan penandaan ayat semua juri sebagai bukti informatif (termasuk aspek baru Mengulang kata).
- `ip2_putuskan_var` dan `ip2_koreksi_per_juri`: keputusan yang mengubah nilai hanya lewat **Clear Text**; koreksi penandaan ayat tetap tersimpan pada snapshot sebagai dokumentasi, tanpa efek nilai.

## Perubahan Frontend

- `src/routes/_authenticated/dashboard.tsx`
  - `PERHATIAN_ASPEK` menjadi: Clear Text, Salah kata, Menambah kata, Mengurangi kata, **Mengulang kata**.
  - Skor Perhatian (`perhatianNilai`) menjadi 0/informasional; simpan `detail` penandaan seperti biasa.
  - Mode Perbaikan Perhatian: hanya baris **Clear Text** yang dapat diubah; baris penandaan tetap dapat diisi sebagai catatan, diberi label "informasi saja".
  - Teks bantuan: penandaan ayat dijelaskan sebagai penanda lokasi kesalahan, bukan pengurang nilai.
- `src/components/VarPersepsiDetail.tsx`, `AdminVarTab.tsx`, `IpVarKoreksi.tsx`, `IpVarKoreksiPerJuri.tsx`, `src/routes/_authenticated/inspektur.tsx`, `vmix.tsx`: label komponen ditambah `mengulang_kata`; badge "komponen berbeda" praktis hanya Clear Text; panel koreksi ayat ditandai "tidak mempengaruhi nilai".

## Catatan Teknis

- Data lama yang sudah menyimpan penandaan tetap valid; nilai akan berubah setelah "Hitung Ulang Nilai" karena penalti tidak lagi dipakai.
- Bobot kriteria Perhatian di tabel `kategori`/`kriteria` dibiarkan, tetapi tidak lagi dipakai dalam rumus.
- Sesi VAR lama yang terbuka karena perbedaan penandaan akan otomatis ditutup (`final`) saat deteksi ulang berjalan, karena `komponen_berbeda` menjadi kosong.
