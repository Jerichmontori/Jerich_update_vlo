import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { Trophy, RefreshCw, Play, ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/skor")({
  component: SkorFinalPage,
  head: () => ({
    meta: [
      { title: "Pengumuman Nilai Final · Sistem Penjurian" },
      { name: "description", content: "Layar pengumuman nilai peserta: nilai tiap juri dan nilai akhir dengan animasi undian angka." },
      { property: "og:title", content: "Pengumuman Nilai Final · Sistem Penjurian" },
      { property: "og:description", content: "Layar pengumuman nilai peserta: nilai tiap juri dan nilai akhir dengan animasi undian angka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MonitorRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
  bacaan: string | null;
  status: string;
  juri_done: number;
  juri_total: number;
};

type ProgresJuri = {
  juri_id: string;
  juri_nama: string;
  sudah_kirim: boolean;
  nilai_juri: number | null;
};

/** Angka bergulir acak lalu berhenti tepat di nilai target. */
function RollingNumber({
  value,
  running,
  delay = 0,
  className = "",
}: {
  value: number | null;
  running: boolean;
  delay?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const timers = useRef<any[]>([]);

  useEffect(() => {
    timers.current.forEach(clearInterval);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSettled(false);
    if (!running || value == null) {
      setDisplay(null);
      return;
    }
    const start = setTimeout(() => {
      const spin = setInterval(() => {
        setDisplay(Math.random() * 100);
      }, 55);
      timers.current.push(spin);
      const stop = setTimeout(() => {
        clearInterval(spin);
        setDisplay(value);
        setSettled(true);
      }, 2200);
      timers.current.push(stop);
    }, delay);
    timers.current.push(start);
    return () => {
      timers.current.forEach(clearInterval);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [value, running, delay]);

  return (
    <span
      className={`font-mono tabular-nums transition-all duration-300 ${
        settled ? "text-accent scale-110 drop-shadow" : "text-foreground"
      } ${className}`}
    >
      {display == null ? "—" : display.toFixed(3)}
    </span>
  );
}

function SkorFinalPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [selected, setSelected] = useState<MonitorRow | null>(null);
  const [juri, setJuri] = useState<ProgresJuri[]>([]);
  const [nilaiAkhir, setNilaiAkhir] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return setAllowed(false);
      const { data: isAdm } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
      setAllowed(!!isAdm);
      if (!isAdm) window.location.href = "/dashboard";
    })();
  }, []);

  const loadList = useCallback(async () => {
    const { data, error } = await supabase.rpc("inspektur_monitor" as any);
    if (error) return toast.error(error.message);
    const list = ((data as unknown as MonitorRow[]) ?? []).filter((r) => r.status === "Final");
    setRows(list.sort((a, b) => b.nomor_urut - a.nomor_urut));
  }, []);

  useEffect(() => {
    if (allowed) loadList();
  }, [allowed, loadList]);

  async function pilih(row: MonitorRow) {
    setSelected(row);
    setRunning(false);
    setJuri([]);
    setNilaiAkhir(null);
    setLoading(true);
    const [{ data: prog, error: e1 }, { data: rank, error: e2 }] = await Promise.all([
      supabase.rpc("inspektur_progres_juri" as any, { _peserta: row.peserta_id }),
      supabase.rpc("get_ranking" as any),
    ]);
    setLoading(false);
    if (e1) return toast.error(e1.message);
    if (e2) return toast.error(e2.message);
    const list = ((prog as unknown as ProgresJuri[]) ?? []).filter((j) => j.nilai_juri != null);
    setJuri(list);
    const r = ((rank as any[]) ?? []).find((x) => x.peserta_id === row.peserta_id);
    setNilaiAkhir(r?.nilai_akhir != null ? Number(r.nilai_akhir) : null);
  }

  if (allowed === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Memeriksa akses…</div>;
  }
  if (!allowed) return null;

  const juriDelay = 200;
  const finalDelay = juriDelay + juri.length * 500 + 1800;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center size-12 rounded-full bg-primary text-primary-foreground ring-4 ring-accent/30">
              <Trophy className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Admin</p>
              <h1 className="truncate text-2xl font-serif font-semibold">Pengumuman Nilai Final</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadList}>
              <RefreshCw className="size-4 mr-1" /> Muat Ulang
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/dashboard")}>
              <ArrowLeft className="size-4 mr-1" /> Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peserta Final</CardTitle>
            <CardDescription>Peserta yang sudah selesai tampil & final.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada peserta final.</div>
            ) : (
              rows.map((r) => (
                <button
                  key={r.peserta_id}
                  onClick={() => pilih(r)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors hover:bg-accent/10 ${
                    selected?.peserta_id === r.peserta_id ? "border-accent bg-accent/10" : ""
                  }`}
                >
                  <div className="font-medium truncate">
                    {r.nomor_urut}. {r.nama}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.kategori ?? "—"}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate">
                {selected ? `${selected.nomor_urut}. ${selected.nama}` : "Pilih peserta"}
              </CardTitle>
              <CardDescription className="truncate">
                {selected ? `${selected.kategori ?? "—"} · ${selected.bacaan ?? "—"}` : "Nilai tiap juri dan nilai akhir akan ditampilkan dengan animasi."}
              </CardDescription>
            </div>
            <Button
              disabled={!selected || loading || juri.length === 0}
              onClick={() => {
                setRunning(false);
                setTimeout(() => setRunning(true), 60);
              }}
            >
              <Play className="size-4 mr-1" /> Mulai Animasi
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">Belum ada peserta dipilih.</div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {juri.map((j, i) => (
                    <div key={j.juri_id} className="rounded-xl border bg-card p-4">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Juri</div>
                      <div className="font-medium truncate">{j.juri_nama}</div>
                      <div className="mt-2 text-3xl">
                        <RollingNumber value={Number(j.nilai_juri)} running={running} delay={juriDelay + i * 500} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border-2 border-accent/40 bg-primary text-primary-foreground p-8 text-center shadow-xl">
                  <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
                    <Sparkles className="size-4" /> Nilai Akhir
                  </div>
                  <div className="mt-3 text-6xl sm:text-7xl font-semibold">
                    <RollingNumber value={nilaiAkhir} running={running} delay={finalDelay} className="!text-accent" />
                  </div>
                  <div className="mt-3">
                    <Badge variant="secondary">{juri.length} juri menilai</Badge>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
