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
import { Trash2, Plus, Trophy, Users, Gavel, ListChecks, ClipboardCheck, BookOpenText, Upload, Download, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: App,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null; sesi: string | null };
type Juri = { id: string; nama: string; jabatan: string | null; email: string | null; role: "admin" | "juri" | "viewer" | null; approved: boolean; user_id: string | null };
type Kriteria = { id: string; nama: string; bobot: number; batas_atas: number; batas_bawah: number };
type Mazmur = { id: string; bacaan: string; jumlah_ayat: number };
type Penilaian = { id: string; peserta_id: string; juri_id: string; kriteria_id: string; nilai: number; mazmur_id: string | null };
type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };

function App() {
  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto bg-secondary/60 p-1">
            <TabsTrigger value="ranking" className="gap-2"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="penilaian" className="gap-2"><ClipboardCheck className="size-4" />Penilaian</TabsTrigger>
            <TabsTrigger value="peserta" className="gap-2"><Users className="size-4" />Peserta</TabsTrigger>
            <TabsTrigger value="juri" className="gap-2"><Gavel className="size-4" />Juri</TabsTrigger>
            <TabsTrigger value="kriteria" className="gap-2"><ListChecks className="size-4" />Kriteria</TabsTrigger>
            <TabsTrigger value="mazmur" className="gap-2"><BookOpenText className="size-4" />Mazmur</TabsTrigger>
          </TabsList>
          <TabsContent value="ranking"><RankingTab /></TabsContent>
          <TabsContent value="penilaian"><PenilaianTab /></TabsContent>
          <TabsContent value="peserta"><PesertaTab /></TabsContent>
          <TabsContent value="juri"><JuriTab /></TabsContent>
          <TabsContent value="kriteria"><KriteriaTab /></TabsContent>
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
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [asal, setAsal] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingSesi, setUpdatingSesi] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sesiDari = (n: number) => `Sesi ${Math.ceil(n / 10)}`;

  async function load() {
    const { data, error } = await supabase.from("peserta").select("*").order("nomor_urut");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function pilihUntukEdit(p: Peserta) {
    setEditId(p.id);
    setNomor(String(p.nomor_urut));
    setNama(p.nama);
    setAsal(p.asal || "");
  }

  function batalEdit() {
    setEditId(null);
    setNomor(""); setNama(""); setAsal("");
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor || !nama) return toast.error("Nomor urut dan nama wajib diisi");
    setLoading(true);
    const n = Number(nomor);
    const payload = { nomor_urut: n, nama, asal: asal || null, sesi: sesiDari(n) };
    const { error } = editId
      ? await supabase.from("peserta").update(payload).eq("id", editId)
      : await supabase.from("peserta").insert(payload);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(editId ? "Peserta diperbarui" : "Peserta ditambahkan");
    setEditId(null);
    setNomor(""); setNama(""); setAsal("");
    load();
  }

  async function ubahSesi() {
    setUpdatingSesi(true);
    const { data, error } = await supabase.from("peserta").select("id, nomor_urut");
    if (error) { setUpdatingSesi(false); return toast.error(error.message); }
    const rows = data ?? [];
    let gagal = 0;
    for (const r of rows) {
      const { error: e } = await supabase.from("peserta").update({ sesi: sesiDari(r.nomor_urut) }).eq("id", r.id);
      if (e) gagal++;
    }
    setUpdatingSesi(false);
    if (gagal > 0) toast.error(`${gagal} peserta gagal diperbarui`);
    else toast.success("Sesi diperbarui berdasarkan nomor urut");
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
      ["nomor_urut", "nama", "asal"],
      [1, "Contoh Nama", "Jemaat Contoh"],
      [2, "Contoh Nama 2", ""],
    ]);
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }];
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
          return { nomor_urut, nama, asal: asal || null, sesi: isNaN(nomor_urut) ? null : sesiDari(nomor_urut) };
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
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_auto] gap-3 mb-6">
        <div><Label>Nomor</Label><Input type="number" value={nomor} onChange={e=>setNomor(e.target.value)} placeholder="1" /></div>
        <div><Label>Nama</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama peserta" /></div>
        <div><Label>Asal / Jemaat</Label><Input value={asal} onChange={e=>setAsal(e.target.value)} placeholder="Jemaat / kelompok" /></div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading} className="gap-1"><Plus className="size-4" />{editId ? "Simpan" : "Tambah"}</Button>
          {editId && <Button type="button" variant="ghost" onClick={batalEdit}>Batal</Button>}
          <Button type="button" variant="outline" onClick={ubahSesi} disabled={updatingSesi} className="gap-1">{updatingSesi ? "Memperbarui..." : "Ubah Sesi"}</Button>
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
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada peserta.</TableCell></TableRow>}
            {items.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                <TableCell className="font-medium"><button type="button" onClick={()=>pilihUntukEdit(p)} className="text-left hover:underline hover:text-primary transition-colors">{p.nama}</button></TableCell>
                <TableCell className="text-muted-foreground">{p.asal || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.sesi || "—"}</TableCell>
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
    const { data, error } = await supabase.from("juri").select("*").order("created_at");
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
      <div className="rounded-lg border bg-card overflow-x-auto">
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

  async function load() {
    const { data, error } = await supabase.from("mazmur").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Mazmur[]);
  }
  useEffect(() => { load(); }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!bacaan || !jumlahAyat) return toast.error("Bacaan & jumlah ayat wajib diisi");
    const { error } = await supabase.from("mazmur").insert({ bacaan, jumlah_ayat: Number(jumlahAyat) });
    if (error) return toast.error(error.message);
    toast.success("Bacaan mazmur ditambahkan");
    setBacaan(""); setJumlahAyat(""); load();
  }
  async function hapus(id: string) {
    const { error } = await supabase.from("mazmur").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <SectionCard title="Daftar Bacaan Mazmur" description="Kelola daftar bacaan mazmur beserta jumlah ayatnya.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 mb-6">
        <div><Label>Bacaan Mazmur</Label><Input value={bacaan} onChange={e=>setBacaan(e.target.value)} placeholder="Mzm. 23" /></div>
        <div><Label>Jumlah Ayat</Label><Input type="number" min={0} value={jumlahAyat} onChange={e=>setJumlahAyat(e.target.value)} placeholder="6" /></div>
        <div className="flex items-end"><Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Bacaan</TableHead><TableHead className="text-center w-40">Jumlah Ayat</TableHead><TableHead className="w-20 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada bacaan.</TableCell></TableRow>}
            {items.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.bacaan}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{m.jumlah_ayat} ayat</Badge></TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(m.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}


/* KRITERIA */
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
      supabase.from("juri").select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("mazmur").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
    ]);
    if (p.error || j.error || k.error || m.error || n.error) return toast.error("Gagal memuat data");
    setPeserta(p.data ?? []);
    setJuri(j.data ?? []);
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

      <Dialog open={!!openKriteria} onOpenChange={(v) => !v && setOpenKriteria(null)}>
        <DialogContent className="max-w-2xl">
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
            <div className="grid gap-3 py-2 max-h-[65vh] overflow-y-auto pr-2">
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
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
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
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
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
