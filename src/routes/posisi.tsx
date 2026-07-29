import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "sonner";
import { BookOpenText, ArrowLeft, Users } from "lucide-react";

export const Route = createFileRoute("/posisi")({
  head: () => ({
    meta: [
      { title: "Posisi per Sesi — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Peringkat peserta lomba baca Mazmur dikelompokkan berdasarkan sesi tampil." },
      { property: "og:title", content: "Posisi per Sesi Lomba Baca Mazmur" },
      { property: "og:description", content: "Urutan peringkat peserta pada setiap sesi tampil." },
    ],
  }),
  component: PosisiPublic,
});

type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number; nilai_akhir: number | null; juri_total_sum: number | null; juri_spread: number | null };
type Peserta = { id: string; nama: string; asal: string | null; sesi: string | null; nomor_urut: number };
type Row = Peserta & { total_skor: number; rata_rata: number; jumlah_juri: number; nilai_akhir: number | null; juri_total_sum: number; juri_spread: number; scored: boolean };

const medals = ["🥇", "🥈", "🥉"];

function PosisiPublic() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, Ranking>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);


  async function load() {
    setLoading(true);
    const [{ data: rankData, error: rankErr }, { data: pesertaData, error: pesertaErr }] = await Promise.all([
      supabase.rpc("get_ranking" as any),
      supabase.from("peserta").select("id, nama, asal, sesi, nomor_urut"),
    ]);
    setLoading(false);
    if (rankErr) return toast.error(rankErr.message);
    if (pesertaErr) return toast.error(pesertaErr.message);
    const rmap: Record<string, Ranking> = {};
    (rankData ?? []).forEach((r: any) => { rmap[(r as Ranking).peserta_id] = r as Ranking; });
    setRankMap(rmap);
    setPeserta((pesertaData ?? []) as Peserta[]);
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const enrichedAll: Row[] = peserta.map((p) => {
      const r = rankMap[p.id];
      const nilai = r?.nilai_akhir != null ? Number(r.nilai_akhir) : null;
      const jumlah = Number(r?.jumlah_juri ?? 0);
      return {
        ...p,
        total_skor: Number(r?.total_skor ?? 0),
        rata_rata: Number(r?.rata_rata ?? 0),
        jumlah_juri: jumlah,
        nilai_akhir: nilai,
        scored: nilai != null && jumlah > 0,
      };
    });
    const scoredSorted = enrichedAll
      .filter((r) => r.scored)
      .sort((a, b) => a.nomor_urut - b.nomor_urut);
    const chunks: { key: string; label: string; range: string; list: Row[] }[] = [];
    for (let i = 0; i < scoredSorted.length; i += 10) {
      const slice = scoredSorted.slice(i, i + 10);
      const ranked = [...slice].sort((a, b) => {
        const av = Number(a.nilai_akhir ?? 0);
        const bv = Number(b.nilai_akhir ?? 0);
        return bv !== av ? bv - av : a.nomor_urut - b.nomor_urut;
      });
      const first = slice[0]?.nomor_urut ?? i + 1;
      const last = slice[slice.length - 1]?.nomor_urut ?? i + slice.length;
      const idx = Math.floor(i / 10) + 1;
      chunks.push({ key: `sesi-${idx}`, label: `Sesi ${idx}`, range: `No. ${first}–${last}`, list: ranked });
    }
    return chunks;
  }, [peserta, rankMap]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-background">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center size-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30">
              <BookOpenText className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Viewer</p>
              <h1 className="truncate text-xl sm:text-2xl font-serif font-semibold">Posisi per Sesi</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link to="/ranking">Daftar Nilai</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/"><ArrowLeft className="size-4" />Beranda</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Setiap sesi berisi 10 peserta yang sudah dinilai beserta peringkatnya.</p>
          <Button variant="outline" size="sm" onClick={load}>Muat Ulang</Button>
        </div>

        {loading && <p className="text-center py-10 text-muted-foreground">Memuat…</p>}
        {!loading && grouped.length === 0 && (
          <Card className="border-accent/20"><CardContent className="py-16 text-center text-muted-foreground">Belum ada peserta yang dinilai.</CardContent></Card>
        )}

        {!loading && grouped.length > 0 && (() => {
          const safePage = Math.min(page, grouped.length - 1);
          const { key, label, range, list } = grouped[safePage];
          const scoredCount = list.filter((r) => r.scored).length;
          let rankedIdx = -1;
          return (
            <>
              <Card key={key} className="border-accent/20 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4 bg-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center size-10 rounded-full bg-primary/10 text-primary">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="font-serif text-xl">{label} <span className="text-sm font-normal text-muted-foreground">({range})</span></CardTitle>
                      <CardDescription>{list.length} peserta · {scoredCount} sudah dinilai</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-center">Posisi</TableHead>
                        <TableHead className="w-16">No.</TableHead>
                        <TableHead>Peserta</TableHead>
                        <TableHead>Asal</TableHead>
                        <TableHead className="text-center w-24">Juri</TableHead>
                        <TableHead className="text-right w-36">Nilai Akhir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((r) => {
                        if (r.scored) rankedIdx += 1;
                        const idx = r.scored ? rankedIdx : -1;
                        return (
                        <TableRow key={r.id} className={r.scored && idx < 3 ? "bg-accent/10" : ""}>
                          <TableCell className="text-center text-2xl">
                            {r.scored ? (medals[idx] ?? idx + 1) : "—"}
                          </TableCell>
                          <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                          <TableCell className="font-semibold">{r.nama}</TableCell>
                          <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                          <TableCell className="text-center">{r.scored ? r.jumlah_juri : <span className="text-muted-foreground italic">belum tampil</span>}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">{r.scored && r.nilai_akhir != null ? Number(r.nilai_akhir).toFixed(3) : <span className="text-muted-foreground italic font-normal">belum tampil</span>}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-4 pt-2">
                <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ChevronLeft className="size-4" /> Sesi Sebelumnya
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {grouped.map((g, i) => (
                    <Button
                      key={g.key}
                      size="sm"
                      variant={i === safePage ? "default" : "outline"}
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="sm" disabled={safePage >= grouped.length - 1} onClick={() => setPage((p) => Math.min(grouped.length - 1, p + 1))}>
                  Sesi Berikutnya <ChevronRight className="size-4" />
                </Button>
              </div>
            </>
          );
        })()}
      </main>
    </div>
  );
}


