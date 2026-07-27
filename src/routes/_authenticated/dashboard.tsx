import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { Trash2, Plus, Trophy, Users, Gavel, ListChecks, ClipboardCheck, BookOpenText, Upload, Download, Check, Tags, ChevronLeft, ChevronRight, LayoutDashboard, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: App,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null; sesi: string | null; kategori: string | null };
type Juri = { id: string; nama: string; jabatan: string | null; email: string | null; role: "admin" | "juri" | "viewer" | null; approved: boolean; user_id: string | null };
type Kriteria = { id: string; nama: string; bobot: number; batas_atas: number; batas_bawah: number };
type Mazmur = { id: string; bacaan: string; jumlah_ayat: number; kategori: string | null };
type Penilaian = { id: string; peserta_id: string; juri_id: string; kriteria_id: string; nilai: number; mazmur_id: string | null };
type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };
type Kategori = { id: string; kategori: string | null; batas_atas: number; batas_bawah: number; kriteria_penilaian: string | null; kriteria_peserta: string | null; bobot: number; nilai_tengah: number; nilai_standart: number };

function App() {
  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-9 h-auto bg-secondary/60 p-1">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="size-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="posisi" className="gap-2"><Trophy className="size-4" />Posisi</TabsTrigger>
            <TabsTrigger value="penilaian" className="gap-2"><ClipboardCheck className="size-4" />Penilaian</TabsTrigger>
            <TabsTrigger value="peserta" className="gap-2"><Users className="size-4" />Peserta</TabsTrigger>
            <TabsTrigger value="juri" className="gap-2"><Gavel className="size-4" />Juri</TabsTrigger>
            <TabsTrigger value="kriteria" className="gap-2"><ListChecks className="size-4" />Kriteria</TabsTrigger>
            <TabsTrigger value="kategori" className="gap-2"><Tags className="size-4" />Kategori</TabsTrigger>
            <TabsTrigger value="mazmur" className="gap-2"><BookOpenText className="size-4" />Mazmur</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="ranking"><RankingTab /></TabsContent>
          <TabsContent value="posisi"><PosisiTab /></TabsContent>
          <TabsContent value="penilaian"><PenilaianTab /></TabsContent>
          <TabsContent value="peserta"><PesertaTab /></TabsContent>
          <TabsContent value="juri"><JuriTab /></TabsContent>
          <TabsContent value="kriteria"><KriteriaTab /></TabsContent>
          <TabsContent value="kategori"><KategoriTab /></TabsContent>
          <TabsContent value="mazmur"><MazmurTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Header() {
  
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }
  return (
    <header className="border-b bg-card/60 backdrop-blur mb-8">
      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid place-items-center size-14 shrink-0 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30">
            <BookOpenText className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Lomba Rohani</p>
            <h1 className="truncate text-2xl sm:text-4xl font-serif font-semibold text-foreground">Sistem Penjurian Baca Mazmur</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola peserta, juri, kriteria, dan lihat ranking secara langsung.</p>
          </div>
        </div>
        <Button variant="outline" onClick={signOut} className="shrink-0">Keluar</Button>
      </div>
    </header>
  );
}

/* PESERTA */
function PesertaTab() {
  const [items, setItems] = useState<Peserta[]>([]);
  const [scoredIds, setScoredIds] = useState<Set<string>>(new Set());
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [asal, setAsal] = useState("");
  const [kategori, setKategori] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sesiDari = (n: number) => `Sesi ${Math.ceil(n / 10)}`;

  async function load() {
    const [{ data, error }, { data: pen, error: pe }, { data: mz }] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("penilaian").select("peserta_id"),
      supabase.from("mazmur").select("kategori"),
    ]);
    if (error) return toast.error(error.message);
    if (pe) return toast.error(pe.message);
    setItems((data ?? []) as Peserta[]);
    setScoredIds(new Set((pen ?? []).map((r: { peserta_id: string }) => r.peserta_id)));
    const uniq = Array.from(new Set((mz ?? []).map((m: any) => (m.kategori || "").trim()).filter(Boolean))) as string[];
    setKategoriList(uniq);
  }
  useEffect(() => { load(); }, []);

  async function resetSemua() {
    if (!confirm("Yakin ingin menghapus SEMUA daftar peserta beserta seluruh nilainya? Tindakan ini tidak dapat dibatalkan.")) return;
    setResetting(true);
    const { error: pe } = await supabase.from("penilaian").delete().not("id", "is", null);
    if (pe) { setResetting(false); return toast.error("Gagal menghapus penilaian: " + pe.message); }
    const { error } = await supabase.from("peserta").delete().not("id", "is", null);
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success("Semua peserta dihapus");
    setEditId(null); setNomor(""); setNama(""); setAsal(""); setKategori("");
    load();
  }


  function pilihUntukEdit(p: Peserta) {
    setEditId(p.id);
    setNomor(String(p.nomor_urut));
    setNama(p.nama);
    setAsal(p.asal || "");
    setKategori(p.kategori || "");
  }

  function batalEdit() {
    setEditId(null);
    setNomor(""); setNama(""); setAsal(""); setKategori("");
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor || !nama) return toast.error("Nomor urut dan nama wajib diisi");
    const n = Number(nomor);
    setLoading(true);

    if (!editId) {
      const payload = { nomor_urut: n, nama, asal: asal || null, sesi: sesiDari(n), kategori: kategori || null };
      const { error } = await supabase.from("peserta").insert(payload);
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Peserta ditambahkan");
      setNomor(""); setNama(""); setAsal(""); setKategori("");
      load();
      return;
    }

    const original = items.find(x => x.id === editId);
    if (!original) { setLoading(false); return; }
    const oldN = original.nomor_urut;

    if (n === oldN) {
      const { error } = await supabase.from("peserta").update({ nama, asal: asal || null, kategori: kategori || null }).eq("id", editId);
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Peserta diperbarui");
      setEditId(null); setNomor(""); setNama(""); setAsal(""); setKategori("");
      load();
      return;
    }


    // Nomor berubah — validasi peserta yg diedit belum dinilai
    const { count: cntEdit, error: pe1 } = await supabase
      .from("penilaian").select("id", { count: "exact", head: true }).eq("peserta_id", editId);
    if (pe1) { setLoading(false); return toast.error(pe1.message); }
    if ((cntEdit ?? 0) > 0) {
      setLoading(false);
      return toast.error("Peserta ini sudah dinilai, nomor urut tidak bisa diubah");
    }

    // Rantai peserta yang tergeser. Jika pindah maju (oldN -> n, n>oldN):
    // peserta pada (oldN, n] digeser -1 agar mengisi celah.
    // Jika pindah mundur (n < oldN): peserta pada [n, oldN) digeser +1.
    const chain: { p: Peserta; newNum: number }[] = [];
    if (n > oldN) {
      for (const p of items) {
        if (p.id === editId) continue;
        if (p.nomor_urut > oldN && p.nomor_urut <= n) {
          chain.push({ p, newNum: p.nomor_urut - 1 });
        }
      }
    } else {
      for (const p of items) {
        if (p.id === editId) continue;
        if (p.nomor_urut >= n && p.nomor_urut < oldN) {
          chain.push({ p, newNum: p.nomor_urut + 1 });
        }
      }
    }

    if (chain.length > 0) {
      const ids = chain.map(c => c.p.id);
      const { data: assessed, error: aerr } = await supabase
        .from("penilaian").select("peserta_id").in("peserta_id", ids).limit(1);
      if (aerr) { setLoading(false); return toast.error(aerr.message); }
      if (assessed && assessed.length > 0) {
        setLoading(false);
        return toast.error("Ada peserta terdampak yang sudah dinilai, nomor tidak bisa diubah");
      }
    }

    // Hindari konflik unique: bump rantai ke nomor sementara dulu
    const TEMP_BASE = 1000000;
    for (let i = 0; i < chain.length; i++) {
      const { error: te } = await supabase.from("peserta")
        .update({ nomor_urut: TEMP_BASE + i }).eq("id", chain[i].p.id);
      if (te) { setLoading(false); return toast.error(te.message); }
    }
    const { error: ue } = await supabase.from("peserta")
      .update({ nomor_urut: n, nama, asal: asal || null, sesi: sesiDari(n), kategori: kategori || null }).eq("id", editId);
    if (ue) { setLoading(false); return toast.error(ue.message); }
    for (let i = 0; i < chain.length; i++) {
      const newNum = chain[i].newNum;
      const { error: fe } = await supabase.from("peserta")
        .update({ nomor_urut: newNum, sesi: sesiDari(newNum) }).eq("id", chain[i].p.id);
      if (fe) { setLoading(false); return toast.error(fe.message); }
    }


    setLoading(false);
    toast.success("Peserta diperbarui & urutan disesuaikan");
    setEditId(null); setNomor(""); setNama(""); setAsal(""); setKategori("");

    load();
  }

  async function hapus(id: string) {
    const { error } = await supabase.from("peserta").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Peserta dihapus");
    load();
  }

  function unduhTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nomor_urut", "nama", "asal", "kategori"],
      [1, "Contoh Nama", "Jemaat Contoh", "Dewasa"],
      [2, "Contoh Nama 2", "", "Remaja"],
    ]);
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peserta");
    XLSX.writeFile(wb, "template-peserta.xlsx");
  }


  function pickFile() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const normalized = rows
        .map((r) => {
          const keys = Object.keys(r).reduce<Record<string, unknown>>((acc, k) => {
            acc[k.toString().trim().toLowerCase().replace(/\s+/g, "_")] = r[k];
            return acc;
          }, {});
          const nomor_urut = Number(keys["nomor_urut"] ?? keys["no"] ?? keys["nomor"]);
          const nama = String(keys["nama"] ?? "").trim();
          const asalRaw = keys["asal"] ?? keys["jemaat"] ?? keys["asal_/_jemaat"] ?? "";
          const asal = String(asalRaw).trim();
          const kategori = String(keys["kategori"] ?? "").trim();
          return { nomor_urut, nama, asal: asal || null, sesi: isNaN(nomor_urut) ? null : sesiDari(nomor_urut), kategori: kategori || null };

        })
        .filter((r) => r.nama && !isNaN(r.nomor_urut));

      if (normalized.length === 0) {
        toast.error("Tidak ada baris valid. Pastikan kolom: nomor_urut, nama, asal");
        return;
      }

      const { error } = await supabase.from("peserta").insert(normalized);
      if (error) return toast.error(error.message);
      toast.success(`${normalized.length} peserta berhasil diimpor`);
      load();
    } catch (err) {
      toast.error("Gagal membaca file: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setImporting(false);
    }
  }


  return (
    <SectionCard
      title="Daftar Peserta"
      description="Tambahkan peserta satu per satu atau impor banyak sekaligus dari file Excel."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={unduhTemplate} className="gap-1"><Download className="size-4" />Template</Button>
          <Button variant="secondary" size="sm" onClick={pickFile} disabled={importing} className="gap-1"><Upload className="size-4" />{importing ? "Mengimpor..." : "Impor Excel"}</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </div>
      }
    >
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_1fr_auto] gap-3 mb-6">
        <div><Label>Nomor</Label><Input type="number" value={nomor} onChange={e=>setNomor(e.target.value)} placeholder="1" /></div>
        <div><Label>Nama</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama peserta" /></div>
        <div><Label>Asal / Jemaat</Label><Input value={asal} onChange={e=>setAsal(e.target.value)} placeholder="Jemaat / kelompok" /></div>
        <div><Label>Kategori</Label><Input value={kategori} onChange={e=>setKategori(e.target.value)} placeholder="Dewasa / Remaja / dll" /></div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading} className="gap-1"><Plus className="size-4" />{editId ? "Ubah" : "Tambah"}</Button>
          {editId && <Button type="button" variant="ghost" onClick={batalEdit}>Batal</Button>}
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">No.</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Asal</TableHead>
              <TableHead className="w-28">Sesi</TableHead>
              <TableHead className="w-32">Kategori</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada peserta.</TableCell></TableRow>}
            {items.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                <TableCell className="font-medium"><button type="button" onClick={()=>pilihUntukEdit(p)} className="text-left hover:underline hover:text-primary transition-colors">{p.nama}</button></TableCell>
                <TableCell className="text-muted-foreground">{p.asal || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{scoredIds.has(p.id) ? sesiDari(p.nomor_urut) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.kategori || "—"}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(p.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </SectionCard>
  );
}

/* JURI */
function JuriTab() {
  const [items, setItems] = useState<Juri[]>([]);

  async function load() {
    const { data, error } = await supabase.rpc("admin_list_juri" as any);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Juri[]);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    try {
      const { approveJuri } = await import("@/lib/juri-users.functions");
      await approveJuri({ data: { juriId: id } });
      toast.success("Akun disetujui — dapat login sekarang");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyetujui");
    }
  }
  return (
    <SectionCard title="Dewan Juri" description="Daftar pendaftar juri dari halaman beranda. Setujui akun agar dapat login.">
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {items.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">Belum ada pendaftar juri.</div>
        )}
        {items.map(j => (
          <div key={j.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{j.nama}</div>
                <div className="text-xs text-muted-foreground truncate">{j.jabatan || "—"}</div>
              </div>
              <Badge variant="outline" className="capitalize shrink-0">{j.role || "—"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground break-all">{j.email || "—"}</div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {j.approved ? (
                <Badge className="bg-accent text-accent-foreground gap-1"><Check className="size-3" />Disetujui</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Menunggu</Badge>
              )}
              {!j.approved && (
                <Button size="sm" variant="default" onClick={()=>approve(j.id)} className="gap-1">
                  <Check className="size-4" />Approve
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada pendaftar juri.</TableCell></TableRow>}
            {items.map(j => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.nama}</TableCell>
                <TableCell className="text-muted-foreground">{j.jabatan || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{j.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{j.role || "—"}</Badge>
                </TableCell>
                <TableCell>
                  {j.approved ? (
                    <Badge className="bg-accent text-accent-foreground gap-1"><Check className="size-3" />Disetujui</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Menunggu disetujui</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {j.approved ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button size="sm" variant="default" onClick={()=>approve(j.id)} className="gap-1">
                      <Check className="size-4" />Approve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}



/* MAZMUR */
function MazmurTab() {
  const [items, setItems] = useState<Mazmur[]>([]);
  const [bacaan, setBacaan] = useState("");
  const [jumlahAyat, setJumlahAyat] = useState("");
  const [kategori, setKategori] = useState("");

  async function load() {
    const { data, error } = await supabase.from("mazmur").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Mazmur[]);
  }
  useEffect(() => { load(); }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!bacaan || !jumlahAyat) return toast.error("Bacaan & jumlah ayat wajib diisi");
    const kategoriTrim = kategori.trim();
    const { error } = await supabase.from("mazmur").insert({
      bacaan,
      jumlah_ayat: Number(jumlahAyat),
      kategori: kategoriTrim || null,
    });
    if (error) return toast.error(error.message);
    if (kategoriTrim) {
      const { data: existing } = await supabase
        .from("kategori").select("id").ilike("kategori", kategoriTrim).maybeSingle();
      if (!existing) {
        const { error: kErr } = await supabase.from("kategori").insert({
          kategori: kategoriTrim, batas_atas: 100, batas_bawah: 0,
        });
        if (kErr) toast.warning("Kategori tidak tersinkron: " + kErr.message);
        else toast.success("Kategori baru ditambahkan otomatis");
      }
    }
    toast.success("Bacaan mazmur ditambahkan");
    setBacaan(""); setJumlahAyat(""); setKategori(""); load();
  }

  async function hapus(id: string) {
    const { error } = await supabase.from("mazmur").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <SectionCard title="Daftar Bacaan Mazmur" description="Kelola daftar bacaan mazmur beserta jumlah ayat dan kategorinya.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_auto] gap-3 mb-6">
        <div><Label>Bacaan Mazmur</Label><Input value={bacaan} onChange={e=>setBacaan(e.target.value)} placeholder="Mzm. 23" /></div>
        <div><Label>Jumlah Ayat</Label><Input type="number" min={0} value={jumlahAyat} onChange={e=>setJumlahAyat(e.target.value)} placeholder="6" /></div>
        <div><Label>Kategori</Label><Input value={kategori} onChange={e=>setKategori(e.target.value)} placeholder="Contoh: Anak" /></div>
        <div className="flex items-end"><Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Bacaan</TableHead><TableHead className="text-center w-40">Jumlah Ayat</TableHead><TableHead className="w-40">Kategori</TableHead><TableHead className="w-20 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada bacaan.</TableCell></TableRow>}
            {items.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.bacaan}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{m.jumlah_ayat} ayat</Badge></TableCell>
                <TableCell>{m.kategori || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(m.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}



/* KATEGORI */
const KRITERIA_PENILAIAN_OPTIONS = [
  "Vocal dan Artikulasi",
  "Penghayatan",
  "Intonasi & Pelafalan",
  "Penampilan",
  "Catatan Juri",
  "Perhatian",
] as const;

function KategoriTab() {
  const [items, setItems] = useState<Kategori[]>([]);
  const [mazmurKategoriList, setMazmurKategoriList] = useState<string[]>([]);
  const [kriteriaPenilaian, setKriteriaPenilaian] = useState<string>("");
  const [kriteriaPeserta, setKriteriaPeserta] = useState("");
  const [bobot, setBobot] = useState("");
  const [batasAtas, setBatasAtas] = useState("");
  const [batasBawah, setBatasBawah] = useState("");
  const [nilaiTengah, setNilaiTengah] = useState("");
  const [nilaiStandart, setNilaiStandart] = useState("");

  async function load() {
    const { data, error } = await supabase.from("kategori").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Kategori[]);
  }
  async function loadMazmurKategori() {
    const { data, error } = await supabase.from("mazmur").select("kategori");
    if (error) return;
    const uniq = Array.from(new Set((data ?? []).map((m: any) => (m.kategori || "").trim()).filter(Boolean))) as string[];
    setMazmurKategoriList(uniq);
  }
  useEffect(() => { load(); loadMazmurKategori(); }, []);


  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!kriteriaPenilaian) return toast.error("Kriteria Penilaian wajib dipilih");
    const { error } = await supabase.from("kategori").insert({
      kriteria_penilaian: kriteriaPenilaian,
      kriteria_peserta: kriteriaPeserta || null,
      bobot: Number(bobot) || 0,
      batas_atas: Number(batasAtas) || 0,
      batas_bawah: Number(batasBawah) || 0,
      nilai_tengah: Number(nilaiTengah) || 0,
      nilai_standart: Number(nilaiStandart) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Kategori ditambahkan");
    setKriteriaPenilaian(""); setKriteriaPeserta(""); setBobot("");
    setBatasAtas(""); setBatasBawah(""); setNilaiTengah(""); setNilaiStandart("");
    load();
  }

  async function hapus(id: string) {
    if (!confirm("Hapus kategori ini?")) return;
    const { error } = await supabase.from("kategori").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Kategori dihapus");
    load();
  }

  return (
    <SectionCard title="Daftar Kategori" description="Kelola kriteria penilaian beserta bobot, batas, dan nilai standar.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="lg:col-span-2">
          <Label>Kriteria Penilaian</Label>
          <Select value={kriteriaPenilaian} onValueChange={setKriteriaPenilaian}>
            <SelectTrigger><SelectValue placeholder="Pilih kriteria" /></SelectTrigger>
            <SelectContent>
              {KRITERIA_PENILAIAN_OPTIONS.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="lg:col-span-2">
          <Label>Kriteria Peserta</Label>
          <Select value={kriteriaPeserta} onValueChange={setKriteriaPeserta}>
            <SelectTrigger><SelectValue placeholder={mazmurKategoriList.length ? "Pilih kategori peserta" : "Belum ada kategori di menu Mazmur"} /></SelectTrigger>
            <SelectContent>
              {mazmurKategoriList.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div><Label>Bobot</Label><Input type="number" step="0.01" value={bobot} onChange={e=>setBobot(e.target.value)} placeholder="0" /></div>
        <div><Label>Batas Atas</Label><Input type="number" step="0.01" value={batasAtas} onChange={e=>setBatasAtas(e.target.value)} placeholder="100" /></div>
        <div><Label>Batas Bawah</Label><Input type="number" step="0.01" value={batasBawah} onChange={e=>setBatasBawah(e.target.value)} placeholder="0" /></div>
        <div><Label>Nilai Tengah</Label><Input type="number" step="0.01" value={nilaiTengah} onChange={e=>setNilaiTengah(e.target.value)} placeholder="50" /></div>
        <div><Label>Nilai Standart</Label><Input type="number" step="0.01" value={nilaiStandart} onChange={e=>setNilaiStandart(e.target.value)} placeholder="75" /></div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button>
        </div>
      </form>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kriteria Penilaian</TableHead>
              <TableHead>Kriteria Peserta</TableHead>
              <TableHead className="text-center">Bobot</TableHead>
              <TableHead className="text-center">Batas Atas</TableHead>
              <TableHead className="text-center">Batas Bawah</TableHead>
              <TableHead className="text-center">Nilai Tengah</TableHead>
              <TableHead className="text-center">Nilai Standart</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada kategori.</TableCell></TableRow>}
            {items.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.kriteria_penilaian || k.kategori || "—"}</TableCell>
                <TableCell>{k.kriteria_peserta || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-center">{Number(k.bobot)}</TableCell>
                <TableCell className="text-center">{Number(k.batas_atas)}</TableCell>
                <TableCell className="text-center">{Number(k.batas_bawah)}</TableCell>
                <TableCell className="text-center">{Number(k.nilai_tengah)}</TableCell>
                <TableCell className="text-center">{Number(k.nilai_standart)}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(k.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}



function KriteriaTab() {
  const [items, setItems] = useState<Kriteria[]>([]);
  const [nama, setNama] = useState("");
  const [bobot, setBobot] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function load() {
    const { data, error } = await supabase.from("kriteria").select("*").order("created_at");
    if (error) return toast.error(error.message);
    const rows = (data ?? []) as Kriteria[];
    setItems(rows);
    setEdits(Object.fromEntries(rows.map(r => [r.id, String(Number(r.bobot))])));
  }
  useEffect(() => { load(); }, []);

  const totalBobot = useMemo(() => items.reduce((s, k) => s + Number(k.bobot), 0), [items]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nama || !bobot) return toast.error("Nama & bobot wajib diisi");
    const { error } = await supabase.from("kriteria").insert({ nama, bobot: Number(bobot) });
    if (error) return toast.error(error.message);
    toast.success("Kriteria ditambahkan");
    setNama(""); setBobot(""); load();
  }

  async function hapus(id: string) {
    if (!confirm("Hapus kriteria ini?")) return;
    const { error } = await supabase.from("kriteria").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Kriteria dihapus");
    load();
  }


  return (
    <SectionCard title="Kriteria Penilaian" description="Atur aspek dan bobot setiap kriteria.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 mb-6">
        <div><Label>Nama Kriteria</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Contoh: Seri Baca Mazmur" /></div>
        <div><Label>Bobot (%)</Label><Input type="number" step="0.1" value={bobot} onChange={e=>setBobot(e.target.value)} placeholder="25" /></div>
        <div className="flex items-end"><Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kriteria</TableHead><TableHead className="w-40">Bobot</TableHead><TableHead className="w-28 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada kriteria.</TableCell></TableRow>}
            {items.map(k => (
              <TableRow key={k.id}>
                <TableCell>
                  <div className="font-medium">{k.nama}</div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-24"
                      value={edits[k.id] ?? ""}
                      onChange={e => setEdits(prev => ({ ...prev, [k.id]: e.target.value }))}
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => hapus(k.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>

              </TableRow>
            ))}
            <TableRow className="bg-muted/50">
              <TableCell className="font-semibold text-right">Total</TableCell>
              <TableCell colSpan={2}><Badge className={totalBobot === 100 ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}>{totalBobot}%</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

const GRADE_DESCRIPTIONS: Record<string, string[]> = {
  vokal: [
    "Membaca tanpa memahami makna teks.",
    "Memahami isi tetapi penyampaian terbatas.",
    "Menyampaikan pesan Mazmur dengan baik.",
    "Mampu menyampaikan makna dengan penghayatan kuat.",
    "Penyampaian sangat mendalam, menyentuh, dan membawa pendengar memahami pesan Mazmur.",
  ],
  penghayatan: [
    "Membaca datar tanpa penghayatan.",
    "Ada usaha menghayati tetapi belum konsisten.",
    "Penghayatan cukup baik sesuai isi.",
    "Ekspresi dan emosi mendukung bacaan.",
    "Sangat menghayati dan mampu menyentuh.",
  ],
  intonasi: [
    "Banyak kesalahan pengucapan.",
    "Masih terdapat beberapa kesalahan.",
    "Pengucapan cukup jelas.",
    "Artikulasi jelas dan nyaman didengar.",
    "Pengucapan sangat jelas dan sempurna.",
  ],
  penampilan: [
    "Kurang percaya diri.",
    "Mulai percaya diri tetapi masih kaku.",
    "Penampilan cukup baik.",
    "Menguasai panggung dengan baik.",
    "Penampilan sangat baik dan alami.",
  ],
};

const CATATAN_ASPEK = [
  "Kesan dari teks bacaan",
  "Penguasaan teks",
  "Emosi",
  "Ekspresi",
  "Intonasi dan Irama",
  "Kesesuaian Vokal",
  "Penggunaan kata dan kalimat sesuai teks bacaan",
  "Sesuai Tanda Baca",
  "Keserasian Penampilan",
  "Penguasaan Panggung",
];

const PERHATIAN_ASPEK = [
  "Tidak Membaca Perikop",
  "Salah kata",
  "Mengubah makna teks",
  "Menambah kata",
  "Mengurangi kata",
  "Tidak berhenti pada koma",
  "Tidak berhenti pada titik",
  "Jeda mengganggu makna",
  "Suara kurang jelas",
  "Tempo terlalu cepat",
  "Tempo terlalu lambat",
];

function kriteriaKey(nama: string): keyof typeof GRADE_DESCRIPTIONS | "catatan" | "perhatian" | null {
  const n = nama.toLowerCase();
  if (n.includes("perhatian")) return "perhatian";
  if (n.includes("catatan")) return "catatan";
  if (n.includes("vokal")) return "vokal";
  if (n.includes("hayat")) return "penghayatan";
  if (n.includes("intonasi") || n.includes("pelafalan")) return "intonasi";
  if (n.includes("penampilan")) return "penampilan";
  return null;
}


/* PENILAIAN */
function CriteriaPillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full rounded-[2rem] border-[2px] border-primary/40 px-6 py-8 sm:py-10",
        "text-center font-serif transition-all duration-200 ease-out",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
        "translate-y-0 hover:-translate-y-1 active:translate-y-1",
        active
          ? "bg-gradient-to-b from-accent/90 to-accent text-accent-foreground border-primary/70 shadow-[0_8px_0_0_hsl(var(--primary)/0.6),0_16px_24px_-6px_hsl(var(--primary)/0.35)] active:shadow-[0_3px_0_0_hsl(var(--primary)/0.6),0_6px_10px_-2px_hsl(var(--primary)/0.3)]"
          : "bg-gradient-to-b from-card to-secondary/60 text-foreground shadow-[0_6px_0_0_hsl(var(--primary)/0.35),0_12px_20px_-6px_hsl(var(--primary)/0.25)] hover:shadow-[0_10px_0_0_hsl(var(--primary)/0.45),0_18px_28px_-6px_hsl(var(--primary)/0.35)] active:shadow-[0_3px_0_0_hsl(var(--primary)/0.35),0_6px_10px_-2px_hsl(var(--primary)/0.25)]",
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-x-6 top-2 h-[3px] rounded-full bg-white/50 blur-[1px]" />
      <div className="relative flex items-center justify-center">
        <span className="text-xl sm:text-2xl font-semibold tracking-wide">
          {label}
        </span>
      </div>
    </button>
  );
}


function PenilaianTab() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [juri, setJuri] = useState<Juri[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [mazmur, setMazmur] = useState<Mazmur[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [juriId, setJuriId] = useState<string>("");
  const [pesertaId, setPesertaId] = useState<string>("");
  const [mazmurId, setMazmurId] = useState<string>("");
  const [openKriteria, setOpenKriteria] = useState<Kriteria | null>(null);
  const [catatanValues, setCatatanValues] = useState<number[]>(() => CATATAN_ASPEK.map(() => 3));
  const [perhatianChecks, setPerhatianChecks] = useState<boolean[][]>(() => PERHATIAN_ASPEK.map(() => []));
  const [saving, setSaving] = useState(false);


  async function loadAll() {
    const [p, j, k, m, n] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("mazmur").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
    ]);
    if (p.error || j.error || k.error || m.error || n.error) return toast.error("Gagal memuat data");
    setPeserta(p.data ?? []);
    setJuri((j.data ?? []) as unknown as Juri[]);
    setKriteria(k.data ?? []);
    setMazmur((m.data ?? []) as Mazmur[]);
    setPenilaian((n.data ?? []) as Penilaian[]);
  }
  useEffect(() => { loadAll(); }, []);

  const canJudge = peserta.length > 0 && juri.length > 0 && kriteria.length > 0;
  const selectedMazmur = mazmur.find(m => m.id === mazmurId);

  function currentNilai(kId: string): number | null {
    if (!juriId || !pesertaId) return null;
    const row = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === kId);
    return row ? Number(row.nilai) : null;
  }

  function openDialog(k: Kriteria) {
    if (!juriId) return toast.error("Pilih juri terlebih dahulu");
    if (!pesertaId) return toast.error("Pilih peserta terlebih dahulu");
    const key = kriteriaKey(k.nama);
    if (key === "catatan") {
      setCatatanValues(CATATAN_ASPEK.map(() => 3));
    }
    if (key === "perhatian") {
      if (!selectedMazmur) return toast.error("Pilih bacaan mazmur terlebih dahulu");
      setPerhatianChecks(PERHATIAN_ASPEK.map(() => Array(selectedMazmur.jumlah_ayat).fill(false)));
    }
    setOpenKriteria(k);
  }


  async function saveNilai(nilai: number) {
    if (!openKriteria) return;
    setSaving(true);
    const { error } = await supabase.from("penilaian").upsert(
      {
        juri_id: juriId,
        peserta_id: pesertaId,
        kriteria_id: openKriteria.id,
        nilai,
        mazmur_id: mazmurId || null,
      },
      { onConflict: "peserta_id,juri_id,kriteria_id" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Nilai ${openKriteria.nama} disimpan`);
    setOpenKriteria(null);
    setCatatanValues(CATATAN_ASPEK.map(() => 3));
    setPerhatianChecks([]);
    setPesertaId("");
    loadAll();
  }

  async function saveCatatan() {
    const avg = catatanValues.reduce((a, b) => a + b, 0) / catatanValues.length;
    const nilai = Math.round(avg * 20 * 100) / 100; // scale 1-5 → 20-100
    await saveNilai(nilai);
  }

  const perhatianTotal = perhatianChecks.reduce((s, row) => s + row.length, 0);
  const perhatianChecked = perhatianChecks.reduce((s, row) => s + row.filter(Boolean).length, 0);
  const perhatianNilai = perhatianTotal === 0
    ? 0
    : Math.round(((perhatianTotal - perhatianChecked) / perhatianTotal) * 100 * 100) / 100;

  async function savePerhatian() {
    await saveNilai(perhatianNilai);
  }


  const activeKey = openKriteria ? kriteriaKey(openKriteria.nama) : null;

  return (
    <SectionCard title="Input Penilaian" description="Pilih juri, peserta, bacaan mazmur, lalu klik kriteria untuk memberi nilai.">
      {!canJudge && (
        <div className="rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 p-6 text-center text-sm text-muted-foreground">
          Lengkapi dulu data <b>peserta</b>, <b>juri</b>, dan <b>kriteria</b> sebelum memulai penilaian.
        </div>
      )}
      {canJudge && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <Label>Juri</Label>
              <Select value={juriId} onValueChange={setJuriId}>
                <SelectTrigger><SelectValue placeholder="Pilih juri" /></SelectTrigger>
                <SelectContent>
                  {juri.map(j => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peserta</Label>
              <Select value={pesertaId} onValueChange={setPesertaId}>
                <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
                <SelectContent>
                  {peserta.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nomor_urut}. {p.nama}{p.asal ? ` — ${p.asal}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-8">
            <div>
              <Label>Bacaan Mazmur</Label>
              <Select value={mazmurId} onValueChange={setMazmurId}>
                <SelectTrigger>
                  <SelectValue placeholder={mazmur.length === 0 ? "Belum ada bacaan — tambahkan di tab Mazmur" : "Pilih bacaan mazmur"} />
                </SelectTrigger>
                <SelectContent>
                  {mazmur.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.bacaan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jumlah Ayat</Label>
              <Input readOnly value={selectedMazmur ? String(selectedMazmur.jumlah_ayat) : ""} placeholder="—" className="bg-muted/50" />
            </div>
          </div>

          <div className="mb-2">
            <Label className="text-base">Pilih Kriteria</Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8 pb-4">
            {kriteria.map(k => {
              const val = currentNilai(k.id);
              return (
                <div key={k.id} className="relative">
                  <CriteriaPillButton
                    label={k.nama}
                    active={val !== null}
                    onClick={() => openDialog(k)}
                  />
                </div>
              );
            })}

          </div>

          {(() => {
            const scored = kriteria
              .map(k => ({ k, v: currentNilai(k.id) }))
              .filter(x => x.v !== null) as { k: Kriteria; v: number }[];
            const totalBobot = scored.reduce((s, x) => s + Number(x.k.bobot || 0), 0);
            const weighted = totalBobot > 0
              ? scored.reduce((s, x) => s + x.v * Number(x.k.bobot || 0), 0) / totalBobot
              : scored.length > 0
              ? scored.reduce((s, x) => s + x.v, 0) / scored.length
              : 0;
            const totalNilai = Math.round(weighted * 100) / 100;
            const semuaTerisi = scored.length === kriteria.length && kriteria.length > 0;

            async function kirimPenilaian() {
              if (!juriId || !pesertaId) return toast.error("Pilih juri dan peserta");
              if (scored.length === 0) return toast.error("Belum ada nilai yang diberikan");
              toast.success(`Penilaian dikirim. Nilai akhir: ${totalNilai}`);
              await loadAll();
            }

            return (
              <div className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-card to-secondary/40 p-5 sm:p-6 mb-4">
                <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Hasil Perhitungan</div>
                    <div className="mt-1 font-serif text-3xl sm:text-4xl text-primary">
                      Nilai: <b>{totalNilai}</b>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {scored.length} dari {kriteria.length} kriteria dinilai
                      {!semuaTerisi && scored.length > 0 && " — lengkapi semua kriteria sebelum mengirim"}
                    </div>
                  </div>
                  <div className="sm:justify-self-end">
                    <Button
                      size="lg"
                      onClick={kirimPenilaian}
                      disabled={saving || scored.length === 0}
                      className="gap-2 min-w-[160px]"
                    >
                      <Check className="size-4" />
                      Kirim
                    </Button>
                  </div>
                </div>
                {scored.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {scored.map(({ k, v }) => (
                      <span key={k.id} className="rounded-full border bg-background px-3 py-1 text-xs">
                        {k.nama}: <b className="text-primary">{v}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      <Dialog
        open={!!openKriteria}
        onOpenChange={(v) => {
          if (saving) return; // jangan tutup saat sedang menyimpan
          if (!v) setOpenKriteria(null);
        }}
      >
        <DialogContent
          className="max-w-2xl w-[95vw] max-h-[90dvh] p-4 sm:p-6 flex flex-col overflow-hidden"
          onPointerDownOutside={(e) => {
            // Cegah dialog tertutup akibat scroll sentuh / klik tidak sengaja di HP.
            e.preventDefault();
          }}
          onInteractOutside={(e) => e.preventDefault()}
        >

          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{openKriteria?.nama}</DialogTitle>
            <DialogDescription>
              {activeKey === "catatan"
                ? "Beri nilai 1–5 untuk setiap aspek berikut."
                : activeKey === "perhatian"
                ? "Centang setiap ayat yang mengalami masalah pada aspek terkait."
                : "Pilih grade yang paling sesuai dengan penampilan peserta."}
            </DialogDescription>

          </DialogHeader>

          {activeKey && activeKey !== "catatan" && activeKey !== "perhatian" && (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {(() => {
                const descs = GRADE_DESCRIPTIONS[activeKey];
                const items: { grade: number; label: string; desc: string }[] = [];
                for (let i = 0; i < descs.length; i++) {
                  items.push({ grade: i + 1, label: `Grade ${i + 1}`, desc: descs[i] });
                  if (i < descs.length - 1) {
                    items.push({
                      grade: i + 1.5,
                      label: `Grade ${i + 1}–${i + 2}`,
                      desc: `Antara "${descs[i]}" dan "${descs[i + 1]}".`,
                    });
                  }
                }
                return items.map(({ grade, label, desc }) => (
                  <button
                    key={grade}
                    type="button"
                    disabled={saving}
                    onClick={() => saveNilai(grade * 20)}
                    className="flex items-start gap-4 text-left rounded-xl border-2 border-primary/20 bg-card p-4 hover:border-accent hover:bg-accent/5 transition disabled:opacity-60"
                  >
                    <div className="grid place-items-center size-12 shrink-0 rounded-full bg-primary text-primary-foreground font-serif text-lg font-bold shadow">
                      {Number.isInteger(grade) ? grade : `${Math.floor(grade)}½`}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{label}</div>
                      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                    </div>
                  </button>
                ));
              })()}
            </div>
          )}

          {activeKey === "catatan" && (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {CATATAN_ASPEK.map((aspek, i) => (
                <div key={aspek} className="rounded-lg border bg-card p-3">
                  <div className="mb-2">
                    <span className="text-sm font-medium">{i + 1}. {aspek}</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCatatanValues(prev => prev.map((x, idx) => idx === i ? v : x))}
                        className={[
                          "rounded-md border-2 py-2 text-sm font-semibold transition",
                          catatanValues[i] === v
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-primary/20 bg-background hover:border-accent/60",
                        ].join(" ")}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setOpenKriteria(null)}>Batal</Button>
                <Button onClick={saveCatatan} disabled={saving} className="gap-1">
                  <Check className="size-4" />
                  {saving ? "Menyimpan..." : "Simpan Catatan"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {activeKey === "perhatian" && (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {PERHATIAN_ASPEK.map((aspek, i) => {
                const row = perhatianChecks[i] ?? [];
                return (
                  <div key={aspek} className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium mb-2">{i + 1}. {aspek}</div>
                    <div className="flex flex-wrap gap-2">
                      {row.map((checked, ayatIdx) => (
                        <label
                          key={ayatIdx}
                          className={[
                            "cursor-pointer select-none rounded-md border-2 px-3 py-1.5 text-xs font-semibold transition",
                            checked
                              ? "border-destructive bg-destructive text-destructive-foreground"
                              : "border-primary/20 bg-background hover:border-accent/60",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              setPerhatianChecks(prev =>
                                prev.map((r, idx) =>
                                  idx === i ? r.map((c, ai) => (ai === ayatIdx ? !c : c)) : r
                                )
                              )
                            }
                          />
                          Ayat {ayatIdx + 1}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setOpenKriteria(null)}>Batal</Button>
                <Button onClick={savePerhatian} disabled={saving} className="gap-1">
                  <Check className="size-4" />
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </div>
          )}


          {!activeKey && openKriteria && (
            <div className="py-4 text-sm text-muted-foreground">
              Kriteria ini belum memiliki panduan grade khusus. Tutup dialog dan gunakan kriteria standar (Vokal, Penghayatan, Intonasi, Penampilan, atau Catatan Juri).
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}




/* RANKING */
function RankingTab() {
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
    <SectionCard
      title="Papan Ranking"
      description="Peringkat dihitung otomatis dari total skor terbobot dari semua juri."
      action={<Button variant="outline" onClick={load}>Muat Ulang</Button>}
    >
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
            {rows.map((r, i) => {
              const belum = !(Number(r.total_skor) > 0);
              return (
              <TableRow key={r.peserta_id} className={!belum && i < 3 ? "bg-accent/10" : ""}>
                <TableCell className="text-center text-2xl">{belum ? "—" : (medals[i] ?? i + 1)}</TableCell>
                <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                <TableCell className="font-semibold">{r.nama}</TableCell>
                <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                <TableCell className="text-center">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : r.jumlah_juri}</TableCell>
                <TableCell className="text-right font-mono">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : Number(r.rata_rata).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">{belum ? <span className="text-muted-foreground italic font-normal">belum tampil</span> : Number(r.total_skor).toFixed(2)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

/* POSISI PER SESI */
function PosisiTab() {
  const [peserta, setPeserta] = useState<{ id: string; nama: string; asal: string | null; sesi: string | null; nomor_urut: number }[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, Ranking>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);


  async function load() {
    setLoading(true);
    const [{ data: rankData, error: rErr }, { data: pesertaData, error: pErr }] = await Promise.all([
      supabase.from("ranking").select("*"),
      supabase.from("peserta").select("id, nama, asal, sesi, nomor_urut"),
    ]);
    setLoading(false);
    if (rErr) return toast.error(rErr.message);
    if (pErr) return toast.error(pErr.message);
    const rmap: Record<string, Ranking> = {};
    (rankData ?? []).forEach((r) => { rmap[(r as Ranking).peserta_id] = r as Ranking; });
    setRankMap(rmap);
    setPeserta((pesertaData ?? []) as typeof peserta);
  }
  useEffect(() => { load(); }, []);

  const medals = ["🥇", "🥈", "🥉"];
  const grouped = useMemo(() => {
    const enrichedAll = peserta.map((p) => {
      const r = rankMap[p.id];
      const total = Number(r?.total_skor ?? 0);
      return { ...p, total, rata: Number(r?.rata_rata ?? 0), juri: Number(r?.jumlah_juri ?? 0), scored: !!r && total > 0 };
    });
    const scoredSorted = enrichedAll
      .filter((r) => r.scored)
      .sort((a, b) => a.nomor_urut - b.nomor_urut);
    const chunks: { key: string; label: string; range: string; list: typeof scoredSorted }[] = [];
    for (let i = 0; i < scoredSorted.length; i += 10) {
      const slice = scoredSorted.slice(i, i + 10);
      const ranked = [...slice].sort((a, b) => (b.total !== a.total ? b.total - a.total : a.nomor_urut - b.nomor_urut));
      const first = slice[0]?.nomor_urut ?? i + 1;
      const last = slice[slice.length - 1]?.nomor_urut ?? i + slice.length;
      const idx = Math.floor(i / 10) + 1;
      chunks.push({ key: `sesi-${idx}`, label: `Sesi ${idx}`, range: `No. ${first}–${last}`, list: ranked });
    }
    return chunks;
  }, [peserta, rankMap]);

  return (
    <SectionCard
      title="Posisi per Sesi"
      description="Setiap sesi berisi 10 peserta yang sudah dinilai beserta peringkatnya."
      action={<Button variant="outline" onClick={load}>Muat Ulang</Button>}
    >
      {loading && <p className="text-center py-10 text-muted-foreground">Memuat…</p>}
      {!loading && grouped.length === 0 && <p className="text-center py-10 text-muted-foreground">Belum ada peserta.</p>}
      {!loading && grouped.length > 0 && (() => {
        const safePage = Math.min(page, grouped.length - 1);
        const { key, label, range, list } = grouped[safePage];
        const scoredCount = list.filter((r) => r.scored).length;
        let rankedIdx = -1;
        return (
          <div className="space-y-4">
            <div key={key} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-accent/5 border-b">
                <div>
                  <p className="font-serif text-lg font-semibold">{label} <span className="text-sm font-normal text-muted-foreground">({range})</span></p>
                  <p className="text-xs text-muted-foreground">{list.length} peserta · {scoredCount} sudah dinilai</p>
                </div>
              </div>
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
                  {list.map((r) => {
                    if (r.scored) rankedIdx += 1;
                    const idx = r.scored ? rankedIdx : -1;
                    return (
                      <TableRow key={r.id} className={r.scored && idx < 3 ? "bg-accent/10" : ""}>
                        <TableCell className="text-center text-2xl">{r.scored ? (medals[idx] ?? idx + 1) : "—"}</TableCell>
                        <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                        <TableCell className="font-semibold">{r.nama}</TableCell>
                        <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                        <TableCell className="text-center">{r.scored ? r.juri : <span className="text-muted-foreground italic">belum tampil</span>}</TableCell>
                        <TableCell className="text-right font-mono">{r.scored ? r.rata.toFixed(2) : <span className="text-muted-foreground italic">belum tampil</span>}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">{r.scored ? r.total.toFixed(2) : <span className="text-muted-foreground italic font-normal">belum tampil</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="size-4" /> Sesi Sebelumnya
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {grouped.map((g, i) => (
                  <Button key={g.key} size="sm" variant={i === safePage ? "default" : "outline"} onClick={() => setPage(i)}>
                    {i + 1}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="sm" disabled={safePage >= grouped.length - 1} onClick={() => setPage((p) => Math.min(grouped.length - 1, p + 1))}>
                Sesi Berikutnya <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        );
      })()}
    </SectionCard>
  );
}


function SectionCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mt-6 border-accent/20 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-serif text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DashboardTab() {
  const [juri, setJuri] = useState<Juri[]>([]);
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [j, p, n] = await Promise.all([
      supabase.from("juri_public" as any).select("*").eq("approved", true).eq("role", "juri").order("nama"),
      supabase.from("peserta").select("*"),
      supabase.from("penilaian").select("*"),
    ]);
    setJuri((j.data as unknown as Juri[]) || []);
    setPeserta((p.data as Peserta[]) || []);
    setPenilaian((n.data as Penilaian[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalPeserta = peserta.length;

  const rows = useMemo(() => {
    return juri.map((j) => {
      const mine = penilaian.filter((p) => p.juri_id === j.id);
      const scoredIds = new Set(mine.map((p) => p.peserta_id));
      const sudahList = peserta.filter((p) => scoredIds.has(p.id)).sort((a, b) => a.nomor_urut - b.nomor_urut);
      const belumList = peserta.filter((p) => !scoredIds.has(p.id)).sort((a, b) => a.nomor_urut - b.nomor_urut);
      return {
        juri: j,
        sudah: sudahList.length,
        belum: belumList.length,
        sudahList,
        belumList,
        status: sudahList.length === 0 ? "belum" : belumList.length === 0 && totalPeserta > 0 ? "selesai" : "sebagian",
      };
    });
  }, [juri, peserta, penilaian, totalPeserta]);

  const totalSudahKirim = rows.filter((r) => r.sudah > 0).length;
  const totalBelumKirim = rows.filter((r) => r.sudah === 0).length;
  const totalSelesai = rows.filter((r) => r.status === "selesai").length;

  return (
    <SectionCard
      title="Dashboard Progres Juri"
      description="Pantau juri mana yang sudah dan belum mengirim nilai."
      action={<Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Juri" value={juri.length} />
        <StatCard label="Sudah Mengirim" value={totalSudahKirim} tone="ok" />
        <StatCard label="Belum Mengirim" value={totalBelumKirim} tone="warn" />
        <StatCard label="Selesai Semua" value={totalSelesai} tone="ok" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">Belum ada juri yang disetujui.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.juri.id} className="rounded-lg border p-4 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.juri.nama}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.juri.jabatan || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "selesai" ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1"><CheckCircle2 className="size-3.5" />Selesai</Badge>
                  ) : r.status === "sebagian" ? (
                    <Badge className="bg-amber-500 hover:bg-amber-500 text-white gap-1"><CheckCircle2 className="size-3.5" />Sebagian</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1"><XCircle className="size-3.5" />Belum Mengirim</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {r.sudah}/{totalPeserta} peserta
                  </span>
                </div>
              </div>

              {totalPeserta > 0 && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(r.sudah / totalPeserta) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {r.belumList.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Lihat {r.belumList.length} peserta yang belum dinilai
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.belumList.map((p) => (
                      <Badge key={p.id} variant="outline" className="text-xs">
                        #{p.nomor_urut} {p.nama}
                      </Badge>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
