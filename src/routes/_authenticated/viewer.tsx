import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "sonner";
import { BookOpenText, RefreshCw, Mic, FileText, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { catatanToRows } from "@/components/JuriHasilFinalTab";

export const Route = createFileRoute("/_authenticated/viewer")({
  component: ViewerPage,
  head: () => ({
    meta: [
      { title: "Urutan Peserta · Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Lihat urutan peserta, peserta yang sedang tampil, dan unduh catatan juri peserta yang sudah selesai dinilai." },
      { property: "og:title", content: "Urutan Peserta · Sistem Penjurian Baca Mazmur" },
      { property: "og:description", content: "Urutan peserta, peserta yang sedang tampil, dan catatan juri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  asal: string | null;
  kategori: string | null;
  sesi_no: number;
  final: boolean;
  sedang_tampil: boolean;
  bacaan: string | null;
};

function ViewerPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [nama, setNama] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("viewer_peserta_list" as any);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("nama").eq("id", uid).maybeSingle();
      setNama(prof?.nama ?? u.user?.email?.split("@")[0] ?? "Pengguna");
    })();
  }, []);

  const tampil = useMemo(() => (rows ?? []).filter((r) => r.sedang_tampil), [rows]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.nama.toLowerCase().includes(s) || String(r.nomor_urut) === s);
  }, [rows, q]);

  async function unduhCatatan(r: Row) {
    setBusy(r.peserta_id);
    const { data, error } = await supabase.rpc("viewer_catatan_peserta" as any, { _peserta: r.peserta_id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Catatan Juri", 14, 16);
    doc.setFontSize(10);
    doc.text(`Peserta: ${r.nomor_urut}. ${r.nama}${r.asal ? ` — ${r.asal}` : ""}`, 14, 24);
    doc.text(`Kategori: ${r.kategori ?? "—"}   |   Bacaan: ${d?.bacaan ?? "—"}`, 14, 30);

    const catatan: any[] = Array.isArray(d?.catatan) ? d.catatan : [];
    if (catatan.length === 0) {
      doc.text("Belum ada catatan juri untuk peserta ini.", 14, 42);
    } else {
      let y = 38;
      catatan.forEach((c) => {
        const rowsCat = catatanToRows(c.catatan);
        autoTable(doc, {
          startY: y,
          head: [[`Juri: ${c.juri_nama ?? "—"}`, "Masukan"]],
          body: rowsCat.length > 0 ? rowsCat : [["—", "Tidak ada catatan"]],
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
      });
    }
    doc.save(`catatan-juri-${r.nomor_urut}-${r.nama}.pdf`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-card/60 backdrop-blur mb-8">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center size-11 rounded-full bg-primary text-primary-foreground ring-4 ring-accent/30">
              <BookOpenText className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Pengguna</p>
              <h1 className="truncate text-xl sm:text-2xl font-serif font-semibold">Urutan &amp; Catatan Peserta</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">{nama}</span>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4 mr-1" />Muat Ulang</Button>
            <Button variant="ghost" size="sm" onClick={signOut}>Keluar</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 space-y-6">
        <Card className="border-accent/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Mic className="size-4 text-accent" /> Sedang Tampil</CardTitle>
            <CardDescription>Peserta yang sedang dinilai saat ini.</CardDescription>
          </CardHeader>
          <CardContent>
            {tampil.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada peserta yang sedang tampil.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {tampil.map((t) => (
                  <div key={t.peserta_id} className="rounded-xl border border-accent/40 bg-secondary/40 p-4">
                    <div className="text-xs uppercase tracking-widest text-accent">Nomor Urut {t.nomor_urut}</div>
                    <div className="font-serif text-2xl font-semibold">{t.nama}</div>
                    <div className="text-sm text-muted-foreground">{t.asal ?? ""}{t.kategori ? ` · ${t.kategori}` : ""}</div>
                    <div className="mt-2 text-sm">Bacaan: <b>{t.bacaan ?? "—"}</b></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Urutan Peserta</CardTitle>
            <CardDescription>
              Tampilan hanya-baca. Catatan juri dapat diunduh untuk peserta yang sudah selesai dinilai (Final).
            </CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama atau nomor urut…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {rows === null ? (
              <div className="text-sm text-muted-foreground">Memuat…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead>Sesi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Catatan Juri</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => (
                    <TableRow key={r.peserta_id} className={r.sedang_tampil ? "bg-accent/10" : ""}>
                      <TableCell>{r.nomor_urut}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.nama}</div>
                        <div className="text-xs text-muted-foreground">{r.asal ?? ""}{r.kategori ? ` · ${r.kategori}` : ""}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">Sesi {r.sesi_no}</Badge></TableCell>
                      <TableCell>
                        {r.sedang_tampil ? (
                          <Badge className="bg-amber-500 text-white">Sedang Tampil</Badge>
                        ) : r.final ? (
                          <Badge className="bg-emerald-600 text-white">Selesai</Badge>
                        ) : (
                          <Badge className="bg-muted text-foreground">Belum Tampil</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={!r.final || busy === r.peserta_id} onClick={() => unduhCatatan(r)}>
                          <FileText className="size-4 mr-1" /> Unduh
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
