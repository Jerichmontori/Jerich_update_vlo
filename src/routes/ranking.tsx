import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import { BookOpenText, ArrowLeft, Filter } from "lucide-react";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Daftar Nilai Peserta — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Daftar nilai peserta lomba baca Mazmur, dapat difilter berdasarkan kategori." },
      { property: "og:title", content: "Daftar Nilai Peserta Lomba Baca Mazmur" },
      { property: "og:description", content: "Nilai dan peringkat peserta lomba baca Mazmur per kategori." },
    ],
  }),
  component: RankingPublic,
});

type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };
type Peserta = { id: string; kategori: string | null };

const ALL = "__all__";

function RankingPublic() {
  const [rows, setRows] = useState<Ranking[]>([]);
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategori, setKategori] = useState<string>(ALL);

  async function load() {
    setLoading(true);
    const [{ data: rankData, error: rankErr }, { data: pesertaData, error: pesertaErr }] = await Promise.all([
      supabase.rpc("get_ranking" as any),
      supabase.from("peserta").select("id, kategori"),
    ]);
    setLoading(false);
    if (rankErr) return toast.error(rankErr.message);
    if (pesertaErr) return toast.error(pesertaErr.message);
    setRows(((rankData ?? []) as Ranking[]));
    setPeserta((pesertaData ?? []) as Peserta[]);
  }
  useEffect(() => { load(); }, []);

  const kategoriMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    peserta.forEach((p) => { m[p.id] = p.kategori; });
    return m;
  }, [peserta]);

  const kategoriList = useMemo(() => {
    const set = new Set<string>();
    peserta.forEach((p) => { if (p.kategori && p.kategori.trim()) set.add(p.kategori.trim()); });
    return Array.from(set).sort();
  }, [peserta]);

  const filtered = useMemo(() => {
    const list = kategori === ALL
      ? rows
      : rows.filter((r) => (kategoriMap[r.peserta_id] ?? "") === kategori);
    return [...list].sort((a, b) => Number(b.total_skor) - Number(a.total_skor));
  }, [rows, kategori, kategoriMap]);

  const medals = ["🥇", "🥈", "🥉"];

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
              <h1 className="truncate text-xl sm:text-2xl font-serif font-semibold">Daftar Nilai Peserta</h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/"><ArrowLeft className="size-4" />Beranda</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Card className="border-accent/20 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="font-serif text-2xl">Nilai & Peringkat Peserta</CardTitle>
              <CardDescription>Filter berdasarkan kategori peserta untuk melihat peringkat per kategori.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <Select value={kategori} onValueChange={setKategori}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Semua Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Semua Kategori</SelectItem>
                    {kategoriList.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={load}>Muat Ulang</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead className="w-16">No.</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead>Asal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center w-24">Juri</TableHead>
                    <TableHead className="text-right w-32">Rata-rata</TableHead>
                    <TableHead className="text-right w-32">Total Skor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Memuat…</TableCell></TableRow>}
                  {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Belum ada penilaian.</TableCell></TableRow>}
                  {filtered.map((r, i) => {
                    const belum = !(Number(r.total_skor) > 0);
                    const kat = kategoriMap[r.peserta_id];
                    return (
                    <TableRow key={r.peserta_id} className={!belum && i < 3 ? "bg-accent/10" : ""}>
                      <TableCell className="text-center text-2xl">{belum ? "—" : (medals[i] ?? i + 1)}</TableCell>
                      <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                      <TableCell className="font-semibold">{r.nama}</TableCell>
                      <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{kat || "—"}</TableCell>
                      <TableCell className="text-center">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : r.jumlah_juri}</TableCell>
                      <TableCell className="text-right font-mono">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : Number(r.rata_rata).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">{belum ? <span className="text-muted-foreground italic font-normal">belum tampil</span> : Number(r.total_skor).toFixed(2)}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
