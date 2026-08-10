import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RefreshCw, FileWarning } from "lucide-react";
import KeberatanDeadlineSetting from "@/components/KeberatanDeadlineSetting";

type Row = {
  id: string;
  nomor_tiket: string;
  peserta_id: string;
  jenis: string;
  uraian: string;
  nama_pengaju: string;
  hubungan: string | null;
  kontak: string | null;
  status: string;
  keputusan: string | null;
  catatan_ip: string | null;
  created_at: string;
  peserta?: { nomor_urut: number; nama: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  baru: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  ditinjau: "bg-blue-500/15 text-blue-700 border-blue-500/40",
  diterima: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  ditolak: "bg-rose-500/15 text-rose-700 border-rose-500/40",
};

/** Daftar keberatan + keputusan IP (khusus admin & Inspektur VAR). */
export default function KeberatanTab({ canDecide = true, canConfig = false }: { canDecide?: boolean; canConfig?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("keberatan" as never)
      .select("*, peserta:peserta_id(nomor_urut, nama)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Gagal memuat keberatan");
      return;
    }
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 30000, true);

  async function putuskan(id: string, keputusan: "diterima" | "ditolak" | "ditinjau") {
    const note = (catatan[id] ?? "").trim();
    if (keputusan !== "ditinjau" && note.length < 5) {
      toast.error("Catatan keputusan wajib diisi (minimal 5 karakter)");
      return;
    }
    setBusy(id);
    const { error } = await supabase.rpc("ip_putuskan_keberatan" as never, {
      _id: id, _keputusan: keputusan, _catatan: note || null,
    } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Keputusan tersimpan");
    load();
  }

  return (
    <div className="space-y-4">
    {canConfig && <KeberatanDeadlineSetting />}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileWarning className="size-5" />Pengajuan Keberatan</CardTitle>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Peserta / pendamping mengajukan lewat halaman publik <code>/keberatan</code>.
        </p>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengajuan keberatan.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tracking-wide">{r.nomor_tiket}</span>
              <Badge variant="outline" className={STATUS_TONE[r.status] ?? ""}>{r.status}</Badge>
              <Badge variant="secondary">{r.jenis}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("id-ID")}
              </span>
            </div>
            <p className="text-sm">
              Peserta: <strong>{r.peserta ? `${r.peserta.nomor_urut}. ${r.peserta.nama}` : "-"}</strong>
            </p>
            <p className="whitespace-pre-wrap text-sm">{r.uraian}</p>
            <p className="text-xs text-muted-foreground">
              Pengaju: {r.nama_pengaju}{r.hubungan ? ` (${r.hubungan})` : ""}{r.kontak ? ` — ${r.kontak}` : ""}
            </p>
            {r.catatan_ip && (
              <p className="rounded bg-muted p-2 text-xs">Catatan IP: {r.catatan_ip}</p>
            )}
            {canDecide && r.status !== "diterima" && r.status !== "ditolak" && (
              <div className="space-y-2 pt-1">
                <Textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Catatan keputusan"
                  value={catatan[r.id] ?? ""}
                  onChange={(e) => setCatatan((s) => ({ ...s, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => putuskan(r.id, "ditinjau")}>
                    Tandai Ditinjau
                  </Button>
                  <Button size="sm" disabled={busy === r.id} onClick={() => putuskan(r.id, "diterima")}>
                    Terima
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => putuskan(r.id, "ditolak")}>
                    Tolak
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}
