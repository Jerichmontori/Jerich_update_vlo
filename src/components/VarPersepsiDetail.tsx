import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

type Aspek = { nama?: string; ditandai?: (number | string)[] };
type JuriDetail = {
  juri_id: string;
  label: string;
  is_me: boolean;
  clear_text: boolean | null;
  aspek: Aspek[];
};

const ASPEK_NAMA = ["Salah kata", "Menambah kata", "Mengurangi kata"];

function ayatList(a?: Aspek): string {
  const d = a?.ditandai ?? [];
  if (!Array.isArray(d) || d.length === 0) return "—";
  return d.map((x) => `Ayat ${x}`).join(", ");
}

/** Rincian jawaban Perhatian tiap juri (label anonim) agar juri bisa menyamakan persepsi. */
export default function VarPersepsiDetail({
  pesertaId,
  tone = "rose",
}: {
  pesertaId: string;
  tone?: "rose" | "amber";
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<JuriDetail[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("var_detail_persepsi" as any, { _peserta: pesertaId });
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setErr(null);
    setRows((((data as any)?.juri ?? []) as JuriDetail[]) ?? []);
  }, [pesertaId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [open, load]);

  const border = tone === "amber" ? "border-amber-500/40" : "border-rose-500/40";
  const head = tone === "amber" ? "text-amber-900" : "text-rose-900";

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline ${head}`}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Lihat rincian perbedaan per juri
      </button>

      {open && (
        <div className={`mt-2 rounded-xl border ${border} bg-background/70 p-3`}>
          {err ? (
            <div className="text-xs text-muted-foreground">Tidak dapat memuat rincian: {err}</div>
          ) : rows === null ? (
            <div className="text-xs text-muted-foreground">Memuat…</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-muted-foreground">Belum ada data penilaian.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Juri</th>
                    <th className="py-1 pr-3 font-medium">Clear Text</th>
                    {ASPEK_NAMA.map((n) => (
                      <th key={n} className="py-1 pr-3 font-medium">{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.juri_id} className="border-t align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap font-medium">
                        {r.label}
                        {r.is_me && <Badge variant="secondary" className="ml-1">Anda</Badge>}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {r.clear_text == null ? "—" : r.clear_text ? "Ya" : "Tidak"}
                      </td>
                      {ASPEK_NAMA.map((n, i) => (
                        <td key={n} className="py-1.5 pr-3">{ayatList(r.aspek?.[i])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Nama juri lain disamarkan. Bandingkan ayat yang ditandai, lalu samakan persepsi saat Perbaikan dibuka Inspektur.
            </p>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="size-3.5 mr-1" /> Muat ulang
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
