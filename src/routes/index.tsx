import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { Trash2, Plus, Trophy, Users, Gavel, ListChecks, ClipboardCheck, BookOpenText } from "lucide-react";

export const Route = createFileRoute("/")({
  component: App,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null };
type Juri = { id: string; nama: string; jabatan: string | null };
type Kriteria = { id: string; nama: string; bobot: number };
type Penilaian = { id: string; peserta_id: string; juri_id: string; kriteria_id: string; nilai: number };
type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };

function App() {
  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto bg-secondary/60 p-1">
            <TabsTrigger value="ranking" className="gap-2"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="penilaian" className="gap-2"><ClipboardCheck className="size-4" />Penilaian</TabsTrigger>
            <TabsTrigger value="peserta" className="gap-2"><Users className="size-4" />Peserta</TabsTrigger>
            <TabsTrigger value="juri" className="gap-2"><Gavel className="size-4" />Juri</TabsTrigger>
            <TabsTrigger value="kriteria" className="gap-2"><ListChecks className="size-4" />Kriteria</TabsTrigger>
          </TabsList>
          <TabsContent value="ranking"><RankingTab /></TabsContent>
          <TabsContent value="penilaian"><PenilaianTab /></TabsContent>
          <TabsContent value="peserta"><PesertaTab /></TabsContent>
          <TabsContent value="juri"><JuriTab /></TabsContent>
          <TabsContent value="kriteria"><KriteriaTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b bg-card/60 backdrop-blur mb-8">
      <div className="mx-auto max-w-6xl px-4 py-8 flex items-center gap-4">
        <div className="grid place-items-center size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30">
          <BookOpenText className="size-7" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Lomba Rohani</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-foreground">Sistem Penjurian Baca Mazmur</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola peserta, juri, kriteria, dan lihat ranking secara langsung.</p>
        </div>
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
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("peserta").select("*").order("nomor_urut");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor || !nama) return toast.error("Nomor urut dan nama wajib diisi");
    setLoading(true);
    const { error } = await supabase.from("peserta").insert({ nomor_urut: Number(nomor), nama, asal: asal || null });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Peserta ditambahkan");
    setNomor(""); setNama(""); setAsal("");
    load();
  }

  async function hapus(id: string) {
    const { error } = await supabase.from("peserta").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Peserta dihapus");
    load();
  }

  return (
    <SectionCard title="Daftar Peserta" description="Tambahkan peserta yang akan membacakan Mazmur.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_auto] gap-3 mb-6">
        <div><Label>Nomor</Label><Input type="number" value={nomor} onChange={e=>setNomor(e.target.value)} placeholder="1" /></div>
        <div><Label>Nama</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama peserta" /></div>
        <div><Label>Asal / Jemaat</Label><Input value={asal} onChange={e=>setAsal(e.target.value)} placeholder="Jemaat / kelompok" /></div>
        <div className="flex items-end"><Button type="submit" disabled={loading} className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">No.</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Asal</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada peserta.</TableCell></TableRow>}
            {items.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                <TableCell className="font-medium">{p.nama}</TableCell>
                <TableCell className="text-muted-foreground">{p.asal || "—"}</TableCell>
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
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");

  async function load() {
    const { data, error } = await supabase.from("juri").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nama) return toast.error("Nama juri wajib diisi");
    const { error } = await supabase.from("juri").insert({ nama, jabatan: jabatan || null });
    if (error) return toast.error(error.message);
    toast.success("Juri ditambahkan");
    setNama(""); setJabatan(""); load();
  }
  async function hapus(id: string) {
    const { error } = await supabase.from("juri").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <SectionCard title="Dewan Juri" description="Daftar juri yang berhak memberi penilaian.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mb-6">
        <div><Label>Nama Juri</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama juri" /></div>
        <div><Label>Jabatan</Label><Input value={jabatan} onChange={e=>setJabatan(e.target.value)} placeholder="Pdt. / Diakon / dll" /></div>
        <div className="flex items-end"><Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Jabatan</TableHead><TableHead className="w-20 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada juri.</TableCell></TableRow>}
            {items.map(j => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.nama}</TableCell>
                <TableCell className="text-muted-foreground">{j.jabatan || "—"}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(j.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
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

  async function load() {
    const { data, error } = await supabase.from("kriteria").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
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
    const { error } = await supabase.from("kriteria").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <SectionCard title="Kriteria Penilaian" description="Atur aspek yang dinilai dan bobotnya (dalam persen).">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3 mb-6">
        <div><Label>Nama Kriteria</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Contoh: Penghayatan" /></div>
        <div><Label>Bobot (%)</Label><Input type="number" step="0.1" value={bobot} onChange={e=>setBobot(e.target.value)} placeholder="25" /></div>
        <div className="flex items-end"><Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button></div>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kriteria</TableHead><TableHead className="w-32">Bobot</TableHead><TableHead className="w-20 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.nama}</TableCell>
                <TableCell><Badge variant="secondary">{Number(k.bobot)}%</Badge></TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>hapus(k.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
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

/* PENILAIAN */
function PenilaianTab() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [juri, setJuri] = useState<Juri[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [pesertaId, setPesertaId] = useState<string>("");
  const [juriId, setJuriId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [p, j, k, n] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri").select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
    ]);
    if (p.error || j.error || k.error || n.error) return toast.error("Gagal memuat data");
    setPeserta(p.data ?? []); setJuri(j.data ?? []); setKriteria(k.data ?? []); setPenilaian((n.data ?? []) as Penilaian[]);
  }
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!pesertaId || !juriId) { setValues({}); return; }
    const v: Record<string, string> = {};
    for (const k of kriteria) {
      const found = penilaian.find(x => x.peserta_id === pesertaId && x.juri_id === juriId && x.kriteria_id === k.id);
      if (found) v[k.id] = String(found.nilai);
    }
    setValues(v);
  }, [pesertaId, juriId, kriteria, penilaian]);

  async function simpan() {
    if (!pesertaId || !juriId) return toast.error("Pilih peserta dan juri terlebih dahulu");
    const rows = kriteria
      .filter(k => values[k.id] !== undefined && values[k.id] !== "")
      .map(k => ({
        peserta_id: pesertaId,
        juri_id: juriId,
        kriteria_id: k.id,
        nilai: Number(values[k.id]),
      }));
    if (rows.length === 0) return toast.error("Isi minimal satu nilai");
    for (const r of rows) if (r.nilai < 0 || r.nilai > 100) return toast.error("Nilai harus 0-100");

    setSaving(true);
    const { error } = await supabase.from("penilaian").upsert(rows, { onConflict: "peserta_id,juri_id,kriteria_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Penilaian tersimpan");
    loadAll();
  }

  const canJudge = peserta.length > 0 && juri.length > 0 && kriteria.length > 0;

  return (
    <SectionCard title="Input Penilaian" description="Pilih peserta dan juri, lalu berikan nilai untuk setiap kriteria (0–100).">
      {!canJudge && (
        <div className="rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 p-6 text-center text-sm text-muted-foreground">
          Lengkapi dulu data <b>peserta</b>, <b>juri</b>, dan <b>kriteria</b> sebelum memulai penilaian.
        </div>
      )}
      {canJudge && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <Label>Peserta</Label>
              <Select value={pesertaId} onValueChange={setPesertaId}>
                <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
                <SelectContent>
                  {peserta.map(p => <SelectItem key={p.id} value={p.id}>{p.nomor_urut}. {p.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Juri</Label>
              <Select value={juriId} onValueChange={setJuriId}>
                <SelectTrigger><SelectValue placeholder="Pilih juri" /></SelectTrigger>
                <SelectContent>
                  {juri.map(j => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card divide-y">
            {kriteria.map(k => (
              <div key={k.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{k.nama}</p>
                  <p className="text-xs text-muted-foreground">Bobot {Number(k.bobot)}%</p>
                </div>
                <Input
                  type="number" min={0} max={100} step="0.1"
                  className="w-28 text-right font-mono text-lg"
                  value={values[k.id] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [k.id]: e.target.value }))}
                  placeholder="0-100"
                  disabled={!pesertaId || !juriId}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={simpan} disabled={saving || !pesertaId || !juriId} size="lg">
              {saving ? "Menyimpan..." : "Simpan Penilaian"}
            </Button>
          </div>
        </>
      )}
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
