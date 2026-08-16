import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, RefreshCw } from "lucide-react";

type Riwayat = {
  id: string;
  nomor_urut: number;
  nama: string;
  alasan: string;
  status: string;
  catatan_admin: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  menunggu_perbaikan_juri: "Menunggu admin",
  disetujui_perbaikan_juri: "Disetujui — silakan nilai ulang",
  ditolak_perbaikan_juri: "Ditolak",
  dibatalkan_admin: "Dibatalkan admin",
};

/** Form juri untuk meminta admin membuka kembali penilaian yang sudah dikirim. */
export default function JuriAjukanPerbaikan() {
  const [peserta, setPeserta] = useState<{ id: string; nomor_urut: number; nama: string }[]>([]);
  const [pid, setPid] = useState("");
  const [alasan, setAlasan] = useState("");
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: prof } = await supabase.from("profiles").select("juri_id").eq("id", uid).maybeSingle();
    const juriId = prof?.juri_id;
    if (!juriId) return;

    const { data: subs } = await supabase.from("penilaian_submission").select("peserta_id").eq("juri_id", juriId);
    const ids = (subs ?? []).map((s) => s.peserta_id);
    if (ids.length > 0) {
      const { data: ps } = await supabase.from("peserta").select("id,nomor_urut,nama").in("id", ids).order("nomor_urut");
      setPeserta((ps ?? []) as never);
    } else {
      setPeserta([]);
    }

    const { data: rw } = await supabase.rpc("juri_permintaan_perbaikan_saya" as never);
    setRiwayat(((rw as unknown) ?? []) as Riwayat[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ajukan() {
    if (!pid) return toast.error("Pilih peserta terlebih dahulu");
    if (!alasan.trim()) return toast.error("Alasan wajib diisi");
    setBusy(true);
    const { error } = await supabase.rpc("juri_ajukan_perbaikan" as never, {
      _peserta: pid, _alasan: alasan.trim(),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Permintaan perbaikan dikirim ke admin");
    setPid(""); setAlasan("");
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ajukan Perbaikan Penilaian</CardTitle>
          <CardDescription>Gunakan bila Anda salah memasukkan nilai pada peserta yang sudah dikirim. Admin akan memutuskan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={pid} onValueChange={setPid}>
            <SelectTrigger><SelectValue placeholder="Pilih peserta yang sudah dinilai" /></SelectTrigger>
            <SelectContent>
              {peserta.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nomor_urut}. {p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={3} placeholder="Alasan perbaikan (wajib)" value={alasan} onChange={(e) => setAlasan(e.target.value)} />
          <div className="flex gap-2">
            <Button className="gap-2" disabled={busy} onClick={ajukan}><Send className="size-4" />Kirim Permintaan</Button>
            <Button variant="outline" className="gap-2" onClick={load}><RefreshCw className="size-4" />Muat ulang</Button>
          </div>
        </CardContent>
      </Card>

      {riwayat.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Riwayat Permintaan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {riwayat.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{r.nomor_urut}. {r.nama}</strong>
                  <Badge variant={r.status === "disetujui_perbaikan_juri" ? "default" : "outline"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.alasan}</p>
                {r.catatan_admin && <p className="rounded bg-muted p-2 text-xs">Catatan admin: {r.catatan_admin}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
