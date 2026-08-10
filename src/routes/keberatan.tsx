import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { FileWarning, Search, Send } from "lucide-react";

export const Route = createFileRoute("/keberatan")({
  component: KeberatanPage,
  head: () => ({
    meta: [
      { title: "E-Form Pengajuan Keberatan | Lomba Bumotik Bermazmur" },
      {
        name: "description",
        content:
          "Ajukan keberatan atas penilaian Lomba Bumotik Bermazmur secara online dan pantau statusnya memakai nomor tiket.",
      },
      { property: "og:title", content: "E-Form Pengajuan Keberatan Lomba Bumotik Bermazmur" },
      {
        property: "og:description",
        content: "Formulir resmi pengajuan keberatan peserta beserta pelacakan status tiket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type PesertaOpt = { id: string; nomor_urut: number; nama: string; kategori: string | null };

const JENIS = [
  { v: "nilai", l: "Keberatan atas nilai" },
  { v: "teknis", l: "Masalah teknis pelaksanaan" },
  { v: "administrasi", l: "Administrasi / keabsahan peserta" },
  { v: "lainnya", l: "Lainnya" },
];

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru diterima",
  ditinjau: "Sedang ditinjau",
  diterima: "Diterima",
  ditolak: "Ditolak",
};

function KeberatanPage() {
  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <FileWarning className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">E-Form Pengajuan Keberatan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lomba Bumotik Bermazmur — pengajuan keberatan peserta atau pendamping.
          </p>
        </header>

        <Tabs defaultValue="ajukan">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ajukan" className="gap-2"><Send className="size-4" />Ajukan</TabsTrigger>
            <TabsTrigger value="status" className="gap-2"><Search className="size-4" />Cek Status</TabsTrigger>
          </TabsList>
          <TabsContent value="ajukan"><FormAjukan /></TabsContent>
          <TabsContent value="status"><CekStatus /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FormAjukan() {
  const [peserta, setPeserta] = useState<PesertaOpt[]>([]);
  const [cari, setCari] = useState("");
  const [pesertaId, setPesertaId] = useState("");
  const [jenis, setJenis] = useState("nilai");
  const [uraian, setUraian] = useState("");
  const [nama, setNama] = useState("");
  const [hubungan, setHubungan] = useState("");
  const [kontak, setKontak] = useState("");
  const [loading, setLoading] = useState(false);
  const [tiket, setTiket] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/keberatan")
      .then((r) => r.json())
      .then((d) => setPeserta(d.peserta ?? []))
      .catch(() => setPeserta([]));
  }, []);

  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const list = q
      ? peserta.filter((p) => p.nama.toLowerCase().includes(q) || String(p.nomor_urut).includes(q))
      : peserta;
    return list.slice(0, 100);
  }, [peserta, cari]);

  async function submit() {
    if (!pesertaId) return toast.error("Pilih peserta terlebih dahulu");
    if (nama.trim().length < 3) return toast.error("Nama pengaju minimal 3 karakter");
    if (uraian.trim().length < 20) return toast.error("Uraian keberatan minimal 20 karakter");
    setLoading(true);
    try {
      const res = await fetch("/api/public/keberatan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          peserta_id: pesertaId,
          jenis,
          uraian: uraian.trim(),
          nama_pengaju: nama.trim(),
          hubungan: hubungan.trim() || null,
          kontak: kontak.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Gagal mengirim");
      setTiket(d.nomor_tiket);
      toast.success("Keberatan terkirim");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setLoading(false);
    }
  }

  if (tiket) {
    return (
      <Card className="mt-4">
        <CardHeader><CardTitle>Pengajuan Terkirim</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Simpan nomor tiket berikut untuk memantau status pengajuan Anda:</p>
          <div className="rounded-lg border-2 border-dashed p-4 text-center text-2xl font-bold tracking-widest">{tiket}</div>
          <Button variant="outline" className="w-full" onClick={() => { setTiket(null); setUraian(""); }}>
            Ajukan keberatan lain
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Formulir Keberatan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Cari peserta</Label>
          <Input placeholder="Nomor urut atau nama peserta" value={cari} onChange={(e) => setCari(e.target.value)} maxLength={80} />
          <Select value={pesertaId} onValueChange={setPesertaId}>
            <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {filtered.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nomor_urut}. {p.nama}{p.kategori ? ` — ${p.kategori}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Jenis keberatan</Label>
          <Select value={jenis} onValueChange={setJenis}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {JENIS.map((j) => <SelectItem key={j.v} value={j.v}>{j.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Uraian keberatan</Label>
          <Textarea
            rows={5}
            maxLength={2000}
            placeholder="Jelaskan keberatan Anda secara rinci (minimal 20 karakter)"
            value={uraian}
            onChange={(e) => setUraian(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{uraian.length}/2000</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nama pengaju</Label>
            <Input value={nama} maxLength={120} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hubungan dengan peserta</Label>
            <Input placeholder="Peserta / pendamping / official" maxLength={80} value={hubungan} onChange={(e) => setHubungan(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Kontak (HP / email)</Label>
          <Input value={kontak} maxLength={120} onChange={(e) => setKontak(e.target.value)} />
        </div>

        <Button className="w-full gap-2" disabled={loading} onClick={submit}>
          <Send className="size-4" />{loading ? "Mengirim…" : "Kirim Keberatan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CekStatus() {
  const [tiket, setTiket] = useState("");
  const [hasil, setHasil] = useState<Record<string, string | null> | null>(null);
  const [loading, setLoading] = useState(false);

  async function cek() {
    if (!tiket.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public/keberatan?tiket=${encodeURIComponent(tiket.trim())}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Tiket tidak ditemukan");
      setHasil(d);
    } catch (e) {
      setHasil(null);
      toast.error(e instanceof Error ? e.message : "Gagal memeriksa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Cek Status Pengajuan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="KB-XXXXXX" value={tiket} maxLength={20} onChange={(e) => setTiket(e.target.value.toUpperCase())} />
          <Button onClick={cek} disabled={loading} className="gap-2"><Search className="size-4" />Cek</Button>
        </div>
        {hasil && (
          <div className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{hasil["nomor_tiket"]}</span>
              <Badge>{STATUS_LABEL[String(hasil["status"])] ?? hasil["status"]}</Badge>
            </div>
            <p className="text-muted-foreground">Peserta: {hasil["peserta"]}</p>
            {hasil["keputusan"] && <p>Keputusan: <strong>{hasil["keputusan"]}</strong></p>}
            {hasil["catatan"] && <p className="text-muted-foreground">Catatan: {hasil["catatan"]}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
