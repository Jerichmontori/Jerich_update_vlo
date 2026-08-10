import { usePolling } from "@/hooks/usePolling";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import GantiPasswordButton from "@/components/GantiPasswordButton";
import VarBadge from "@/components/VarBadge";
import { useVarStatus } from "@/hooks/useVarStatus";
import {
  MonitorPlay,
  RefreshCw,
  Search,
  Play,
  MonitorX,
  Video,
  Trophy,
  Link2,
  Sparkles,
  AlertTriangle,
  LogOut,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/vmix")({
  component: OperatorVmixPage,
  head: () => ({
    meta: [
      { title: "Operator vMix · Sistem Penjurian" },
      {
        name: "description",
        content:
          "Panel operator vMix: pantau peserta berpotensi VAR, ayat yang harus ditayangkan, dan kendalikan layar pengumuman nilai final.",
      },
      { property: "og:title", content: "Operator vMix · Sistem Penjurian" },
      {
        property: "og:description",
        content:
          "Panel operator vMix: pantau peserta berpotensi VAR, ayat yang harus ditayangkan, dan kendalikan layar pengumuman nilai final.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type VarRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
  komponen_berbeda: any;
  status: string;
  bacaan: string | null;
  juri_berbeda: number;
  detected_at: string;
};

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

type ProgresJuri = { juri_id: string; juri_nama: string; sudah_kirim: boolean; nilai_juri: number | null };

type Aspek = { nama?: string; ditandai?: (number | string)[] };
type JuriDetail = { juri_id: string; label: string; clear_text: boolean | null; aspek: Aspek[] };

const ASPEK_NAMA = ["Salah kata", "Menambah kata", "Mengurangi kata"];

function marks(a?: Aspek): number[] {
  const d = a?.ditandai ?? [];
  if (!Array.isArray(d)) return [];
  return d.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function statusLabel(s: string) {
  if (s === "menunggu_persetujuan_juri") return "VAR Diajukan — menunggu persetujuan juri";
  if (s === "disetujui_juri") return "VAR Diajukan — disetujui juri";
  if (s === "ditolak_juri") return "VAR Diajukan — ditolak juri";
  if (s === "perbaikan_perhatian") return "Perbaikan Perhatian";
  if (s === "potensi_var") return "Potensi VAR (otomatis)";
  return s;
}

function isManual(row: VarRow) {
  const k = row.komponen_berbeda;
  return (
    row.status.startsWith("menunggu") ||
    row.status === "disetujui_juri" ||
    row.status === "ditolak_juri" ||
    (Array.isArray(k) && k.includes("manual"))
  );
}

/** Ringkasan ayat yang harus ditayangkan pada video VAR untuk satu peserta. */
function AyatVar({ pesertaId }: { pesertaId: string }) {
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

  usePolling(() => { void load(); }, 20000);

  const data = rows ?? [];
  const total = data.length;

  const perAspek = useMemo(() => {
    return ASPEK_NAMA.map((nama, idx) => {
      const perAyat: Record<number, string[]> = {};
      for (const r of data) for (const n of marks(r.aspek?.[idx])) (perAyat[n] ||= []).push(r.label);
      const ayat = Object.keys(perAyat)
        .map(Number)
        .sort((a, b) => a - b)
        .map((n) => ({ ayat: n, juri: perAyat[n]!, beda: perAyat[n]!.length !== total }));
      return { nama, ayat };
    });
  }, [data, total]);

  const clearYa = data.filter((r) => r.clear_text === true).length;
  const clearTidak = data.filter((r) => r.clear_text === false).length;

  if (err) return <p className="text-xs text-muted-foreground">Tidak dapat memuat rincian: {err}</p>;
  if (rows === null) return <p className="text-xs text-muted-foreground">Memuat rincian ayat…</p>;
  if (total === 0) return <p className="text-xs text-muted-foreground">Belum ada penilaian juri.</p>;

  const semuaBeda = perAspek.flatMap((a) => a.ayat.filter((x) => x.beda).map((x) => `${a.nama}: ayat ${x.ayat}`));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-destructive">
          <Video className="size-3.5" /> Ayat untuk video VAR
        </div>
        {semuaBeda.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Tidak ada perbedaan ayat — perbedaan hanya pada Clear Text ({clearYa} Ya / {clearTidak} Tidak).
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {semuaBeda.map((s) => (
              <Badge key={s} variant="destructive" className="text-[11px]">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {perAspek.map((a) => (
          <div key={a.nama} className="rounded-lg border p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{a.nama}</div>
            {a.ayat.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">—</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {a.ayat.map((x) => (
                  <span
                    key={x.ayat}
                    title={`Ditandai oleh: ${x.juri.join(", ")}`}
                    className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
                      x.beda
                        ? "border-destructive/50 bg-destructive/10 font-semibold"
                        : "border-primary/40 bg-primary/10"
                    }`}
                  >
                    Ayat {x.ayat} · {x.juri.length}/{total}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-muted-foreground">
        Merah = hanya sebagian juri menandai (wajib ditayangkan). Clear Text: {clearYa} Ya · {clearTidak} Tidak.
      </div>
    </div>
  );
}

function OperatorVmixPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return setAllowed(false);
      const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "operator_vmix" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "inspektur" as any }),
      ]);
      const ok = !!a || !!b || !!c;
      setAllowed(ok);
      if (!ok) window.location.href = "/dashboard";
    })();
  }, []);

  if (allowed === null)
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Memeriksa akses…</div>;
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center size-12 rounded-full bg-primary text-primary-foreground ring-4 ring-accent/30">
              <MonitorPlay className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Operator vMix</p>
              <h1 className="truncate text-2xl font-serif font-semibold">Panel Tayangan VAR &amp; Pengumuman</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <GantiPasswordButton variant="outline" size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="size-4 mr-1" /> Keluar
            </Button>
          </div>
        </div>
      </header>


      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="var">
          <TabsList className="grid w-full grid-cols-3 h-auto bg-secondary/60 p-1">
            <TabsTrigger value="var" className="gap-2">
              <AlertTriangle className="size-4" /> VAR
            </TabsTrigger>
            <TabsTrigger value="pengumuman" className="gap-2">
              <Trophy className="size-4" /> Pengumuman Nilai
            </TabsTrigger>
            <TabsTrigger value="koneksi" className="gap-2">
              <Link2 className="size-4" /> Koneksi vMix
            </TabsTrigger>
          </TabsList>
          <TabsContent value="var">
            <VarTab />
          </TabsContent>
          <TabsContent value="pengumuman">
            <PengumumanTab />
          </TabsContent>
          <TabsContent value="koneksi">
            <KoneksiTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function VarTab() {
  const [rows, setRows] = useState<VarRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("inspektur_list_var" as any);
    if (error) return toast.error(error.message);
    setRows((data as unknown as VarRow[]) ?? []);
  }, []);

  usePolling(() => { void load(); }, 25000);

  const filtered = rows.filter(
    (r) => !q.trim() || r.nama.toLowerCase().includes(q.toLowerCase()) || String(r.nomor_urut).includes(q.trim()),
  );

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Peserta dalam VAR</CardTitle>
          <CardDescription>Potensi VAR otomatis maupun VAR yang diajukan, beserta ayat yang harus ditayangkan.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-4 mr-1" /> Muat Ulang
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor urut / nama…" className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">Tidak ada peserta dalam VAR saat ini.</div>
        ) : (
          filtered.map((r) => (
            <div key={r.peserta_id} className="rounded-xl border">
              <button
                onClick={() => setOpen((o) => (o === r.peserta_id ? null : r.peserta_id))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/10"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.nomor_urut}. {r.nama}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.bacaan ?? "—"}</div>
                </div>
                <Badge variant={isManual(r) ? "destructive" : "secondary"} className="shrink-0">
                  {isManual(r) ? "Diajukan" : "Potensi"} · {statusLabel(r.status)}
                </Badge>
              </button>
              {open === r.peserta_id && (
                <div className="border-t p-4">
                  <AyatVar pesertaId={r.peserta_id} />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RollingNumber({ value, running, delay = 0 }: { value: number | null; running: boolean; delay?: number }) {
  const [display, setDisplay] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    if (!running || value == null) {
      setDisplay(null);
      return;
    }
    let spin: any;
    let stop: any;
    const start = setTimeout(() => {
      spin = setInterval(() => setDisplay(Math.random() * 100), 55);
      stop = setTimeout(() => {
        clearInterval(spin);
        setDisplay(value);
        setSettled(true);
      }, 2200);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [value, running, delay]);

  return (
    <span className={`font-mono tabular-nums transition-all ${settled ? "text-accent" : "text-foreground"}`}>
      {display == null ? "—" : display.toFixed(3)}
    </span>
  );
}

const PAGE_SIZE = 10;

function PengumumanTab() {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MonitorRow | null>(null);
  const [juri, setJuri] = useState<ProgresJuri[]>([]);
  const [nilaiAkhir, setNilaiAkhir] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const { varMap } = useVarStatus();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("inspektur_monitor" as any);
    if (error) return toast.error(error.message);
    const list = ((data as unknown as MonitorRow[]) ?? []).filter((r) => r.status === "Final");
    setRows(list.sort((a, b) => b.nomor_urut - a.nomor_urut));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => !q.trim() || r.nama.toLowerCase().includes(q.toLowerCase()) || String(r.nomor_urut).includes(q.trim()),
      ),
    [rows, q],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

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
    setJuri(((prog as unknown as ProgresJuri[]) ?? []).filter((j) => j.nilai_juri != null));
    const r = ((rank as any[]) ?? []).find((x) => x.peserta_id === row.peserta_id);
    setNilaiAkhir(r?.nilai_akhir != null ? Number(r.nilai_akhir) : null);
    const { error } = await supabase.rpc("set_pengumuman_state" as any, {
      _peserta: row.peserta_id,
      _running: false,
    });
    if (error) toast.error(error.message);
    else toast.success("Peserta dikirim ke layar vMix");
  }

  async function mulaiAnimasi() {
    if (!selected) return;
    setRunning(false);
    setTimeout(() => setRunning(true), 60);
    const { error } = await supabase.rpc("set_pengumuman_state" as any, {
      _peserta: selected.peserta_id,
      _running: true,
    });
    if (error) toast.error(error.message);
    else toast.success("Animasi dikirim ke layar vMix");
  }

  async function bersihkan() {
    const { error } = await supabase.rpc("set_pengumuman_state" as any, { _peserta: null, _running: false });
    if (error) toast.error(error.message);
    else toast.success("Layar vMix dikosongkan");
  }

  const juriDelay = 200;
  const finalDelay = juriDelay + juri.length * 500 + 1800;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Peserta Final</CardTitle>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <CardDescription>{filtered.length} peserta siap diumumkan.</CardDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Cari nomor urut / nama…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {shown.length === 0 ? (
            <div className="text-sm text-muted-foreground">Tidak ada peserta.</div>
          ) : (
            shown.map((r) => (
              <button
                key={r.peserta_id}
                onClick={() => pilih(r)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors hover:bg-accent/10 ${
                  selected?.peserta_id === r.peserta_id ? "border-accent bg-accent/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">
                    {r.nomor_urut}. {r.nama}
                  </div>
                  <VarBadge status={varMap[r.peserta_id]} compact className="shrink-0" />
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.kategori ?? "—"}</div>
              </button>
            ))
          )}
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Sebelumnya
              </Button>
              <span className="text-xs text-muted-foreground">
                Hal. {current + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="min-w-0">
            <CardTitle className="truncate">
              {selected ? `${selected.nomor_urut}. ${selected.nama}` : "Pilih peserta"}
            </CardTitle>
            <CardDescription className="truncate">
              {selected ? `${selected.kategori ?? "—"} · ${selected.bacaan ?? "—"}` : "Pratinjau nilai sebelum tayang."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={bersihkan}>
              <MonitorX className="size-4 mr-1" /> Kosongkan
            </Button>
            <Button disabled={!selected || loading || juri.length === 0} onClick={mulaiAnimasi}>
              <Play className="size-4 mr-1" /> Mulai Animasi
            </Button>
          </div>
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
                <div className="mt-3 text-6xl font-semibold">
                  <RollingNumber value={nilaiAkhir} running={running} delay={finalDelay} />
                </div>
                <div className="mt-3">
                  <Badge variant="secondary">{juri.length} juri menilai</Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KoneksiTab() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const items = [
    {
      judul: "Pengumuman Nilai (Browser Input, latar transparan)",
      url: `${origin}/vmix/skor?bg=transparent`,
      ket: "Overlay siap pakai — mengikuti peserta & animasi yang Anda jalankan di tab Pengumuman Nilai.",
    },
    {
      judul: "Pengumuman Nilai (versi ringan/legacy)",
      url: `${origin}/api/public/vmix/skor.html`,
      ket: "Untuk vMix versi lama yang browser-nya terbatas.",
    },
    {
      judul: "Live Ranking",
      url: `${origin}/vmix/leaderboard`,
      ket: "Papan peringkat langsung.",
    },
    {
      judul: "Sedang Membaca",
      url: `${origin}/vmix/nowreading`,
      ket: "Nama peserta & bacaan yang sedang tampil.",
    },
    {
      judul: "Data Source XML",
      url: `${origin}/api/public/skor.xml`,
      ket: "Untuk Title buatan sendiri. Field: nama, nomor_urut, asal, juri1..5_nama/nilai, nilai_akhir, status. Auto Refresh 1–2 detik.",
    },
    {
      judul: "Data Source JSON",
      url: `${origin}/api/public/skor.json`,
      ket: "Sumber data JSON untuk integrasi lain.",
    },
  ];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Sumber tayangan untuk vMix</CardTitle>
        <CardDescription>
          Gunakan URL berikut sebagai Browser Input / Data Source, bukan tangkapan layar aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {items.map((it) => (
          <div key={it.url}>
            <div className="font-medium">{it.judul}</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="block flex-1 rounded bg-muted px-2 py-1 break-all">{it.url}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(it.url);
                  toast.success("URL disalin");
                }}
              >
                Salin
              </Button>
            </div>
            <p className="text-muted-foreground mt-1">{it.ket}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
