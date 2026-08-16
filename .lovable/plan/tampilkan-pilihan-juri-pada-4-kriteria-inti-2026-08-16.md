# Tampilkan Pilihan Juri pada 4 Kriteria Inti

Saat juri membuka kembali penilaian yang belum dikirim, pilihan grade yang sudah tersimpan tidak terlihat: tombol kriteria hanya berubah warna (aktif), dan di dalam dialog semua grade tampil netral tanpa tanda mana yang dipilih.

## Yang akan diubah (tampilan saja)

1. **Tombol kriteria (Vokal, Penghayatan, Intonasi, Penampilan)**
   - Menampilkan grade yang sudah dipilih, mis. "Grade 4" atau "Grade 4½", sebagai label kecil di bawah nama kriteria.
   - Tombol yang belum diisi tetap seperti sekarang ("Belum dinilai" implisit / polos).

2. **Dialog pilih grade**
   - Baris grade yang sedang tersimpan ditandai jelas: border aksen, latar aksen tipis, dan ikon centang di sisi kanan.
   - Dialog otomatis menggulir ke pilihan tersimpan saat dibuka.
   - Judul dialog menampilkan status "Pilihan saat ini: Grade X".

3. **Kriteria Catatan Juri & Perhatian** sudah memulihkan pilihan sebelumnya; tidak diubah, hanya diberi indikator ringkas pada tombolnya (mis. "3 aspek terisi" / "Clear Text: Ya") agar konsisten.

## Catatan teknis

- Semua perubahan di `src/routes/_authenticated/dashboard.tsx` pada komponen `CriteriaPillButton`, grid kriteria, dan blok render dialog grade.
- Sumber data sudah ada: `currentNilai(k.id)` (nilai = grade x 20) dan `penilaian[].detail.grade`; tidak perlu perubahan database, RPC, maupun logika perhitungan/pengiriman.
- Aturan penguncian yang ada (sudah dikirim / mode perbaikan) tetap berlaku tanpa perubahan.
