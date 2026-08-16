import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, MailQuestion, RefreshCw, X } from "lucide-react";

type Item = {
  id: string;
  peserta_id: string;
  nomor_urut: number;
  peserta_nama: string;
  juri_id: string;
  juri_nama: string | null;
  alasan: string;
  created_at: string;
  var_aktif: boolean;
};

/** Daftar permintaan perbaikan nilai dari juri (jalur 1) untuk diputus admin. */
export default function PermintaanPerbaikanJuri() {
  const [rows, setRows] = useState<Item[]>([]);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_permintaan_perbaikan" as never);
    if (error) return;
    setRows(((data as unknown) ?? []) as Item[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 20000, true);

  async function putuskan(r: Item, setuju: boolean) {
    if (setuju && !confirm(`Setujui perbaikan untuk ${r.nomor_urut}. ${r.peserta_nama}? Hanya kiriman juri ${r.juri_nama ?? ""} yang dibuka kembali.`)) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("admin_putuskan_perbaikan_juri" as never, {
      _id: r.id, _setuju: setuju, _catatan: catatan[r.id]?.trim() || null,
    } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(setuju ? "Perbaikan dibuka untuk juri pemohon" : "Permintaan ditolak");
    setCatatan((c) => ({ ...c, [r.id]: "" }));
    load();
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MailQuestion className="size-5 text-primary" />
            Permintaan Perbaikan Juri
            <Badge variant="secondary">{rows.length} menunggu</Badge>
          </CardTitle>
          <CardDescription>Juri meminta membuka kembali penilaian karena salah input. Hanya kiriman juri pemohon yang dibuka.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.nomor_urut}. {r.peserta_nama}</strong>
              <Badge variant="outline">Juri: {r.juri_nama ?? "-"}</Badge>
              {r.var_aktif && <Badge variant="destructive">Sedang ditangani VAR</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.alasan}</p>
            <Textarea
              rows={2}
              placeholder="Catatan admin (opsional)"
              value={catatan[r.id] ?? ""}
              onChange={(e) => setCatatan((c) => ({ ...c, [r.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" disabled={busy === r.id || r.var_aktif} onClick={() => putuskan(r, true)}>
                <Check className="size-4" />Setujui &amp; Buka
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={busy === r.id} onClick={() => putuskan(r, false)}>
                <X className="size-4" />Tolak
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
