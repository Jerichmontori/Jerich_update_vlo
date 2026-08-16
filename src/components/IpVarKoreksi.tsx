import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VarPersepsiDetail from "@/components/VarPersepsiDetail";
import IpVarKoreksiPerJuri from "@/components/IpVarKoreksiPerJuri";
import { toast } from "sonner";
import { RefreshCw, Gavel, FileText, Undo2, Users } from "lucide-react";


type VarRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
  status: string;
  bacaan: string | null;
  juri_berbeda: number;
  detected_at: string | null;
};

type Aspek = { nama?: string; ayat?: boolean[]; ditandai?: (number | string)[] };
type JuriDetail = { juri_id: string; label: string; clear_text: boolean | null; aspek: Aspek[] };

const LABELS = ["salah_kata", "menambah_kata", "mengurangi_kata", "mengulang_kata"] as const;
const LABEL_UI = ["Salah kata", "Menambah kata", "Mengurangi kata", "Mengulang kata"];

/** Antrean VAR untuk Inspektur VAR (IP 2): koreksi Clear Text + 4 komponen penandaan ayat. */
export default function IpVarKoreksi({ canDecide = true }: { canDecide?: boolean }) {
  const [rows, setRows] = useState<VarRow[]>([]);
  const [open, setOpen] = useState<VarRow | null>(null);
  const [perJuri, setPerJuri] = useState<VarRow | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("inspektur_list_var" as never);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as unknown as VarRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 20000, true);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Gavel className="size-5" />Antrean VAR</CardTitle>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="size-4" />Muat ulang</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada kasus VAR.</p>}
        {rows.map((r) => (
          <div key={r.peserta_id} className="rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.nomor_urut}. {r.nama}</strong>
              {r.kategori && <Badge variant="secondary">{r.kategori}</Badge>}
              <Badge variant="outline">{r.status}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">{r.bacaan ?? "-"}</span>
            </div>
            <VarPersepsiDetail pesertaId={r.peserta_id} tone="amber" />
            <div className="flex flex-wrap gap-2 pt-1">
              {canDecide && (
                <Button size="sm" onClick={() => setOpen(r)} className="gap-2">
                  <Gavel className="size-4" />Koreksi &amp; Putuskan
                </Button>
              )}
              {canDecide && (
                <Button size="sm" variant="secondary" onClick={() => setPerJuri(r)} className="gap-2">
                  <Users className="size-4" />Koreksi per Juri
                </Button>
              )}
              <BeritaAcaraButton pesertaId={r.peserta_id} />
            </div>
          </div>
        ))}
      </CardContent>

      {open && (
        <KoreksiDialog
          row={open}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); load(); }}
        />
      )}

      {perJuri && (
        <IpVarKoreksiPerJuri
          pesertaId={perJuri.peserta_id}
          judul={`${perJuri.nomor_urut}. ${perJuri.nama}`}
          onClose={() => setPerJuri(null)}
          onDone={() => { setPerJuri(null); load(); }}
        />
      )}
    </Card>
  );
}


function KoreksiDialog({ row, onClose, onDone }: { row: VarRow; onClose: () => void; onDone: () => void }) {
  const [detail, setDetail] = useState<JuriDetail[]>([]);
  const [clear, setClear] = useState<boolean | null>(null);
  const [marks, setMarks] = useState<Record<number, Set<number>>>({ 0: new Set(), 1: new Set(), 2: new Set() });
  const [catatan, setCatatan] = useState("");
  const [alasanPk, setAlasanPk] = useState("");
  const [busy, setBusy] = useState(false);
  const [needPk, setNeedPk] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("var_detail_persepsi" as never, { _peserta: row.peserta_id } as never);
      if (error) { toast.error(error.message); return; }
      const juri = (((data as Record<string, unknown>)?.["juri"] ?? []) as JuriDetail[]);
      setDetail(juri);
      // prefill: mayoritas juri
      const half = juri.length / 2;
      const ya = juri.filter((j) => j.clear_text === true).length;
      setClear(juri.length ? ya > half : null);
      const next: Record<number, Set<number>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };
      for (let i = 0; i < 4; i++) {
        const tally = new Map<number, number>();
        for (const j of juri) {
          for (const n of (j.aspek?.[i]?.ditandai ?? []).map(Number).filter(Number.isFinite)) {
            tally.set(n, (tally.get(n) ?? 0) + 1);
          }
        }
        for (const [n, c] of tally) if (c > half) next[i]!.add(n);
      }
      setMarks(next);
    })();
  }, [row.peserta_id]);

  const jumlahAyat = useMemo(() => {
    let m = 0;
    for (const j of detail) for (const a of j.aspek ?? []) m = Math.max(m, a.ayat?.length ?? 0);
    return m;
  }, [detail]);

  function toggle(i: number, n: number) {
    setMarks((s) => {
      const set = new Set(s[i] ?? []);
      if (set.has(n)) set.delete(n); else set.add(n);
      return { ...s, [i]: set };
    });
  }

  async function simpan() {
    if (catatan.trim().length < 5) { toast.error("Alasan/catatan keputusan wajib diisi"); return; }
    setBusy(true);
    const koreksi: Record<string, number[]> = {};
    LABELS.forEach((k, i) => { koreksi[k] = [...(marks[i] ?? [])].sort((a, b) => a - b); });
    const { error } = await supabase.rpc("ip2_putuskan_var" as never, {
      _peserta: row.peserta_id, _clear: clear, _koreksi: koreksi, _catatan: catatan.trim(),
    } as never);
    setBusy(false);
    if (error) {
      if (error.message.includes("Peninjauan Kembali")) setNeedPk(true);
      toast.error(error.message);
      return;
    }
    toast.success("Keputusan VAR diterapkan & nilai dihitung ulang");
    onDone();
  }

  async function ajukanPk() {
    if (alasanPk.trim().length < 5) { toast.error("Alasan peninjauan wajib diisi"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("ip2_ajukan_peninjauan" as never, {
      _peserta: row.peserta_id, _alasan: alasanPk.trim(),
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengajuan peninjauan kembali dikirim ke admin");
    setNeedPk(false);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Koreksi VAR — {row.nomor_urut}. {row.nama}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Clear Text</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={clear === true ? "default" : "outline"} onClick={() => setClear(true)}>Ya (clear)</Button>
              <Button size="sm" variant={clear === false ? "default" : "outline"} onClick={() => setClear(false)}>Tidak clear</Button>
            </div>
          </div>

          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Label>{LABEL_UI[i]}</Label>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: jumlahAyat }, (_, k) => k + 1).map((n) => {
                  const on = marks[i]?.has(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggle(i, n)}
                      className={`size-8 rounded border text-xs ${on ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background hover:bg-muted"}`}
                    >
                      {n}
                    </button>
                  );
                })}
                {jumlahAyat === 0 && <span className="text-xs text-muted-foreground">Data ayat belum tersedia.</span>}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Alasan / dasar keputusan</Label>
            <Textarea rows={3} maxLength={1000} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </div>

          <Button className="w-full gap-2" disabled={busy} onClick={simpan}>
            <Gavel className="size-4" />Terapkan Keputusan
          </Button>

          {needPk && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm">Nilai peserta sudah final. Ajukan Peninjauan Kembali ke admin.</p>
              <Textarea rows={2} maxLength={1000} placeholder="Alasan peninjauan kembali" value={alasanPk} onChange={(e) => setAlasanPk(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy} onClick={ajukanPk} className="gap-2">
                <Undo2 className="size-4" />Ajukan Peninjauan Kembali
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cetak berita acara satu kasus VAR. */
export function BeritaAcaraButton({ pesertaId }: { pesertaId: string }) {
  const [busy, setBusy] = useState(false);

  async function cetak() {
    setBusy(true);
    const { data, error } = await supabase.rpc("var_berita_acara" as never, { _peserta: pesertaId } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup diblokir browser"); return; }
    const json = JSON.stringify(data, null, 2);
    const p = (data as Record<string, Record<string, unknown>>)?.["peserta"] ?? {};
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>Berita Acara VAR</title>
      <style>body{font-family:Georgia,serif;padding:32px;max-width:800px;margin:auto}
      h1{font-size:18px;text-align:center;text-transform:uppercase}
      pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11px;background:#f7f7f7;padding:12px;border:1px solid #ddd}
      .sig{display:flex;justify-content:space-between;margin-top:64px;text-align:center}
      .sig div{width:45%}</style></head><body>
      <h1>Berita Acara Penyelesaian VAR</h1>
      <p>Peserta: <b>${String(p["nomor_urut"] ?? "")}. ${String(p["nama"] ?? "")}</b><br>
      Kategori: ${String(p["kategori"] ?? "-")}<br>
      Dicetak: ${new Date().toLocaleString("id-ID")}</p>
      <h3>Rincian Kasus</h3>
      <pre>${json.replace(/[<>]/g, "")}</pre>
      <div class="sig"><div>Inspektur VAR<br><br><br>__________________</div>
      <div>Ketua Dewan Juri<br><br><br>__________________</div></div>
      </body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={cetak} className="gap-2">
      <FileText className="size-4" />Berita Acara
    </Button>
  );
}
