export type VarStatus = string | null | undefined;

/** Label ringkas untuk status VAR peserta (dipakai Operator & overlay vMix). */
export function varStatusLabel(status: VarStatus): string | null {
  if (!status || status === "final") return null;
  switch (status) {
    case "potensi_var":
      return "Potensi VAR";
    case "menunggu_persetujuan_juri":
    case "menunggu_persetujuan":
    case "menunggu":
      return "VAR — Menunggu Klarifikasi Juri";
    case "disetujui_juri":
    case "disetujui":
      return "VAR — Peninjauan Inspektur";
    case "ditolak_juri":
    case "ditolak":
      return "VAR — Peninjauan Inspektur";
    case "perbaikan_perhatian":
      return "VAR — Perbaikan Perhatian";
    case "keberatan_var":
      return "VAR — Tindak Lanjut Keberatan";
    case "perbaikan_var":
      return "VAR — Perbaikan Dibuka";

    default:
      return "VAR — Dalam Proses";
  }
}

/** Keterangan tahapan yang lebih panjang untuk halaman Operator. */
export function varStatusDetail(status: VarStatus): string | null {
  if (!status || status === "final") return null;
  switch (status) {
    case "potensi_var":
      return "Perbedaan penilaian terdeteksi — menunggu tindak lanjut Inspektur.";
    case "menunggu_persetujuan_juri":
    case "menunggu_persetujuan":
    case "menunggu":
      return "Menunggu klarifikasi/persetujuan juri.";
    case "disetujui_juri":
    case "ditolak_juri":
    case "disetujui":
    case "ditolak":
      return "Menunggu keputusan Inspektur VAR (IP 2).";
    case "perbaikan_perhatian":
      return "Perbaikan Perhatian & Catatan Juri sedang dibuka.";
    case "keberatan_var":
      return "Keberatan diterima — menunggu Inspektur VAR membuka perbaikan.";
    case "perbaikan_var":
      return "Perbaikan dibuka — Inspektur VAR sedang mengoreksi penilaian juri.";

    default:
      return "Kasus VAR sedang diproses.";
  }
}

export function isVarAktif(status: VarStatus): boolean {
  return !!status && status !== "final";
}
