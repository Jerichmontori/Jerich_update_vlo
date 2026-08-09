import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AnyRow = Record<string, any>;

function ringkasDetail(detail: any): string {
  if (!detail || typeof detail !== "object") return "";
  const parts: string[] = [];
  if (typeof detail.clearText === "boolean") parts.push(`Clear Text: ${detail.clearText ? "Ya" : "Tidak"}`);
  if (Array.isArray(detail.aspek)) {
    detail.aspek.forEach((a: any) => {
      const ayat: number[] = Array.isArray(a?.ayat)
        ? a.ayat.map((v: boolean, i: number) => (v ? i + 1 : 0)).filter((n: number) => n > 0)
        : [];
      if (ayat.length) parts.push(`${a?.nama ?? "-"}: ayat ${ayat.join(", ")}`);
    });
  }
  return parts.join(" | ");
}

function catatanToText(catatan: any): string {
  if (!catatan) return "";
  if (Array.isArray(catatan)) {
    return catatan
      .map((c: any) => (c?.ayat ? `Ayat ${c.ayat}: ` : "") + String(c?.teks ?? ""))
      .filter(Boolean)
      .join("\n");
  }
  return typeof catatan === "string" ? catatan : JSON.stringify(catatan);
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: AnyRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "tidak ada data" }]);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export default function BackupExcelButton() {
  const [loading, setLoading] = useState(false);

  async function handleBackup() {
    setLoading(true);
    try {
      const [p, j, k, kat, m, n, s, r, cat, sesi] = await Promise.all([
        supabase.from("peserta").select("*").order("nomor_urut"),
        supabase.from("juri_public" as any).select("*").order("nama"),
        supabase.from("kriteria").select("*"),
        supabase.from("kategori").select("*"),
        supabase.from("mazmur").select("*"),
        supabase.rpc("admin_list_penilaian" as any),
        supabase.from("penilaian_submission" as any).select("*"),
        supabase.rpc("get_ranking" as any),
        supabase.from("masukan_juri" as any).select("*"),
        supabase.from("sesi_penilaian" as any).select("*"),
      ]);

      const peserta = ((p.data ?? []) as AnyRow[]);
      const juri = ((j.data ?? []) as AnyRow[]);
      const kriteria = ((k.data ?? []) as AnyRow[]);
      const penilaian = ((n.data ?? []) as AnyRow[]);
      const submission = ((s.data ?? []) as AnyRow[]);
      const ranking = ((r.data ?? []) as AnyRow[]);
      const masukan = ((cat.data ?? []) as AnyRow[]);
      const mazmur = ((m.data ?? []) as AnyRow[]);

      const pMap = new Map(peserta.map((x) => [x.id, x]));
      const jMap = new Map(juri.map((x) => [x.id, x]));
      const kMap = new Map(kriteria.map((x) => [x.id, x]));
      const mMap = new Map(mazmur.map((x) => [x.id, x]));

      const wb = XLSX.utils.book_new();

      addSheet(wb, "Ranking", ranking.map((x, i) => ({
        Peringkat: i + 1,
        "No Urut": x.nomor_urut,
        Nama: x.nama,
        Asal: x.asal,
        "Nilai Akhir": x.nilai_akhir,
        "Total Skor": x.total_skor,
        "Rata-rata": x.rata_rata,
        "Jumlah Juri": x.jumlah_juri,
        "Status VAR": x.var_status,
        Spread: x.juri_spread,
      })));

      addSheet(wb, "Rincian Penilaian", penilaian.map((x) => {
        const ps = pMap.get(x.peserta_id);
        return {
          "No Urut": ps?.nomor_urut ?? "",
          Peserta: ps?.nama ?? x.peserta_id,
          Kategori: ps?.kategori ?? "",
          Sesi: ps?.sesi ?? "",
          Juri: jMap.get(x.juri_id)?.nama ?? x.juri_id,
          Kriteria: kMap.get(x.kriteria_id)?.nama ?? x.kriteria_id,
          Nilai: x.nilai,
          Mazmur: mMap.get(x.mazmur_id)?.bacaan ?? "",
          "Detail Perhatian": ringkasDetail(x.detail),
          Waktu: x.created_at,
        };
      }));

      addSheet(wb, "Nilai Per Juri", submission.map((x) => {
        const ps = pMap.get(x.peserta_id);
        return {
          "No Urut": ps?.nomor_urut ?? "",
          Peserta: ps?.nama ?? x.peserta_id,
          Kategori: ps?.kategori ?? "",
          Juri: jMap.get(x.juri_id)?.nama ?? x.juri_id,
          "Nilai Juri": x.nilai_cache,
          Waktu: x.created_at,
        };
      }));

      addSheet(wb, "Catatan Juri", masukan.map((x) => {
        const ps = pMap.get(x.peserta_id);
        return {
          "No Urut": ps?.nomor_urut ?? "",
          Peserta: ps?.nama ?? x.peserta_id,
          Juri: jMap.get(x.juri_id)?.nama ?? x.juri_id,
          Mazmur: mMap.get(x.mazmur_id)?.bacaan ?? "",
          Catatan: catatanToText(x.catatan),
          Waktu: x.created_at,
        };
      }));

      addSheet(wb, "Peserta", peserta.map((x) => ({
        "No Urut": x.nomor_urut, Nama: x.nama, Asal: x.asal, Kategori: x.kategori, Sesi: x.sesi, Terlambat: x.terlambat ? "Ya" : "Tidak",
      })));
      addSheet(wb, "Juri", juri.map((x) => ({
        Nama: x.nama, Jabatan: x.jabatan, Role: x.role, "Ikut Menilai": x.aktif_menilai === false ? "Tidak" : "Ya", Disetujui: x.approved ? "Ya" : "Tidak",
      })));
      addSheet(wb, "Kriteria", kriteria.map((x) => ({ Nama: x.nama, Bobot: x.bobot, "Batas Bawah": x.batas_bawah, "Batas Atas": x.batas_atas })));
      addSheet(wb, "Kategori", ((kat.data ?? []) as AnyRow[]).map((x) => ({
        Kategori: x.kategori, Bobot: x.bobot, "Batas Bawah": x.batas_bawah, "Nilai Standar": x.nilai_standart, "Nilai Tengah": x.nilai_tengah, "Batas Atas": x.batas_atas,
      })));
      addSheet(wb, "Mazmur", mazmur.map((x) => ({ Bacaan: x.bacaan, "Jumlah Ayat": x.jumlah_ayat, Kategori: x.kategori })));
      addSheet(wb, "Sesi Penilaian", ((sesi.data ?? []) as AnyRow[]).map((x) => ({
        Peserta: pMap.get(x.peserta_id)?.nama ?? x.peserta_id,
        Mazmur: mMap.get(x.mazmur_id)?.bacaan ?? "",
        Kategori: x.kategori, Status: x.status, Mulai: x.started_at, Selesai: x.ended_at,
      })));

      const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
      XLSX.writeFile(wb, `backup-penilaian-${stamp}.xlsx`);
      toast.success("Backup Excel berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat backup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleBackup} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Backup Excel
    </Button>
  );
}
