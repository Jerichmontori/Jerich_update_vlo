import { usePolling } from "@/hooks/usePolling";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronRight, BarChart3, Table2 } from "lucide-react";

type Aspek = { nama?: string; ditandai?: (number | string)[] };
type JuriDetail = {
  juri_id: string;
  label: string;
  is_me: boolean;
  clear_text: boolean | null;
  aspek: Aspek[];
};

const ASPEK_NAMA = ["Salah kata", "Menambah kata", "Mengurangi kata", "Mengulang kata"];

function marks(a?: Aspek): number[] {
  const d = a?.ditandai ?? [];
  if (!Array.isArray(d)) return [];
  return d.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function ayatList(a?: Aspek): string {
  const m = marks(a);
  return m.length === 0 ? "—" : m.map((x) => `Ayat ${x}`).join(", ");
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
  const [mode, setMode] = useState<"viz" | "tabel">("viz");
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
    setRows(((data as any)?.juri ?? []) as JuriDetail[]);
  }, [pesertaId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  usePolling(load, 20000, open);

  const data = rows ?? [];

  /** Ayat maksimum yang pernah ditandai (untuk lebar grid). */
  const maxAyat = useMemo(() => {
    let m = 0;
    for (const r of data) for (const a of r.aspek ?? []) for (const n of marks(a)) m = Math.max(m, n);
    return m;
  }, [data]);

  const clearYa = data.filter((r) => r.clear_text === true);
  const clearTidak = data.filter((r) => r.clear_text === false);
  const clearKosong = data.filter((r) => r.clear_text == null);
  const totalJuri = data.length;
  const clearBeda = clearYa.length > 0 && clearTidak.length > 0;

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
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setMode("viz")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${mode === "viz" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <BarChart3 className="size-3.5" /> Visual
              </button>
              <button
                type="button"
                onClick={() => setMode("tabel")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${mode === "tabel" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Table2 className="size-3.5" /> Tabel
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="size-3.5 mr-1" /> Muat ulang
            </Button>
          </div>

          {err ? (
            <div className="text-xs text-muted-foreground">Tidak dapat memuat rincian: {err}</div>
          ) : rows === null ? (
            <div className="text-xs text-muted-foreground">Memuat…</div>
          ) : data.length === 0 ? (
            <div className="text-xs text-muted-foreground">Belum ada data penilaian.</div>
          ) : mode === "tabel" ? (
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
                  {data.map((r) => (
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
          ) : (
            <div className="space-y-4">
              {/* Clear Text — bar konsensus */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Clear Text
                  </span>
                  {clearBeda ? (
                    <Badge variant="destructive" className="text-[10px]">Berbeda</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Sepakat</Badge>
                  )}
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-md border bg-muted">
                  {clearYa.length > 0 && (
                    <div
                      className="flex items-center justify-center bg-primary text-[10px] font-semibold text-primary-foreground"
                      style={{ width: `${(clearYa.length / totalJuri) * 100}%` }}
                    >
                      Ya {clearYa.length}
                    </div>
                  )}
                  {clearTidak.length > 0 && (
                    <div
                      className="flex items-center justify-center bg-destructive text-[10px] font-semibold text-destructive-foreground"
                      style={{ width: `${(clearTidak.length / totalJuri) * 100}%` }}
                    >
                      Tidak {clearTidak.length}
                    </div>
                  )}
                  {clearKosong.length > 0 && (
                    <div
                      className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                      style={{ width: `${(clearKosong.length / totalJuri) * 100}%` }}
                    >
                      ? {clearKosong.length}
                    </div>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.map((r) => (
                    <span
                      key={r.juri_id}
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        r.clear_text === true
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : r.clear_text === false
                            ? "border-destructive/40 bg-destructive/10 text-foreground"
                            : "text-muted-foreground"
                      } ${r.is_me ? "font-bold ring-1 ring-ring" : ""}`}
                    >
                      {r.label}
                      {r.is_me ? " (Anda)" : ""}: {r.clear_text == null ? "—" : r.clear_text ? "Ya" : "Tidak"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Peta ayat per aspek */}
              {ASPEK_NAMA.map((nama, idx) => {
                const perAyat: Record<number, JuriDetail[]> = {};
                for (const r of data) {
                  for (const n of marks(r.aspek?.[idx])) {
                    (perAyat[n] ||= []).push(r);
                  }
                }
                const ditandaiAda = Object.keys(perAyat).length > 0;
                const adaBeda = Object.values(perAyat).some((v) => v.length !== totalJuri);
                const kolom = Math.max(maxAyat, ...Object.keys(perAyat).map(Number), 0);

                return (
                  <div key={nama}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {nama}
                      </span>
                      {ditandaiAda && (
                        adaBeda ? (
                          <Badge variant="destructive" className="text-[10px]">Berbeda</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Sepakat</Badge>
                        )
                      )}
                    </div>
                    {!ditandaiAda ? (
                      <p className="text-[11px] text-muted-foreground">Tidak ada ayat ditandai.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: kolom }, (_, i) => i + 1).map((ayat) => {
                          const jl = perAyat[ayat] ?? [];
                          const semua = jl.length === totalJuri && totalJuri > 0;
                          const saya = jl.some((r) => r.is_me);
                          return (
                            <div
                              key={ayat}
                              title={
                                jl.length === 0
                                  ? `Ayat ${ayat}: tidak ditandai`
                                  : `Ayat ${ayat}: ${jl.map((r) => r.label + (r.is_me ? " (Anda)" : "")).join(", ")}`
                              }
                              className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] leading-none ${
                                jl.length === 0
                                  ? "border-dashed bg-muted/40 text-muted-foreground"
                                  : semua
                                    ? "border-primary/50 bg-primary/20 font-semibold"
                                    : "border-destructive/50 bg-destructive/15 font-semibold"
                              } ${saya ? "ring-2 ring-ring" : ""}`}
                            >
                              <span>{ayat}</span>
                              <span className="mt-0.5 text-[9px] opacity-70">
                                {jl.length}/{totalJuri}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-3 rounded border border-primary/50 bg-primary/20" /> Semua juri sama
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-3 rounded border border-destructive/50 bg-destructive/15" /> Beda persepsi
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-3 rounded border border-dashed bg-muted/40" /> Tidak ditandai
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-3 rounded ring-2 ring-ring" /> Pilihan Anda
                </span>
              </div>
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            Nama juri lain disamarkan. Kotak merah = ayat yang hanya ditandai sebagian juri; samakan persepsi saat Perbaikan dibuka Inspektur.
          </p>
        </div>
      )}
    </div>
  );
}
