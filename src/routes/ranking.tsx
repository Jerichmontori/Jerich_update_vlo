import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "sonner";
import { BookOpenText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Papan Ranking — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Lihat peringkat peserta lomba baca Mazmur secara langsung dan transparan." },
      { property: "og:title", content: "Papan Ranking Lomba Baca Mazmur" },
      { property: "og:description", content: "Peringkat peserta lomba baca Mazmur — objektif dan transparan." },
    ],
  }),
  component: RankingPublic,
});

type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };

function RankingPublic() {
  const [rows, setRows] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("ranking").select("*");
    setLoading(false);
    if (error) return toast.error(error.message);
    const sorted = [...((data ?? []) as Ranking[])].sort((a, b) => Number(b.total_skor) - Number(a.total_skor));
    setRows(sorted);
  }
  useEffect(() => { load(); }, []);

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
              <h1 className="truncate text-xl sm:text-2xl font-serif font-semibold">Papan Ranking</h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/"><ArrowLeft className="size-4" />Beranda</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Card className="border-accent/20 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-serif text-2xl">Peringkat Peserta</CardTitle>
              <CardDescription>Peringkat dihitung otomatis dari total skor terbobot dari semua juri.</CardDescription>
            </div>
            <Button variant="outline" onClick={load}>Muat Ulang</Button>
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
                    <TableHead className="text-center w-24">Juri</TableHead>
                    <TableHead className="text-right w-32">Rata-rata</TableHead>
                    <TableHead className="text-right w-32">Total Skor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Memuat…</TableCell></TableRow>}
                  {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Belum ada penilaian.</TableCell></TableRow>}
                  {rows.map((r, i) => (
                    <TableRow key={r.peserta_id} className={i < 3 && Number(r.total_skor) > 0 ? "bg-accent/10" : ""}>
                      <TableCell className="text-center text-2xl">{Number(r.total_skor) > 0 ? (medals[i] ?? i + 1) : "—"}</TableCell>
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
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
