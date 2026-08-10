import { usePolling } from "@/hooks/usePolling";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "sonner";
import { RefreshCw, Mic, FileText, Search, Clock, Trash2, ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { catatanToRows } from "@/components/JuriHasilFinalTab";
import GantiPasswordButton from "@/components/GantiPasswordButton";
import BrandLogo from "@/components/BrandLogo";

export const Route = createFileRoute("/_authenticated/viewer")({
  component: ViewerPage,
  head: () => ({
    meta: [
      { title: "Sekretariat · Urutan & Sesi Peserta" },
      { name: "description", content: "Sekretariat: kelola urutan peserta, tukar nomor urut dan sesi, serta unduh catatan juri peserta yang sudah selesai dinilai." },
      { property: "og:title", content: "Sekretariat · Urutan & Sesi Peserta" },
      { property: "og:description", content: "Kelola urutan peserta, sesi tampil, dan catatan juri." },
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
  terlambat?: boolean;
  sedang_tampil: boolean;
  bacaan: string | null;
};

function ViewerPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [busy, setBusy] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [fNomor, setFNomor] = useState("");
  const [fNama, setFNama] = useState("");
  const [fAsal, setFAsal] = useState("");
  const [fKategori, setFKategori] = useState("");
  const [saving, setSaving] = useState(false);
  const [tukarA, setTukarA] = useState("");
  const [tukarB, setTukarB] = useState("");
  const [tukarBusy, setTukarBusy] = useState(false);
  const [sesiEditId, setSesiEditId] = useState<string | null>(null);
  const [sesiVal, setSesiVal] = useState("");




  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("viewer_peserta_list" as any);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  usePolling(load, 25000);

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
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pagedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  // reset ke halaman 1 saat pencarian berubah
  useEffect(() => { setPage(1); }, [q]);


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

    const juriList: any[] = Array.isArray(d?.juri) ? d.juri : [];
    const catatan: any[] = Array.isArray(d?.catatan) ? d.catatan : [];

    if (d?.nilai_akhir != null) {
      doc.text(`Nilai Akhir Peserta: ${Number(d.nilai_akhir).toFixed(3)}`, 14, 36);
    }

    let y = d?.nilai_akhir != null ? 44 : 38;

    if (juriList.length > 0) {
      juriList.forEach((j) => {
        const penilaian: any[] = Array.isArray(j.penilaian) ? j.penilaian : [];
        autoTable(doc, {
          startY: y,
          head: [[
            `Juri: ${j.juri_nama ?? "—"}`,
            `Nilai Juri: ${j.nilai_juri != null ? Number(j.nilai_juri).toFixed(3) : "—"}`,
          ]],
          body: penilaian.length > 0
            ? penilaian.map((p) => [String(p.kriteria ?? "—"), String(p.nilai)])
            : [["—", "Belum ada nilai"]],
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 4;

        const rowsCat = catatanToRows(j.catatan);
        autoTable(doc, {
          startY: y,
          head: [["Ayat / Bagian", "Masukan Juri"]],
          body: rowsCat.length > 0 ? rowsCat : [["—", "Tidak ada catatan"]],
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
      });
    } else if (catatan.length === 0) {
      doc.text("Belum ada catatan juri untuk peserta ini.", 14, y);
    } else {
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

  function pilihEdit(r: Row) {
    setEditId(r.peserta_id);
    setFNomor(String(r.nomor_urut));
    setFNama(r.nama);
    setFAsal(r.asal ?? "");
    setFKategori(r.kategori ?? "");
  }

  function batalEdit() {
    setEditId(null);
    setFNomor(""); setFNama(""); setFAsal(""); setFKategori("");
  }

  async function simpanPeserta(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(fNomor);
    if (!fNomor || !fNama.trim()) { toast.error("Nomor urut dan nama wajib diisi"); return; }
    setSaving(true);
    const payload = {
      nomor_urut: n,
      nama: fNama.trim(),
      asal: fAsal.trim() || null,
      kategori: fKategori.trim() || null,
      sesi: `Sesi ${Math.ceil(n / 10)}`,
    };
    const { error } = editId
      ? await supabase.from("peserta").update(payload).eq("id", editId)
      : await supabase.from("peserta").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Peserta diperbarui" : "Peserta ditambahkan");
    batalEdit();
    load();
  }

  async function hapusPeserta(r: Row) {
    if (!confirm(`Hapus peserta ${r.nomor_urut}. ${r.nama}?`)) return;
    const { error } = await supabase.from("peserta").delete().eq("id", r.peserta_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Peserta dihapus");
    load();
  }

  async function toggleTerlambat(r: Row) {
    const next = !r.terlambat;
    if (next && !confirm(`Tandai ${r.nomor_urut}. ${r.nama} sebagai TERLAMBAT? Peserta dianggap selesai dinilai dengan nilai akhir 1.`)) return;
    const { error } = await supabase.rpc("set_peserta_terlambat" as any, { _peserta: r.peserta_id, _terlambat: next });
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Peserta ditandai terlambat (nilai akhir 1)" : "Status terlambat dibatalkan");
    load();
  }

  async function tukarPeserta() {
    if (!tukarA || !tukarB) { toast.error("Pilih dua peserta yang akan ditukar"); return; }
    if (tukarA === tukarB) { toast.error("Pilih dua peserta yang berbeda"); return; }
    const a = (rows ?? []).find((r) => r.peserta_id === tukarA);
    const b = (rows ?? []).find((r) => r.peserta_id === tukarB);
    if (!confirm(`Tukar nomor urut & sesi antara ${a?.nomor_urut}. ${a?.nama} dan ${b?.nomor_urut}. ${b?.nama}?`)) return;
    setTukarBusy(true);
    const { error } = await supabase.rpc("sekretariat_tukar_peserta" as any, { _a: tukarA, _b: tukarB });
    setTukarBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nomor urut & sesi peserta berhasil ditukar");
    setTukarA(""); setTukarB("");
    load();
  }

  async function simpanSesi(r: Row) {
    const n = Number(sesiVal);
    if (!sesiVal || !Number.isFinite(n) || n < 1) { toast.error("Nomor sesi tidak valid"); return; }
    setBusy(r.peserta_id);
    const { error } = await supabase.rpc("sekretariat_set_sesi" as any, { _peserta: r.peserta_id, _sesi: n });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${r.nama} dipindahkan ke Sesi ${n}`);
    setSesiEditId(null); setSesiVal("");
    load();
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
            <BrandLogo className="h-9 sm:h-10 w-auto shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Sekretariat</p>
              <h1 className="truncate text-xl sm:text-2xl font-serif font-semibold">Urutan, Sesi &amp; Catatan Peserta</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">{nama}</span>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4 mr-1" />Muat Ulang</Button>
            <GantiPasswordButton variant="outline" size="sm" />
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
            <CardTitle className="text-base">{editId ? "Ubah Peserta" : "Tambah Peserta"}</CardTitle>
            <CardDescription>Kelola daftar peserta dan atur jadwal tampil.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={simpanPeserta} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_1fr_auto] gap-3">
              <Input type="number" value={fNomor} onChange={(e) => setFNomor(e.target.value)} placeholder="No." />
              <Input value={fNama} onChange={(e) => setFNama(e.target.value)} placeholder="Nama peserta" />
              <Input value={fAsal} onChange={(e) => setFAsal(e.target.value)} placeholder="Asal / jemaat" />
              <Input value={fKategori} onChange={(e) => setFKategori(e.target.value)} placeholder="Kategori" />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{editId ? "Simpan" : "Tambah"}</Button>
                {editId && <Button type="button" variant="ghost" onClick={batalEdit}>Batal</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ArrowLeftRight className="size-4 text-accent" /> Tukar Nomor Peserta &amp; Sesi</CardTitle>
            <CardDescription>
              Pilih dua peserta untuk saling menukar nomor urut sekaligus sesi tampilnya. Sesi ini juga dipakai
              sebagai acuan penayangan Live Ranking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={tukarA}
                onChange={(e) => setTukarA(e.target.value)}
              >
                <option value="">Pilih peserta pertama…</option>
                {(rows ?? []).map((r) => (
                  <option key={r.peserta_id} value={r.peserta_id}>
                    {r.nomor_urut}. {r.nama} (Sesi {r.sesi_no})
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={tukarB}
                onChange={(e) => setTukarB(e.target.value)}
              >
                <option value="">Pilih peserta kedua…</option>
                {(rows ?? []).map((r) => (
                  <option key={r.peserta_id} value={r.peserta_id}>
                    {r.nomor_urut}. {r.nama} (Sesi {r.sesi_no})
                  </option>
                ))}
              </select>
              <Button onClick={tukarPeserta} disabled={tukarBusy || !tukarA || !tukarB}>
                <ArrowLeftRight className="size-4 mr-1" /> Tukar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Urutan Peserta</CardTitle>
            <CardDescription>
              Klik nama peserta untuk mengubah datanya. Tombol <b>Terlambat</b> menandai peserta yang tidak naik panggung —
              dianggap selesai dinilai dengan nilai akhir 1.
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
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedList.map((r) => (
                    <TableRow key={r.peserta_id} className={r.sedang_tampil ? "bg-accent/10" : ""}>
                      <TableCell>{r.nomor_urut}</TableCell>
                      <TableCell>
                        <button type="button" onClick={() => pilihEdit(r)} className="font-medium text-left hover:underline hover:text-primary">
                          {r.nama}
                        </button>
                        <div className="text-xs text-muted-foreground">{r.asal ?? ""}{r.kategori ? ` · ${r.kategori}` : ""}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">Sesi {r.sesi_no}</Badge></TableCell>
                      <TableCell>
                        {r.terlambat ? (
                          <Badge variant="destructive">Terlambat</Badge>
                        ) : r.sedang_tampil ? (
                          <Badge className="bg-amber-500 text-white">Sedang Tampil</Badge>
                        ) : r.final ? (
                          <Badge className="bg-emerald-600 text-white">Selesai</Badge>
                        ) : (
                          <Badge className="bg-muted text-foreground">Belum Tampil</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button size="sm" variant={r.terlambat ? "secondary" : "outline"} onClick={() => toggleTerlambat(r)}>
                            <Clock className="size-4 mr-1" /> {r.terlambat ? "Batal" : "Terlambat"}
                          </Button>
                          <Button size="sm" variant="outline" disabled={!r.final || busy === r.peserta_id} onClick={() => unduhCatatan(r)}>
                            <FileText className="size-4 mr-1" /> Unduh
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => hapusPeserta(r)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, list.length)}–{Math.min(page * PAGE_SIZE, list.length)} dari {list.length} peserta
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="size-4 mr-1" /> Sebelumnya
                  </Button>
                  <span className="text-sm px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Selanjutnya <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
