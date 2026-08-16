import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { History, RefreshCw, Undo2 } from "lucide-react";

type Item = {
  id: string;
  peserta_id: string;
  nomor_urut: number;
  peserta_nama: string;
  jenis: string;
  juri_id: string | null;
  alasan: string | null;
  dibuka_nama: string | null;
  dibuka_at: string;
  jumlah_cadangan: number;
  ada_nilai_baru: boolean;
};

/**
 * Perbaikan yang sedang berjalan beserta cadangan nilainya.
 * mode "admin"      → tombol Batalkan Buka Perbaikan (selama belum ada nilai baru)
 * mode "inspektur"  → tombol Pulihkan Nilai Lama (dipakai bila nilai baru sudah masuk)
 */
export default function PerbaikanAktifPanel({ mode }: { mode: "admin" | "inspektur" }) {
  const [rows, setRows] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("perbaikan_aktif_list" as never);
    if (error) return;
    setRows(((data as unknown) ?? []) as Item[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 20000, true);

  async function batalkan(r: Item) {
    const alasan = window.prompt(`Batalkan buka perbaikan untuk ${r.nomor_urut}. ${r.peserta_nama}? Tulis alasan pembatalan:`);
    if (alasan === null) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("admin_batal_buka_perbaikan" as never, {
      _peserta: r.peserta_id, _alasan: alasan.trim() || null,
    } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Pembukaan perbaikan dibatalkan, nilai lama dipulihkan");
    load();
  }

  async function pulihkan(r: Item) {
    const catatan = window.prompt(`Pulihkan nilai lama untuk ${r.nomor_urut}. ${r.peserta_nama}? Tulis catatan pertanggungjawaban:`);
    if (catatan === null) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("ip2_pulihkan_nilai" as never, {
      _peserta: r.peserta_id, _catatan: catatan.trim() || null,
    } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Nilai lama dipulihkan dan tercatat sebagai bukti");
    load();
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border-sky-500/40 bg-sky-500/5">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><History className="size-5 text-sky-600" />Perbaikan Sedang Berjalan</CardTitle>
          <CardDescription>
            {mode === "admin"
              ? "Salah membuka perbaikan? Batalkan selama belum ada nilai baru yang masuk."
              : "Pemulihan nilai lama untuk perbaikan yang sudah terlanjur menerima nilai baru."}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.nomor_urut}. {r.peserta_nama}</strong>
              <Badge variant="outline">{r.jenis === "permintaan_juri" ? "Permintaan juri" : "Dibuka admin"}</Badge>
              <Badge variant="secondary">{r.jumlah_cadangan} cadangan nilai</Badge>
              {r.ada_nilai_baru
                ? <Badge variant="destructive">Sudah ada nilai baru</Badge>
                : <Badge>Belum ada nilai baru</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Dibuka oleh {r.dibuka_nama ?? "-"} · {new Date(r.dibuka_at).toLocaleString("id-ID")}
            </p>
            {r.alasan && <p className="rounded bg-muted p-2 text-xs">Alasan: {r.alasan}</p>}
            {mode === "admin" && !r.ada_nilai_baru && (
              <Button size="sm" variant="outline" className="gap-2" disabled={busy === r.id} onClick={() => batalkan(r)}>
                <Undo2 className="size-4" />Batalkan Buka Perbaikan
              </Button>
            )}
            {mode === "admin" && r.ada_nilai_baru && (
              <p className="text-xs text-destructive">
                Nilai baru sudah masuk — lanjutkan perbaikan sampai selesai, atau minta Inspektur Pertandingan memulihkan nilai lama.
              </p>
            )}
            {mode === "inspektur" && (
              <Button size="sm" variant="outline" className="gap-2" disabled={busy === r.id} onClick={() => pulihkan(r)}>
                <Undo2 className="size-4" />Pulihkan Nilai Lama
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
