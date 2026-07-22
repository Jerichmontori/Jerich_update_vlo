import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };
type PesertaSesi = { id: string; sesi: string | null; nomor_urut: number };

const medals = ["🥇", "🥈", "🥉"];

function PosisiPublic() {
  const [rows, setRows] = useState<Ranking[]>([]);
  const [pesertaMap, setPesertaMap] = useState<Record<string, PesertaSesi>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: rankData, error: rankErr }, { data: pesertaData, error: pesertaErr }] = await Promise.all([
      supabase.from("ranking").select("*"),
      supabase.from("peserta").select("id, sesi, nomor_urut"),
    ]);
    setLoading(false);
    if (rankErr) return toast.error(rankErr.message);
    if (pesertaErr) return toast.error(pesertaErr.message);
    const map: Record<string, PesertaSesi> = {};
    (pesertaData ?? []).forEach((p) => { map[p.id] = p as PesertaSesi; });
    setPesertaMap(map);
    setRows(((rankData ?? []) as Ranking[]).filter((r) => Number(r.total_skor) > 0));
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const buckets: Record<string, Ranking[]> = {};
    rows.forEach((r) => {
      const sesi = pesertaMap[r.peserta_id]?.sesi ?? "—";
      (buckets[sesi] ??= []).push(r);
    });
    Object.values(buckets).forEach((list) => list.sort((a, b) => Number(b.total_skor) - Number(a.total_skor)));
    return Object.entries(buckets).sort(([a], [b]) => {
      const na = Number(a), nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [rows, pesertaMap]);

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
              <Link to="/ranking">Papan Ranking</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/"><ArrowLeft className="size-4" />Beranda</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Menampilkan urutan peringkat peserta yang sudah dinilai pada setiap sesi tampil.</p>
          <Button variant="outline" size="sm" onClick={load}>Muat Ulang</Button>
        </div>

        {loading && <p className="text-center py-10 text-muted-foreground">Memuat…</p>}
        {!loading && grouped.length === 0 && (
          <Card className="border-accent/20"><CardContent className="py-16 text-center text-muted-foreground">Belum ada peserta yang dinilai.</CardContent></Card>
        )}

        {!loading && grouped.map(([sesi, list]) => (
          <Card key={sesi} className="border-accent/20 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 bg-accent/5">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center size-10 rounded-full bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <CardTitle className="font-serif text-xl">Sesi {sesi}</CardTitle>
                  <CardDescription>{list.length} peserta sudah dinilai</CardDescription>
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
                    <TableHead className="text-right w-32">Rata-rata</TableHead>
                    <TableHead className="text-right w-32">Total Skor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r, i) => (
                    <TableRow key={r.peserta_id} className={i < 3 ? "bg-accent/10" : ""}>
                      <TableCell className="text-center text-2xl">{medals[i] ?? i + 1}</TableCell>
                      <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                      <TableCell className="font-semibold">{r.nama}</TableCell>
                      <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                      <TableCell className="text-center">{r.jumlah_juri}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.rata_rata).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">{Number(r.total_skor).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
