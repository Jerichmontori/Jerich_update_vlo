import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RefreshCw, Undo2 } from "lucide-react";

type Row = {
  id: string;
  peserta_id: string;
  pemohon_nama: string | null;
  alasan: string;
  status: string;
  admin_nama: string | null;
  catatan_admin: string | null;
  created_at: string;
  diputus_at: string | null;
  digunakan_at: string | null;
  peserta?: { nomor_urut: number; nama: string } | null;
};

const TONE: Record<string, string> = {
  menunggu: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  disetujui: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  ditolak: "bg-rose-500/15 text-rose-700 border-rose-500/40",
};

/** Daftar pengajuan Peninjauan Kembali. Admin dapat menyetujui / menolak. */
export default function PeninjauanTab({ canDecide = false }: { canDecide?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("peninjauan_kembali" as never)
      .select("*, peserta:peserta_id(nomor_urut, nama)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error("Gagal memuat pengajuan"); return; }
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 30000, true);

  async function putuskan(id: string, setuju: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_putuskan_peninjauan" as never, {
      _id: id, _setuju: setuju, _catatan: (catatan[id] ?? "").trim() || null,
    } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(setuju ? "Peninjauan disetujui" : "Peninjauan ditolak");
    load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Undo2 className="size-5" />Peninjauan Kembali</CardTitle>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Diajukan Inspektur VAR ketika nilai peserta sudah final namun perlu dikoreksi.
          Persetujuan admin membuka satu kali hak koreksi.
        </p>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.peserta ? `${r.peserta.nomor_urut}. ${r.peserta.nama}` : "-"}</strong>
              <Badge variant="outline" className={TONE[r.status] ?? ""}>{r.status}</Badge>
              {r.digunakan_at && <Badge variant="secondary">sudah dipakai</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("id-ID")}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.alasan}</p>
            <p className="text-xs text-muted-foreground">Pemohon: {r.pemohon_nama ?? "-"}</p>
            {r.catatan_admin && <p className="rounded bg-muted p-2 text-xs">Catatan admin: {r.catatan_admin}</p>}
            {canDecide && r.status === "menunggu" && (
              <div className="space-y-2 pt-1">
                <Textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Catatan admin (opsional)"
                  value={catatan[r.id] ?? ""}
                  onChange={(e) => setCatatan((s) => ({ ...s, [r.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => putuskan(r.id, true)}>Setujui</Button>
                  <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => putuskan(r.id, false)}>Tolak</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
