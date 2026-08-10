import { usePolling } from "@/hooks/usePolling";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Radio, CheckCircle2, XCircle } from "lucide-react";

type Pending = {
  sesi_no: number;
  status: string;
  requested_at: string | null;
  sudah_vote: boolean;
  peserta: { nomor_urut: number; nama: string }[];
};

export default function JuriLiveRankingApproval() {
  const [rows, setRows] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("juri_live_ranking_pending" as any);
    if (error) return;
    setRows((data as unknown as Pending[]) ?? []);
  }, []);

  usePolling(load, 20000);


  async function vote(sesi: number, setuju: boolean) {
    setBusy(sesi);
    const { error } = await supabase.rpc("juri_vote_live_ranking" as any, { _sesi: sesi, _setuju: setuju });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(setuju ? `Anda menyetujui penayangan Sesi ${sesi}.` : `Anda menolak penayangan Sesi ${sesi}.`);
    load();
  }

  // Hanya tampilkan permintaan yang sedang berlangsung (belum divote juri ini),
  // dan ambil sesi terbaru saja.
  const aktif = rows
    .filter((r) => !r.sudah_vote && r.status === "menunggu_persetujuan")
    .sort((a, b) => {
      const at = a.requested_at ? Date.parse(a.requested_at) : 0;
      const bt = b.requested_at ? Date.parse(b.requested_at) : 0;
      if (bt !== at) return bt - at;
      return b.sesi_no - a.sesi_no;
    })
    .slice(0, 1);

  if (aktif.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {aktif.map((r) => (
        <Card key={r.sesi_no} className="border-2 border-amber-500/60 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4 text-amber-600" /> Persetujuan Live Ranking — Sesi {r.sesi_no}
            </CardTitle>
            <CardDescription>
              Inspektur mengajukan penayangan hasil Sesi {r.sesi_no} (peserta no.{" "}
              {r.peserta[0]?.nomor_urut}–{r.peserta[r.peserta.length - 1]?.nomor_urut}) ke Live Ranking publik.
              Live Ranking hanya tayang bila seluruh juri menyetujui.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {r.sudah_vote ? (
              <Badge className="bg-emerald-600 text-white">Suara Anda sudah tercatat</Badge>
            ) : (
              <>
                <Button size="sm" disabled={busy === r.sesi_no} onClick={() => vote(r.sesi_no, true)}>
                  <CheckCircle2 className="size-4 mr-1" /> Setuju Tayangkan
                </Button>
                <Button size="sm" variant="destructive" disabled={busy === r.sesi_no} onClick={() => vote(r.sesi_no, false)}>
                  <XCircle className="size-4 mr-1" /> Tolak
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
