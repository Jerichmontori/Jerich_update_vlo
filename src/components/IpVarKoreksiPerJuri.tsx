import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Save } from "lucide-react";

type Aspek = { nama?: string; ayat?: boolean[]; ditandai?: (number | string)[] };
type JuriDetail = { juri_id: string; label: string; clear_text: boolean | null; aspek: Aspek[] };

const LABELS = ["salah_kata", "menambah_kata", "mengurangi_kata", "mengulang_kata"] as const;
const LABEL_UI = ["Salah kata", "Menambah kata", "Mengurangi kata", "Mengulang kata"];

type MarkSets = [Set<number>, Set<number>, Set<number>, Set<number>];
type Draft = { clear: boolean | null; marks: MarkSets };

function emptyMarks(): MarkSets {
  return [new Set(), new Set(), new Set(), new Set()];
}

/**
 * Koreksi VAR per juri oleh Inspektur VAR: mengubah 4 parameter penyebab VAR
 * untuk setiap juri secara terpisah, lalu menghitung ulang & menyimpan bukti.
 */
export default function IpVarKoreksiPerJuri({
  pesertaId,
  judul,
  onClose,
  onDone,
}: {
  pesertaId: string;
  judul: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [detail, setDetail] = useState<JuriDetail[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("var_detail_persepsi" as never, { _peserta: pesertaId } as never);
      if (error) { toast.error(error.message); return; }
      const juri = (((data as Record<string, unknown>)?.["juri"] ?? []) as JuriDetail[]);
      setDetail(juri);
      const next: Record<string, Draft> = {};
      for (const j of juri) {
        const marks: MarkSets = emptyMarks();
        for (let i = 0; i < 4; i++) {
          for (const n of (j.aspek?.[i]?.ditandai ?? []).map(Number).filter(Number.isFinite)) marks[i]!.add(n);
        }
        next[j.juri_id] = { clear: j.clear_text, marks };
      }
      setDrafts(next);
    })();
  }, [pesertaId]);

  const jumlahAyat = useMemo(() => {
    let m = 0;
    for (const j of detail) for (const a of j.aspek ?? []) m = Math.max(m, a.ayat?.length ?? 0);
    return m;
  }, [detail]);

  function setClear(juriId: string, v: boolean) {
    setDrafts((s) => ({ ...s, [juriId]: { ...(s[juriId] ?? { clear: null, marks: emptyMarks() }), clear: v } }));
  }

  function toggle(juriId: string, i: number, n: number) {
    setDrafts((s) => {
      const cur = s[juriId] ?? { clear: null, marks: emptyMarks() };
      const marks = cur.marks.map((m) => new Set(m)) as MarkSets;
      if (marks[i]!.has(n)) marks[i]!.delete(n); else marks[i]!.add(n);
      return { ...s, [juriId]: { ...cur, marks } };
    });
  }

  async function simpan() {
    if (catatan.trim().length < 5) { toast.error("Alasan/dasar keputusan wajib diisi"); return; }
    setBusy(true);
    const perJuri = detail.map((j) => {
      const d = drafts[j.juri_id];
      const item: Record<string, unknown> = { juri_id: j.juri_id, clear_text: d?.clear ?? null };
      LABELS.forEach((k, i) => { item[k] = [...(d?.marks[i] ?? [])].sort((a, b) => a - b); });
      return item;
    });
    const { error } = await supabase.rpc("ip2_koreksi_per_juri" as never, {
      _peserta: pesertaId, _perjuri: perJuri, _catatan: catatan.trim(),
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Koreksi per juri tersimpan & nilai dihitung ulang");
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="size-5" />Koreksi per Juri — {judul}</DialogTitle>
          <DialogDescription>
            Ubah status Clear Text (satu-satunya pemicu VAR) serta penandaan ayat (salah, menambah, mengurangi, mengulang kata) untuk tiap juri.
            Nilai sebelum &amp; sesudah disimpan sebagai bukti pertanggungjawaban.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {detail.length === 0 && <p className="text-sm text-muted-foreground">Data penilaian juri belum tersedia.</p>}

          {detail.map((j) => {
            const d = drafts[j.juri_id];
            return (
              <div key={j.juri_id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">{j.label}</strong>
                  <Badge variant="outline">Clear Text: {d?.clear === null || d?.clear === undefined ? "—" : d.clear ? "Ya" : "Tidak"}</Badge>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant={d?.clear === true ? "default" : "outline"} onClick={() => setClear(j.juri_id, true)}>Ya (clear)</Button>
                  <Button size="sm" variant={d?.clear === false ? "default" : "outline"} onClick={() => setClear(j.juri_id, false)}>Tidak clear</Button>
                </div>

                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">{LABEL_UI[i]}</Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: jumlahAyat }, (_, k) => k + 1).map((n) => {
                        const on = d?.marks[i]?.has(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggle(j.juri_id, i, n)}
                            className={`size-7 rounded border text-xs ${on ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background hover:bg-muted"}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                      {jumlahAyat === 0 && <span className="text-xs text-muted-foreground">Data ayat belum tersedia.</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="space-y-2">
            <Label>Alasan / dasar keputusan</Label>
            <Textarea rows={3} maxLength={1000} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </div>

          <Button className="w-full gap-2" disabled={busy || detail.length === 0} onClick={simpan}>
            <Save className="size-4" />Simpan Koreksi &amp; Hitung Ulang
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
