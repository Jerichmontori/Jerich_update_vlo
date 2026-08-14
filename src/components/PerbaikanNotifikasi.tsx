import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, RefreshCw, Unlock } from "lucide-react";

type Item = {
  keberatan_id: string;
  nomor_tiket: string;
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  uraian: string;
  catatan_ip: string | null;
  diputus_at: string | null;
  perbaikan_dibuka_at: string | null;
  perbaikan_selesai_at: string | null;
  var_status: string | null;
};

/**
 * Pemberitahuan keberatan yang diterima dengan tindak lanjut VAR.
 * Admin hanya melihat; tombol "Buka Perbaikan" khusus Inspektur VAR (canOpen).
 */
export default function PerbaikanNotifikasi({ canOpen = false }: { canOpen?: boolean }) {
  const [rows, setRows] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_notifikasi_perbaikan" as never);
    if (error) return;
    setRows(((data as unknown) ?? []) as Item[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 20000, true);

  async function buka(pesertaId: string) {
    setBusy(pesertaId);
    const { error } = await supabase.rpc("ip2_buka_perbaikan" as never, {
      _peserta: pesertaId, _catatan: "Perbaikan dibuka atas keberatan yang diterima",
    } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Perbaikan dibuka — peserta masuk antrean VAR");
    load();
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><BellRing className="size-5 text-amber-600" />Pemberitahuan Perbaikan (Keberatan → VAR)</CardTitle>
          <CardDescription>
            {canOpen
              ? "Buka perbaikan lalu koreksi penilaian juri pada antrean VAR."
              : "Perbaikan hanya dapat dibuka melalui menu Inspektur VAR."}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.keberatan_id} className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tracking-wide">{r.nomor_tiket}</span>
              <strong>{r.nomor_urut}. {r.nama}</strong>
              <Badge variant="outline">{r.perbaikan_dibuka_at ? "Perbaikan dibuka" : "Menunggu dibuka"}</Badge>
              {r.var_status && <Badge variant="secondary">{r.var_status}</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.uraian}</p>
            {r.catatan_ip && <p className="rounded bg-muted p-2 text-xs">Catatan IP: {r.catatan_ip}</p>}
            {canOpen && !r.perbaikan_dibuka_at && (
              <Button size="sm" className="gap-2" disabled={busy === r.peserta_id} onClick={() => buka(r.peserta_id)}>
                <Unlock className="size-4" />Buka Perbaikan
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
