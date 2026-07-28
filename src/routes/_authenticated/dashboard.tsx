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
import { Trash2, Plus, Trophy, Users, Gavel, ListChecks, ClipboardCheck, BookOpenText, Upload, Download, Check, Tags, ChevronLeft, ChevronRight, LayoutDashboard, CheckCircle2, XCircle, FileText, KeyRound, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: App,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null; sesi: string | null; kategori: string | null };
type Juri = { id: string; nama: string; jabatan: string | null; email: string | null; role: "admin" | "juri" | "viewer" | null; approved: boolean; user_id: string | null };
type Kriteria = { id: string; nama: string; bobot: number; batas_atas: number; batas_bawah: number };
type Mazmur = { id: string; bacaan: string; jumlah_ayat: number; kategori: string | null };
type PenilaianDetail =
  | { type: "grade"; grade: number; label: string; desc: string }
  | { type: "catatan"; clearText: boolean; aspek: { nama: string; nilai: number; skipped?: boolean }[] }
  | { type: "perhatian"; membacaPerikop: boolean | null; aspek: { nama: string; ayat: boolean[]; ditandai: number[] }[] }
  | null;
type Penilaian = { id: string; peserta_id: string; juri_id: string; kriteria_id: string; nilai: number; mazmur_id: string | null; detail?: PenilaianDetail; created_at?: string };
type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number };
type Kategori = { id: string; kategori: string | null; batas_atas: number; batas_bawah: number; kriteria_penilaian: string | null; kriteria_peserta: string | null; bobot: number; nilai_tengah: number; nilai_standart: number };

function App() {
  // Single-device enforcement dijalankan di layout `_authenticated/route.tsx`
  // agar berlaku untuk semua halaman (dashboard, operator, inspektur).



  return (
    <div className="min-h-screen">
      <Toaster
        richColors
        position="top-center"
        expand
        toastOptions={{
          classNames: {
            toast:
              "!font-serif !border-2 !border-accent/40 !bg-gradient-to-br !from-card !to-secondary/60 !text-foreground !shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.35)] !rounded-2xl",
            title: "!text-base !tracking-wide",
            description: "!text-muted-foreground",
            success: "!border-accent !bg-gradient-to-br !from-accent/25 !to-card",
            error: "!border-destructive/60 !bg-gradient-to-br !from-destructive/15 !to-card !text-destructive",
            warning: "!border-gold !bg-gradient-to-br !from-gold/20 !to-card",
            info: "!border-primary/50 !bg-gradient-to-br !from-primary/10 !to-card",
          },
        }}
      />
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex justify-end pt-4"><ResetAllPenilaianButton /></div>
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-11 h-auto bg-secondary/60 p-1">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="size-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="lihat" className="gap-2"><FileText className="size-4" />Lihat Nilai</TabsTrigger>
            <TabsTrigger value="rincian" className="gap-2"><FileText className="size-4" />Rincian Nilai</TabsTrigger>
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
          <TabsContent value="lihat"><LihatPenilaianTab /></TabsContent>
          <TabsContent value="rincian"><RincianNilaiTab /></TabsContent>

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
  const [canOperate, setCanOperate] = useState(false);
  const [canInspect, setCanInspect] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ nama: string; email: string; role: string } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: isPan }, { data: isAdm }, { data: isJuri }, { data: isInsp }, { data: isKetua }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "panitia" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "juri" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "inspektur" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "ketua_juri" as any }),
      ]);
      setCanOperate(!!isPan || !!isAdm);
      setCanInspect(!!isInsp || !!isAdm);
      // Inspektur-only users are read-only observers; send them to their own page.
      if (isInsp && !isAdm && !isPan && !isJuri && !isKetua) {
        window.location.href = "/inspektur";
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("nama").eq("id", uid).maybeSingle();
      const role = isAdm ? "Admin" : isPan ? "Panitia" : isKetua ? "Ketua Dewan Juri" : isInsp ? "Inspektur Pertandingan" : isJuri ? "Juri" : "Pengguna";
      setCurrentUser({
        nama: prof?.nama ?? (userData.user?.email?.split("@")[0] ?? "Pengguna"),
        email: userData.user?.email ?? "",
        role,
      });
    })();
  }, []);
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
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {currentUser && (
            <div className="text-right text-sm hidden sm:block">
              <div className="font-semibold leading-tight">{currentUser.nama}</div>
              <div className="text-xs text-muted-foreground">{currentUser.role}{currentUser.email ? ` · ${currentUser.email}` : ""}</div>
            </div>
          )}
          {canOperate && (
            <Button variant="secondary" onClick={() => (window.location.href = "/operator")}>
              Operator Lomba
            </Button>
          )}
          {canInspect && (
            <Button variant="secondary" onClick={() => (window.location.href = "/inspektur")}>
              Inspektur
            </Button>
          )}
          <Button variant="outline" onClick={signOut}>Keluar</Button>
        </div>
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
    await supabase.from("penilaian_submission" as any).delete().not("id", "is", null);
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={unduhTemplate} className="gap-1"><Download className="size-4" />Template</Button>
          <Button variant="secondary" size="sm" onClick={pickFile} disabled={importing} className="gap-1"><Upload className="size-4" />{importing ? "Mengimpor..." : "Impor Excel"}</Button>
          <Button variant="destructive" size="sm" onClick={resetSemua} disabled={resetting || items.length === 0} className="gap-1"><Trash2 className="size-4" />{resetting ? "Menghapus..." : "Reset"}</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </div>
      }
    >
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_1fr_auto] gap-3 mb-6">
        <div><Label>Nomor</Label><Input type="number" value={nomor} onChange={e=>setNomor(e.target.value)} placeholder="1" /></div>
        <div><Label>Nama</Label><Input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama peserta" /></div>
        <div><Label>Asal / Jemaat</Label><Input value={asal} onChange={e=>setAsal(e.target.value)} placeholder="Jemaat / kelompok" /></div>
        <div>
          <Label>Kategori</Label>
          <Input value={kategori} onChange={e=>setKategori(e.target.value)} placeholder="Contoh: Anak" />
        </div>
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
  const [resetTarget, setResetTarget] = useState<Juri | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

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

  async function hapus(id: string, nama: string) {
    if (!confirm(`Hapus juri "${nama}"? Akun login juga akan dihapus.`)) return;
    try {
      const { deleteJuriUser } = await import("@/lib/juri-users.functions");
      await deleteJuriUser({ data: { juriId: id } });
      toast.success("Juri dihapus");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  async function ubahRole(id: string, role: "admin" | "juri" | "panitia" | "inspektur" | "ketua_juri") {
    try {
      const { setJuriRole } = await import("@/lib/juri-users.functions");
      await setJuriRole({ data: { juriId: id, role } });
      toast.success(`Role diubah menjadi ${role}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah role");
    }
  }


  function openReset(j: Juri) {
    setResetTarget(j);
    setResetPw("");
  }

  function generatePw() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint32Array(12);
    (globalThis.crypto || window.crypto).getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    setResetPw(out);
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetPw.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    setResetLoading(true);
    try {
      const { resetJuriPassword } = await import("@/lib/juri-users.functions");
      await resetJuriPassword({ data: { juriId: resetTarget.id, password: resetPw } });
      toast.success(`Password ${resetTarget.nama} berhasil direset`);
      setResetTarget(null);
      setResetPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal reset password");
    } finally {
      setResetLoading(false);
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
              <Select value={j.role ?? undefined} onValueChange={(v)=>ubahRole(j.id, v as any)}>
                <SelectTrigger className="h-8 w-[160px] shrink-0"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="juri">Juri</SelectItem>
                  <SelectItem value="panitia">Panitia</SelectItem>
                  <SelectItem value="ketua_juri">Ketua Dewan Juri</SelectItem>
                  <SelectItem value="inspektur">Inspektur Pertandingan</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground break-all">{j.email || "—"}</div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {j.approved ? (
                <Badge className="bg-accent text-accent-foreground gap-1"><Check className="size-3" />Disetujui</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Menunggu</Badge>
              )}
              <div className="flex items-center gap-2">
                {!j.approved && (
                  <Button size="sm" variant="default" onClick={()=>approve(j.id)} className="gap-1">
                    <Check className="size-4" />Approve
                  </Button>
                )}
                {j.approved && (
                  <Button size="sm" variant="outline" onClick={()=>openReset(j)} className="gap-1">
                    <KeyRound className="size-4" />Reset
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={()=>hapus(j.id, j.nama)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
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
                  <Select value={j.role ?? undefined} onValueChange={(v)=>ubahRole(j.id, v as any)}>
                    <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="juri">Juri</SelectItem>
                      <SelectItem value="panitia">Panitia</SelectItem>
                      <SelectItem value="ketua_juri">Ketua Dewan Juri</SelectItem>
                      <SelectItem value="inspektur">Inspektur Pertandingan</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {j.approved ? (
                    <Badge className="bg-accent text-accent-foreground gap-1"><Check className="size-3" />Disetujui</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Menunggu disetujui</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!j.approved && (
                      <Button size="sm" variant="default" onClick={()=>approve(j.id)} className="gap-1">
                        <Check className="size-4" />Approve
                      </Button>
                    )}
                    {j.approved && (
                      <Button size="sm" variant="outline" onClick={()=>openReset(j)} className="gap-1">
                        <KeyRound className="size-4" />Reset Password
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={()=>hapus(j.id, j.nama)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(o)=>{ if(!o){ setResetTarget(null); setResetPw(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">✦ Reset Password Juri</DialogTitle>
            <DialogDescription>
              Buat password baru untuk <span className="font-semibold text-foreground">{resetTarget?.nama}</span>.
              Sesi login aktif di perangkat manapun akan otomatis keluar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw">Password Baru (min. 8 karakter)</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-pw"
                  type="text"
                  value={resetPw}
                  onChange={(e)=>setResetPw(e.target.value)}
                  placeholder="Masukkan atau generate"
                  autoComplete="new-password"
                />
                <Button type="button" variant="outline" onClick={generatePw}>Generate</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Salin & sampaikan password ini ke juri secara aman — tidak akan bisa dilihat lagi setelah dialog ditutup.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{ setResetTarget(null); setResetPw(""); }}>Batal</Button>
            <Button onClick={submitReset} disabled={resetLoading || resetPw.length < 8}>
              {resetLoading ? "Menyimpan…" : "Simpan Password Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}



/* MAZMUR */
function MazmurTab() {
  const [items, setItems] = useState<Mazmur[]>([]);
  const [bacaan, setBacaan] = useState("");
  const [jumlahAyat, setJumlahAyat] = useState("");
  const [kategori, setKategori] = useState("");
  const [kategoriList, setKategoriList] = useState<string[]>([]);

  async function load() {
    const { data, error } = await supabase.from("mazmur").select("*").order("created_at");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Mazmur[]);
  }
  async function loadKategoriFromPeserta() {
    const { data, error } = await supabase.from("peserta").select("kategori");
    if (error) return;
    const uniq = Array.from(new Set((data ?? []).map((m: any) => (m.kategori || "").trim()).filter(Boolean))) as string[];
    setKategoriList(uniq);
  }
  useEffect(() => { load(); loadKategoriFromPeserta(); }, []);

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
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_200px_auto] gap-3 mb-6">
        <div><Label>Bacaan Mazmur</Label><Input value={bacaan} onChange={e=>setBacaan(e.target.value)} placeholder="Mzm. 23" /></div>
        <div><Label>Jumlah Ayat</Label><Input type="number" min={0} value={jumlahAyat} onChange={e=>setJumlahAyat(e.target.value)} placeholder="6" /></div>
        <div>
          <Label>Kriteria</Label>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger>
              <SelectValue placeholder={kategoriList.length ? "Pilih kriteria dari peserta" : "Belum ada kategori peserta"} />
            </SelectTrigger>
            <SelectContent>
              {kategoriList.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
  const [kriteriaPeserta, setKriteriaPeserta] = useState("");
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
    const { data, error } = await supabase.from("peserta").select("kategori");
    if (error) return;
    const uniq = Array.from(new Set((data ?? []).map((m: any) => (m.kategori || "").trim()).filter(Boolean))) as string[];
    setMazmurKategoriList(uniq);
  }
  useEffect(() => { load(); loadMazmurKategori(); }, []);


  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!kriteriaPeserta) return toast.error("Kriteria Peserta wajib dipilih");
    const { error } = await supabase.from("kategori").insert({
      kriteria_peserta: kriteriaPeserta,
      batas_atas: Number(batasAtas) || 0,
      batas_bawah: Number(batasBawah) || 0,
      nilai_tengah: Number(nilaiTengah) || 0,
      nilai_standart: Number(nilaiStandart) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Kategori ditambahkan");
    setKriteriaPeserta("");
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
    <SectionCard title="Daftar Kategori" description="Kelola batas dan nilai standar untuk setiap kategori peserta.">
      <form onSubmit={tambah} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="lg:col-span-2">
          <Label>Kriteria Peserta</Label>
          <Select value={kriteriaPeserta} onValueChange={setKriteriaPeserta}>
            <SelectTrigger><SelectValue placeholder={mazmurKategoriList.length ? "Pilih kategori peserta" : "Belum ada kategori di Daftar Peserta"} /></SelectTrigger>
            <SelectContent>
              {mazmurKategoriList.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Batas Atas</Label><Input type="number" step="0.01" value={batasAtas} onChange={e=>setBatasAtas(e.target.value)} placeholder="100" /></div>
        <div><Label>Batas Bawah</Label><Input type="number" step="0.01" value={batasBawah} onChange={e=>setBatasBawah(e.target.value)} placeholder="0" /></div>
        <div><Label>Nilai Tengah</Label><Input type="number" step="0.01" value={nilaiTengah} onChange={e=>setNilaiTengah(e.target.value)} placeholder="50" /></div>
        <div><Label>Nilai Standart</Label><Input type="number" step="0.01" value={nilaiStandart} onChange={e=>setNilaiStandart(e.target.value)} placeholder="75" /></div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <Button type="submit" className="gap-1"><Plus className="size-4" />Tambah</Button>
        </div>
      </form>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kriteria Peserta</TableHead>
              <TableHead className="text-center">Batas Atas</TableHead>
              <TableHead className="text-center">Batas Bawah</TableHead>
              <TableHead className="text-center">Nilai Tengah</TableHead>
              <TableHead className="text-center">Nilai Standart</TableHead>
              <TableHead className="w-32 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada kategori.</TableCell></TableRow>}
            {items.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.kriteria_peserta || k.kategori || "—"}</TableCell>
                <TableCell className="text-center">{Number(k.batas_atas)}</TableCell>
                <TableCell className="text-center">{Number(k.batas_bawah)}</TableCell>
                <TableCell className="text-center">{Number(k.nilai_tengah)}</TableCell>
                <TableCell className="text-center">{Number(k.nilai_standart)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="destructive" onClick={()=>hapus(k.id)}>
                    <Trash2 className="size-4 mr-1" /> Hapus
                  </Button>
                </TableCell>
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
        <div>
          <Label>Nama Kriteria</Label>
          <Select value={nama} onValueChange={setNama}>
            <SelectTrigger><SelectValue placeholder="Pilih kriteria penilaian" /></SelectTrigger>
            <SelectContent>
              {KRITERIA_PENILAIAN_OPTIONS.filter(o => !items.some(i => i.nama === o)).map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
  if (n.includes("vokal") || n.includes("vocal") || n.includes("artikulasi")) return "vokal";
  if (n.includes("hayat")) return "penghayatan";
  if (n.includes("intonasi") || n.includes("pelafalan")) return "intonasi";
  if (n.includes("penampilan")) return "penampilan";
  return null;
}


/* PENILAIAN */
function CriteriaPillButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={[
        "group relative w-full rounded-[2rem] border-[2px] border-primary/40 px-6 py-8 sm:py-10",
        "text-center font-serif transition-all duration-200 ease-out",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
        disabled ? "opacity-40 cursor-not-allowed grayscale" : "translate-y-0 hover:-translate-y-1 active:translate-y-1",
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
  const [catatanValues, setCatatanValues] = useState<(number | null)[]>(() => CATATAN_ASPEK.map(() => null));
  const [catatanClearText, setCatatanClearText] = useState<boolean | null>(null);
  const [perhatianChecks, setPerhatianChecks] = useState<boolean[][]>(() => PERHATIAN_ASPEK.map(() => []));
  // Snapshot nilai Perhatian saat dialog dibuka (dipakai saat mode Perbaikan Perhatian
  // untuk mengunci baris non-pemicu agar tidak berubah, apapun yang terjadi di UI).
  const perhatianBaselineRef = useRef<boolean[][] | null>(null);
  const PERHATIAN_VAR_TRIGGER_IDX = new Set([1, 3, 4]);
  const [saving, setSaving] = useState(false);
  // Aturan #3 — nama juri otomatis dari user yang login (juri tidak bisa memilih juri lain)
  const [myJuriId, setMyJuriId] = useState<string>("");
  const [myJuriNama, setMyJuriNama] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  // Aturan #7 — kunci form setelah kirim, buka lagi setelah semua juri selesai
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);
  // Semua peserta yang PERNAH saya kirim (persist antar refresh) — mencegah kirim ulang
  const [mySubmittedIds, setMySubmittedIds] = useState<Set<string>>(new Set());
  const [judgesDoneForPeserta, setJudgesDoneForPeserta] = useState<number>(0);
  const pollingInFlightRef = useRef(false);
  const resolvingCompletionRef = useRef<string | null>(null);
  // Aturan #6 — konfirmasi kirim
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mode edit: dipicu setelah user menekan OK di dialog perbedaan.
  // Hanya field peserta & mazmur yang aktif; nilai kriteria yang sudah ada TIDAK direset.
  const [editMode, setEditMode] = useState<{ oldPesertaId: string } | null>(null);
  // Aturan — deteksi perbedaan input antar juri (nama peserta & bacaan mazmur)
  type DiscrepancyReport = {
    pesertaId: string;
    pesertaNama: string;
    mazmur: { juriNama: string; mazmurLabel: string }[] | null;
    peserta?: { juriNama: string; pesertaLabel: string }[] | null;
  };
  const [discrepancy, setDiscrepancy] = useState<DiscrepancyReport | null>(null);
  // Perbedaan inputan yang muncul SAAT overlay "menunggu" (sebelum semua juri selesai)
  const [pendingDiscrepancy, setPendingDiscrepancy] = useState<DiscrepancyReport | null>(null);

  type PerhatianDiscrepancyReport = {
    pesertaId: string;
    pesertaNama: string;
    items: { pertanyaan: string; rows: { juriNama: string; ayat: number[] }[] }[];
  };
  const [perhatianDiscrepancy, setPerhatianDiscrepancy] = useState<PerhatianDiscrepancyReport | null>(null);

  // Sesi aktif dari Panitia/Operator Lomba — juri tidak boleh memilih peserta/mazmur secara manual
  const [activeSession, setActiveSession] = useState<{ id: string; peserta_id: string; mazmur_id: string | null } | null>(null);
  useEffect(() => {
    let stopped = false;
    async function poll() {
      const { data } = await supabase
        .from("sesi_penilaian" as any)
        .select("id, peserta_id, mazmur_id, status")
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1);
      if (stopped) return;
      const rows = (data as any[] | null) ?? [];
      const row = rows[0] as { id: string; peserta_id: string; mazmur_id: string | null } | undefined;
      setActiveSession(row ? { id: row.id, peserta_id: row.peserta_id, mazmur_id: row.mazmur_id } : null);
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  // Auto-terapkan sesi aktif untuk non-admin (juri): kunci peserta & mazmur mengikuti pilihan Operator
  useEffect(() => {
    if (!activeSession) return;
    if (isAdmin) return;
    if (editMode) return;
    setPesertaId(prev => prev === activeSession.peserta_id ? prev : activeSession.peserta_id);
    if (activeSession.mazmur_id) {
      setMazmurId(prev => prev === activeSession.mazmur_id ? prev : activeSession.mazmur_id!);
    }
  }, [activeSession, isAdmin, editMode]);
  // Ketika Operator mengakhiri sesi → kosongkan field Peserta & Bacaan Mazmur untuk juri.
  const prevActiveSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevActiveSessionIdRef.current;
    const currId = activeSession?.id ?? null;
    if (!isAdmin && !editMode && prevId && !currId && !submittedFor) {
      setPesertaId("");
      setMazmurId("");
      setOpenKriteria(null);
    }
    prevActiveSessionIdRef.current = currId;
  }, [activeSession, isAdmin, editMode, submittedFor]);
  const lockPesertaMazmur = !!activeSession && !isAdmin && !editMode;

  // Aturan #2 — Potensi VAR terbuka: banner untuk semua juri; diselesaikan oleh Inspektur
  type VarAktifRow = { peserta_id: string; peserta_nama: string; komponen: string[]; status: string };
  const [varAktifList, setVarAktifList] = useState<VarAktifRow[]>([]);
  useEffect(() => {
    let stopped = false;
    async function poll() {
      const { data, error } = await supabase
        .from("var_clarification_session" as any)
        .select("peserta_id, komponen_berbeda, status")
        .neq("status", "final");
      if (stopped) return;
      if (error) { console.error("var poll", error); return; }
      const rawRows = ((data as any[]) ?? []);
      const pids = Array.from(new Set(rawRows.map(r => r.peserta_id)));
      let pesertaMap = new Map<string, { nama: string; nomor_urut: number }>();
      if (pids.length > 0) {
        const { data: pdata } = await supabase.from("peserta").select("id, nama, nomor_urut").in("id", pids);
        (pdata ?? []).forEach((p: any) => pesertaMap.set(p.id, { nama: p.nama, nomor_urut: p.nomor_urut }));
      }
      const rows = rawRows.map((r) => {
        const p = pesertaMap.get(r.peserta_id);
        return {
          peserta_id: r.peserta_id,
          peserta_nama: p ? `${p.nomor_urut}. ${p.nama}` : "",
          komponen: Array.isArray(r.komponen_berbeda) ? (r.komponen_berbeda as string[]) : [],
          status: r.status,
        } as VarAktifRow;
      });
      setVarAktifList(rows);
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  const perbaikanPerhatianIds = new Set(varAktifList.filter(v => v.status === "perbaikan_perhatian").map(v => v.peserta_id));
  useEffect(() => {
    if (perbaikanPerhatianIds.size === 0) return;
    setMySubmittedIds(prev => {
      let changed = false;
      const next = new Set(prev);
      perbaikanPerhatianIds.forEach(id => { if (next.delete(id)) changed = true; });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varAktifList]);
  const KOMP_LABEL: Record<string, string> = {
    salah_kata: "Salah kata",
    menambah_kata: "Menambah kata",
    mengurangi_kata: "Mengurangi kata",
  };






  async function loadAll(options: { restoreSubmissionState?: boolean } = {}) {
    const restoreSubmissionState = options.restoreSubmissionState ?? true;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    let admin = false;
    let profJuriId: string | null = null;
    if (uid) {
      const { data: adminCheck } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
      admin = !!adminCheck;
      setIsAdmin(admin);
      const { data: prof } = await supabase
        .from("profiles")
        .select("juri_id, nama")
        .eq("id", uid)
        .maybeSingle();
      if (prof?.juri_id) {
        profJuriId = prof.juri_id;
        setMyJuriId(prof.juri_id);
        setMyJuriNama(prof.nama ?? "");
        if (!admin) setJuriId(prof.juri_id);
      }
    }
    const [p, j, k, m, n, s] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("mazmur").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
      supabase.from("penilaian_submission" as any).select("*"),
    ]);
    if (p.error || j.error || k.error || m.error || n.error) return toast.error("Gagal memuat data");
    const pesertaList = p.data ?? [];
    const juriList = ((j.data ?? []) as unknown as Juri[]).filter(x => x.approved && x.role === "juri");
    const kriteriaList = k.data ?? [];
    const mazmurList = (m.data ?? []) as Mazmur[];
    const penilaianList = (n.data ?? []) as Penilaian[];
    const submissionList = ((s?.data ?? []) as any[]) as Array<{ peserta_id: string; juri_id: string; created_at: string }>;
    setPeserta(pesertaList);
    // Admin tidak merangkap sebagai juri — hanya tampilkan yang role="juri" & sudah disetujui
    setJuri(juriList);
    setKriteria(kriteriaList);
    setMazmur(mazmurList);
    setPenilaian(penilaianList);

    // Restore state setelah refresh berbasis SUBMISSION (bukan kriteria terisi).
    // Juri dianggap "sudah menilai" hanya jika sudah menekan Kirim (ada baris di penilaian_submission).
    const activeJuriId = admin ? (juriId || "") : (profJuriId || "");
    if (activeJuriId) {
      setMySubmittedIds(new Set(submissionList.filter(sb => sb.juri_id === activeJuriId).map(sb => sb.peserta_id)));
    } else {
      setMySubmittedIds(new Set());
    }
    if (activeJuriId && !editMode && restoreSubmissionState) {
      const mine = submissionList
        .filter(sb => sb.juri_id === activeJuriId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      if (mine.length > 0) {
        const totalJuri = juriList.length;
        // Hanya pulihkan peserta TERAKHIR yang saya kirim.
        // Jangan lompat ke submission lama yang belum selesai karena itu membuat overlay berkedip setelah peserta terbaru selesai.
        const latest = mine[0];
        const latestDone = submissionList.filter(x => x.peserta_id === latest.peserta_id).length;
        if (totalJuri > 0 && latestDone < totalJuri) {
          const pid = latest.peserta_id;
          const myRow = penilaianList.find(x => x.juri_id === activeJuriId && x.peserta_id === pid && x.mazmur_id);
          setSubmittedFor(pid);
          setPesertaId(pid);
          if (myRow?.mazmur_id) setMazmurId(myRow.mazmur_id);
        } else {
          // Semua juri sudah kirim untuk peserta terakhir yang saya nilai — cek perbedaan sekali saat halaman dipulihkan.
          const pid = latest.peserta_id;
          const report = await checkDiscrepancyWith(pid, mazmurList, pesertaList);
          if (report) {
            const myRow = penilaianList.find(x => x.juri_id === activeJuriId && x.peserta_id === pid && x.mazmur_id);
            setPesertaId(pid);
            if (myRow?.mazmur_id) setMazmurId(myRow.mazmur_id);
            setDiscrepancy(report);
            setSubmittedFor(null);
          }
        }
      }
    }
  }
  useEffect(() => { loadAll(); }, []);

  const totalJuriApproved = juri.length;

  // Aturan #7 — polling jumlah juri yang sudah menilai peserta terkunci
  useEffect(() => {
    if (!submittedFor) return;
    const lockedPesertaId = submittedFor;
    resolvingCompletionRef.current = null;
    let stopped = false;
    async function tick() {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
      // Jika Inspektur membuka "Perbaikan Perhatian", submission juri utk peserta ini
      // dihapus dari DB. Bebaskan overlay agar juri bisa mengisi ulang Perhatian.
      const activeJuriId = myJuriId || juriId;
      if (activeJuriId) {
        const { data: sub } = await supabase
          .from("penilaian_submission" as any)
          .select("id")
          .eq("peserta_id", lockedPesertaId)
          .eq("juri_id", activeJuriId)
          .maybeSingle();
        if (!sub) {
          stopped = true;
          toast.info("Inspektur membuka perbaikan Perhatian.", {
            description: "Silakan perbarui jawaban pemicu VAR lalu kirim ulang.",
          });
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setJudgesDoneForPeserta(0);
          return;
        }
      }
      const { data } = await supabase.rpc("get_ranking" as any);
      if (stopped) return;
      const rows = (data ?? []) as unknown as Ranking[];
      const row = rows.find(r => r.peserta_id === lockedPesertaId);
      const done = row ? Number(row.jumlah_juri) : 0;
      setJudgesDoneForPeserta(done);

      // Deteksi perbedaan input SELAMA menunggu (peserta/mazmur berbeda antar juri)
      const pending = await checkPendingDiscrepancy(lockedPesertaId);
      if (!stopped) setPendingDiscrepancy(pending);

      if (totalJuriApproved > 0 && done >= totalJuriApproved) {
        const resolutionKey = `${lockedPesertaId}:${done}:${totalJuriApproved}`;
        if (resolvingCompletionRef.current === resolutionKey) return;
        resolvingCompletionRef.current = resolutionKey;

        // Urutan pemeriksaan:
        // 1) Semua juri sudah klik Kirim (terpenuhi di sini).
        // 2) Perbedaan pilihan Peserta / Bacaan Mazmur.
        const report = await checkDiscrepancy(lockedPesertaId);
        if (report) {
          stopped = true;
          setDiscrepancy(report);
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setJudgesDoneForPeserta(0);
          return;
        }
        // 3) Perbedaan parameter di form Perhatian (Q2, Q4, Q5).
        const perhatianReport = await checkPerhatianDiscrepancy(lockedPesertaId);
        if (perhatianReport) {
          stopped = true;
          setPerhatianDiscrepancy(perhatianReport);
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setJudgesDoneForPeserta(0);
          return;
        }
        stopped = true;
        toast.success("✦ Semua juri sudah menilai", {
          description: "Silahkan melakukan penilaian peserta selanjutnya.",
        });
        setSubmittedFor(current => current === lockedPesertaId ? null : current);
        setPendingDiscrepancy(null);
        setPesertaId("");
        setMazmurId("");
        setOpenKriteria(null);
        setJudgesDoneForPeserta(0);
        loadAll({ restoreSubmissionState: false });
      }
      } finally {
        pollingInFlightRef.current = false;
      }
    }
    tick();
    const id = setInterval(tick, 4000);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedFor, totalJuriApproved]);

  // Deteksi perbedaan input antar juri yang SUDAH MENGIRIM (submission) untuk peserta terkait.
  // Hanya membandingkan juri yang benar-benar sudah klik "Kirim" — bukan yang masih mengisi.
  // Hitung jumlah baris penilaian per juri untuk 1 peserta.
  async function fetchJuriCounts(pesertaIdCheck: string, juriIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const j of juriIds) counts.set(j, 0);
    if (juriIds.length === 0) return counts;
    const { data } = await supabase
      .from("penilaian")
      .select("juri_id")
      .eq("peserta_id", pesertaIdCheck)
      .in("juri_id", juriIds);
    for (const r of ((data ?? []) as any[])) {
      counts.set(r.juri_id, (counts.get(r.juri_id) ?? 0) + 1);
    }
    return counts;
  }

  // Perbedaan hanya diakui jika semua juri yang dibandingkan memiliki JUMLAH INPUTAN yang SAMA (dan > 0).
  function allCountsEqualAndPositive(counts: Map<string, number>): boolean {
    const vals = Array.from(counts.values());
    if (vals.length < 2) return false;
    const first = vals[0];
    if (first <= 0) return false;
    return vals.every(v => v === first);
  }

  // NONAKTIF: aturan perbedaan input peserta/bacaan mazmur antar juri sudah dihapus
  // (peserta & mazmur kini diatur otomatis oleh sesi operator).
  async function checkPendingDiscrepancy(_currentPesertaId: string): Promise<DiscrepancyReport | null> {
    return null;
  }

  async function checkDiscrepancyWith(
    _pesertaIdCheck: string,
    _mazmurArr: Mazmur[],
    _pesertaArr: Peserta[]
  ): Promise<DiscrepancyReport | null> {
    return null;
  }

  async function checkDiscrepancy(_pesertaIdCheck: string): Promise<DiscrepancyReport | null> {
    return null;
  }


  // Pemeriksaan #3 — Perbedaan pilihan pada form Perhatian, khusus Q2, Q4, Q5.
  // Q1 = Tidak Membaca Perikop (membacaPerikop) → tidak dicek.
  // Q2 = Salah kata → aspek[0]
  // Q4 = Menambah kata → aspek[2]
  // Q5 = Mengurangi kata → aspek[3]
  async function checkPerhatianDiscrepancy(pesertaIdCheck: string): Promise<PerhatianDiscrepancyReport | null> {
    const perhatianKriteria = kriteria.find(k => kriteriaKey(k.nama) === "perhatian");
    if (!perhatianKriteria) return null;
    const { data: rows } = await supabase
      .from("penilaian")
      .select("juri_id, detail")
      .eq("peserta_id", pesertaIdCheck)
      .eq("kriteria_id", perhatianKriteria.id);
    if (!rows || rows.length < 2) return null;
    // Perbedaan Perhatian hanya diakui bila jumlah inputan seluruh juri untuk peserta SAMA.
    const involvedJuri = Array.from(new Set((rows as any[]).map(r => r.juri_id)));
    const counts = await fetchJuriCounts(pesertaIdCheck, involvedJuri);
    if (!allCountsEqualAndPositive(counts)) return null;
    const { data: juriRows } = await supabase.from("juri_public" as any).select("id, nama");
    const juriMap = new Map<string, string>();
    ((juriRows ?? []) as unknown as { id: string; nama: string }[]).forEach(j => juriMap.set(j.id, j.nama));

    const targetIdx = [
      { idx: 0, label: "Q2 — Salah kata" },
      { idx: 2, label: "Q4 — Menambah kata" },
      { idx: 3, label: "Q5 — Mengurangi kata" },
    ];
    const items: PerhatianDiscrepancyReport["items"] = [];
    for (const t of targetIdx) {
      const perJuri: { juriNama: string; ayat: number[] }[] = [];
      for (const r of rows as any[]) {
        const d = r.detail;
        if (!d || d.type !== "perhatian") continue;
        const aspek = d.aspek?.[t.idx];
        const ayat: number[] = Array.isArray(aspek?.ditandai) ? [...aspek.ditandai].sort((a, b) => a - b) : [];
        perJuri.push({ juriNama: juriMap.get(r.juri_id) ?? "—", ayat });
      }
      const sig = new Set(perJuri.map(x => x.ayat.join(",")));
      if (sig.size > 1) items.push({ pertanyaan: t.label, rows: perJuri });
    }
    if (items.length === 0) return null;
    const pesertaNama = peserta.find(p => p.id === pesertaIdCheck)?.nama ?? "—";
    return { pesertaId: pesertaIdCheck, pesertaNama, items };
  }

  async function perbaikiPerhatianSaya() {
    const target = perhatianDiscrepancy?.pesertaId;
    if (!target) return;
    const activeJuri = isAdmin ? juriId : (myJuriId || "");
    const perhatianKriteria = kriteria.find(k => kriteriaKey(k.nama) === "perhatian");
    if (activeJuri && perhatianKriteria) {
      // Hapus HANYA submission juri ini (paksa Kirim ulang) — baris penilaian
      // Perhatian tetap disimpan supaya saat form dibuka lagi pilihan terakhir
      // juri masih tampil dan tinggal diubah pada 3 parameter pemicu VAR.
      await supabase
        .from("penilaian_submission" as any)
        .delete()
        .eq("juri_id", activeJuri)
        .eq("peserta_id", target);
    }
    toast.warning("✦ Lakukan perubahan Perhatian", {
      description: "Silakan buka kembali form Perhatian, perbaiki pilihan, lalu klik Kirim.",
    });
    setPerhatianDiscrepancy(null);
    setPendingDiscrepancy(null);
    setSubmittedFor(null);
    setJudgesDoneForPeserta(0);
    setPesertaId(target);
    setOpenKriteria(null);
    await loadAll();
  }



  async function perbaikiPenilaianSaya(pesertaOverride?: string) {
    const pesertaTarget = pesertaOverride ?? discrepancy?.pesertaId;
    if (!pesertaTarget) return;
    // Hapus submission juri saat ini untuk peserta terkait supaya status "sudah kirim" tereset
    // dan overlay bisa aktif kembali setelah Kirim Perubahan.
    const activeJuri = isAdmin ? juriId : (myJuriId || "");
    if (activeJuri) {
      await supabase
        .from("penilaian_submission" as any)
        .delete()
        .eq("juri_id", activeJuri)
        .eq("peserta_id", pesertaTarget);
    }
    toast.warning("✦ Lakukan perubahan", {
      description: "Silakan perbaiki pilihan Peserta atau Bacaan Mazmur, lalu klik Kirim. Nilai kriteria Anda tetap disimpan.",
    });
    setDiscrepancy(null);
    setPendingDiscrepancy(null);
    setSubmittedFor(null);
    setJudgesDoneForPeserta(0);
    setEditMode({ oldPesertaId: pesertaTarget });
    setPesertaId(pesertaTarget);
    setOpenKriteria(null);
  }




  const canJudge = peserta.length > 0 && juri.length > 0 && kriteria.length > 0;
  const selectedMazmur = mazmur.find(m => m.id === mazmurId);

  function currentNilai(kId: string): number | null {
    if (!juriId || !pesertaId) return null;
    const row = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === kId);
    return row ? Number(row.nilai) : null;
  }

  function openDialog(k: Kriteria) {
    if (editMode) return toast.warning("Mode perubahan aktif — hanya Peserta & Bacaan Mazmur yang dapat diubah.");
    if (!juriId) return toast.error("Pilih juri terlebih dahulu");
    if (!pesertaId) return toast.error("Pilih peserta terlebih dahulu");
    const key = kriteriaKey(k.nama);
    if (pesertaId && perbaikanPerhatianIds.has(pesertaId) && key !== "perhatian") {
      return toast.warning("Mode Perbaikan Perhatian aktif — hanya kriteria Perhatian yang dapat diubah.");
    }
    if (key === "catatan") {
      setCatatanValues(CATATAN_ASPEK.map(() => null));
      setCatatanClearText(null);
    }
    if (key === "perhatian") {
      if (!selectedMazmur) return toast.error("Pilih bacaan mazmur terlebih dahulu");
      const isPerbaikan = !!(pesertaId && perbaikanPerhatianIds.has(pesertaId));
      const prevRow = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === k.id);
      const prevDetail: any = prevRow?.detail ?? null;
      // Selalu tampilkan pilihan terakhir juri bila baris penilaian sebelumnya masih ada
      // (mis. saat Potensi VAR / Perbaikan Perhatian) — bukan hanya di mode perbaikan Inspektur.
      if (prevDetail && prevDetail.type === "perhatian") {
        const restored: boolean[][] = PERHATIAN_ASPEK.map((_, i) => {
          if (i === 0) {
            const v = prevDetail.membacaPerikop;
            return v === true || v === false ? [Boolean(v)] : [];
          }
          const aspek = prevDetail.aspek?.[i - 1];
          const arr: boolean[] | undefined = Array.isArray(aspek?.ayat) ? aspek.ayat : undefined;
          if (arr && arr.length === selectedMazmur.jumlah_ayat) return [...arr];
          const filled = Array(selectedMazmur.jumlah_ayat).fill(false);
          (aspek?.ditandai ?? []).forEach((n: number) => {
            if (n >= 1 && n <= filled.length) filled[n - 1] = true;
          });
          return filled;
        });
        setPerhatianChecks(restored);
        perhatianBaselineRef.current = isPerbaikan ? restored.map(r => [...r]) : null;
      } else {
        const empty = PERHATIAN_ASPEK.map((_, i) => i === 0 ? [] : Array(selectedMazmur.jumlah_ayat).fill(false));
        setPerhatianChecks(empty);
        perhatianBaselineRef.current = isPerbaikan ? empty.map(r => [...r]) : null;
      }
    }
    setOpenKriteria(k);
  }


  async function saveNilai(nilai: number, detail: PenilaianDetail = null) {
    if (!openKriteria) return;
    setSaving(true);
    const { error } = await supabase.from("penilaian").upsert(
      {
        juri_id: juriId,
        peserta_id: pesertaId,
        kriteria_id: openKriteria.id,
        nilai,
        mazmur_id: mazmurId || null,
        detail: detail as any,
      } as any,
      { onConflict: "peserta_id,juri_id,kriteria_id" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Nilai ${openKriteria.nama} disimpan`);
    setOpenKriteria(null);
    setCatatanValues(CATATAN_ASPEK.map(() => null));
    setCatatanClearText(null);
    setPerhatianChecks([]);
    
    loadAll();
  }

  async function saveCatatan() {
    if (catatanClearText === null) {
      return toast.warning("Pilih jawaban untuk 'Membaca teks yang jelas' terlebih dahulu.");
    }
    // Aspek 0 auto = 1 bila clearText=false (skipped); selain itu wajib dipilih 1-5.
    for (let i = 0; i < catatanValues.length; i++) {
      const skipped = i === 0 && !catatanClearText;
      if (!skipped && (catatanValues[i] === null || catatanValues[i] === undefined)) {
        return toast.warning("Lengkapi semua pilihan pada Catatan Juri terlebih dahulu.");
      }
    }
    const effective: number[] = catatanValues.map((v, i) =>
      i === 0 && !catatanClearText ? 1 : (v as number)
    );
    const avg = effective.reduce((a, b) => a + b, 0) / effective.length;
    const nilai = Math.round(avg * 20 * 100) / 100; // scale 1-5 → 20-100
    const detail: PenilaianDetail = {
      type: "catatan",
      clearText: catatanClearText,
      aspek: CATATAN_ASPEK.map((nama, i) => ({
        nama,
        nilai: effective[i],
        skipped: i === 0 && !catatanClearText,
      })),
    };
    await saveNilai(nilai, detail);
  }

  const perhatianTotal = perhatianChecks.reduce((s, row) => s + row.length, 0);
  const perhatianChecked = perhatianChecks.reduce((s, row) => s + row.filter(Boolean).length, 0);
  const perhatianNilai = perhatianTotal === 0
    ? 0
    : Math.round(((perhatianTotal - perhatianChecked) / perhatianTotal) * 100 * 100) / 100;

  async function savePerhatian() {
    // Wajibkan jawaban "Membaca Perikop" (Ya/Tidak) sebelum menyimpan.
    if (perhatianChecks[0]?.[0] === undefined) {
      return toast.warning("Pilih jawaban untuk 'Membaca Perikop' terlebih dahulu.");
    }
    // Guard: bila mode Perbaikan Perhatian aktif, paksa baris non-pemicu (selain 1/3/4)
    // kembali ke baseline saat dialog dibuka — jadi hanya 3 parameter pemicu VAR yang benar-benar bisa diubah.
    const perbaikanAktifNow = !!(pesertaId && perbaikanPerhatianIds.has(pesertaId));
    const baseline = perhatianBaselineRef.current;
    const effective = (perbaikanAktifNow && baseline)
      ? perhatianChecks.map((row, i) => PERHATIAN_VAR_TRIGGER_IDX.has(i) ? row : (baseline[i] ? [...baseline[i]] : row))
      : perhatianChecks;
    const totalAll = effective.reduce((s, row) => s + row.length, 0);
    const checkedAll = effective.reduce((s, row) => s + row.filter(Boolean).length, 0);
    const nilaiAll = totalAll === 0 ? 0 : Math.round(((totalAll - checkedAll) / totalAll) * 100 * 100) / 100;
    const detail: PenilaianDetail = {
      type: "perhatian",
      membacaPerikop: (effective[0]?.[0] as unknown as boolean) ?? null,
      aspek: PERHATIAN_ASPEK.slice(1).map((nama, idx) => {
        const row = effective[idx + 1] ?? [];
        const ditandai: number[] = [];
        row.forEach((c, ai) => { if (c) ditandai.push(ai + 1); });
        return { nama, ayat: row, ditandai };
      }),
    };
    await saveNilai(nilaiAll, detail);
  }


  const activeKey = openKriteria ? kriteriaKey(openKriteria.nama) : null;

  return (
    <SectionCard title="Input Penilaian" description="Pilih peserta & bacaan mazmur, lalu klik kriteria untuk memberi nilai.">
      {!canJudge && (
        <div className="rounded-lg border-2 border-dashed border-accent/50 bg-accent/5 p-6 text-center text-sm text-muted-foreground">
          Lengkapi dulu data <b>peserta</b>, <b>juri</b>, dan <b>kriteria</b> sebelum memulai penilaian.
        </div>
      )}
      {canJudge && (
        <div className="relative">
          {/* Overlay "menunggu juri" dihapus — juri langsung bebas ke peserta berikutnya setelah kirim. */}


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <Label>Juri</Label>
              {isAdmin && !myJuriId ? (
                <Select value={juriId} onValueChange={setJuriId}>
                  <SelectTrigger><SelectValue placeholder="Pilih juri" /></SelectTrigger>
                  <SelectContent>
                    {juri.map(j => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  readOnly
                  value={
                    myJuriNama ||
                    juri.find(j => j.id === juriId)?.nama ||
                    "—"
                  }
                  className="bg-muted/50"
                />
              )}
            </div>
            <div>
              <Label>Peserta</Label>
              <Input
                readOnly
                value={(() => {
                  const p = peserta.find(x => x.id === pesertaId);
                  return p ? `${p.nomor_urut}. ${p.nama}${p.asal ? ` — ${p.asal}` : ""}` : "";
                })()}
                placeholder={lockPesertaMazmur ? "Ditentukan Operator Lomba" : "Menunggu sesi dari Operator Lomba"}
                className="bg-muted/50"
              />
            </div>


          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px] gap-4 mb-8">
            <div>
              <Label>Bacaan Mazmur</Label>
              <Input
                readOnly
                value={mazmur.find(m => m.id === mazmurId)?.bacaan || ""}
                placeholder={lockPesertaMazmur ? "Ditentukan Operator Lomba" : "Menunggu sesi dari Operator Lomba"}
                className="bg-muted/50"
              />
            </div>

            <div>
              <Label>Kriteria Peserta</Label>
              <Input readOnly value={peserta.find(p => p.id === pesertaId)?.kategori || ""} placeholder="Otomatis dari kategori peserta" className="bg-muted/50" />
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
              const key = kriteriaKey(k.nama);
              const perbaikanAktif = !!pesertaId && perbaikanPerhatianIds.has(pesertaId);
              const isDisabled = perbaikanAktif && key !== "perhatian";
              return (
                <div key={k.id} className="relative">
                  <CriteriaPillButton
                    label={k.nama}
                    active={val !== null}
                    disabled={isDisabled}
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

            const currentPesertaLabel = (() => {
              const p = peserta.find(x => x.id === pesertaId);
              return p ? `#${p.nomor_urut} ${p.nama}` : "";
            })();

            // Aturan #5 — Nilai Akhir hanya muncul kalau seluruh kriteria selesai
            const allDone = kriteria.length > 0 && scored.length === kriteria.length;
            const nilaiAkhir = allDone
              ? (() => {
                  const totalBobot = scored.reduce((a, s) => a + Number(s.k.bobot || 0), 0);
                  if (totalBobot <= 0) {
                    return scored.reduce((a, s) => a + Number(s.v), 0) / scored.length;
                  }
                  return scored.reduce((a, s) => a + Number(s.v) * Number(s.k.bobot || 0), 0) / totalBobot;
                })()
              : null;

            function requestKirim() {
              if (!juriId || !pesertaId) return toast.error("Pilih juri dan peserta");
              if (editMode) {
                if (!mazmurId) return toast.error("Pilih bacaan mazmur");
                setConfirmOpen(true);
                return;
              }
              if (scored.length === 0) return toast.error("Belum ada nilai yang diberikan");
              setConfirmOpen(true);
            }

            async function doKirim() {
              setConfirmOpen(false);
              if (editMode) {
                // Update penilaian juri ini utk peserta lama → peserta baru & mazmur baru.
                const { error } = await supabase
                  .from("penilaian")
                  .update({ peserta_id: pesertaId, mazmur_id: mazmurId || null } as any)
                  .eq("juri_id", juriId)
                  .eq("peserta_id", editMode.oldPesertaId);
                if (error) { toast.error(error.message); return; }
                // Pindahkan submission ke peserta baru
                await supabase
                  .from("penilaian_submission" as any)
                  .delete()
                  .eq("juri_id", juriId)
                  .eq("peserta_id", editMode.oldPesertaId);
                await supabase
                  .from("penilaian_submission" as any)
                  .upsert({ juri_id: juriId, peserta_id: pesertaId } as any, { onConflict: "peserta_id,juri_id" });
                toast.success("✦ Perubahan tersimpan", {
                  description: `Penilaian diperbarui untuk ${currentPesertaLabel}.`,
                });
                resolvingCompletionRef.current = null;
                setMySubmittedIds(prev => {
                  const next = new Set(prev);
                  next.delete(editMode.oldPesertaId);
                  next.add(pesertaId);
                  return next;
                });
                setEditMode(null);
                setSubmittedFor(pesertaId);
                setOpenKriteria(null);
                await loadAll({ restoreSubmissionState: false });
                return;
              }
              // Catat submission juri untuk peserta ini — ini penanda "sudah mengirim".
              const { error: subErr } = await supabase
                .from("penilaian_submission" as any)
                .upsert({ juri_id: juriId, peserta_id: pesertaId } as any, { onConflict: "peserta_id,juri_id" });
              if (subErr) { toast.error(subErr.message); return; }
              // Jika sedang mode Perbaikan Perhatian, tutup sesi klarifikasi utk peserta ini.
              if (pesertaId && perbaikanPerhatianIds.has(pesertaId)) {
                await supabase
                  .from("var_clarification_session" as any)
                  .update({ status: "final", finalized_at: new Date().toISOString() } as any)
                  .eq("peserta_id", pesertaId)
                  .eq("status", "perbaikan_perhatian");
              }
              toast.success("✦ Penilaian dikirim", {
                description: `Penilaian untuk ${currentPesertaLabel} tersimpan.`,
              });
              resolvingCompletionRef.current = null;
              setMySubmittedIds(prev => new Set(prev).add(pesertaId));
              setSubmittedFor(pesertaId);
              setOpenKriteria(null);
              await loadAll({ restoreSubmissionState: false });
            }

            const perbaikanRows = varAktifList.filter(v => v.status === "perbaikan_perhatian");
            const varRows = varAktifList.filter(v => v.status !== "perbaikan_perhatian");
            return (
              <>
                {varRows.length > 0 && (
                  <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-500/10 p-4 mb-4 animate-pulse">
                    <div className="flex items-center gap-2 font-serif text-lg text-rose-700">
                      <AlertTriangle className="size-5" /> ⚠ POTENSI VAR — Menunggu Keputusan Inspektur
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-rose-900">
                      {varRows.map((v) => (
                        <li key={v.peserta_id}>
                          <b>{v.peserta_nama || "—"}</b> · Perbedaan pada:{" "}
                          <span className="font-semibold">
                            {v.komponen.map((k) => KOMP_LABEL[k] ?? k).join(", ") || "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-rose-800/80">
                      Inspektur Pertandingan akan meninjau dan memberi catatan/keputusan. Anda tidak perlu mengubah penilaian yang sudah dikirim.
                    </p>
                  </div>
                )}
                {perbaikanRows.length > 0 && (
                  <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-50 p-4 mb-4">
                    <div className="flex items-center gap-2 font-serif text-lg text-amber-800">
                      <AlertTriangle className="size-5" /> ✦ Perbaikan Perhatian Dibuka oleh Inspektur
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {perbaikanRows.map((v) => (
                        <li key={v.peserta_id}>
                          <b>{v.peserta_nama || "—"}</b> — silakan buka kembali kriteria <b>Perhatian</b>, samakan jawaban Anda dengan juri lain, lalu klik <b>Kirim</b>.
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-800/80">
                      Kriteria lain terkunci — hanya form Perhatian yang dapat diubah selama mode ini aktif.
                    </p>
                  </div>
                )}
                {editMode && (
                  <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 mb-4">
                    <div className="font-serif text-lg text-destructive">✦ Mode Perubahan</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Silakan perbaiki pilihan <b>Peserta</b> dan/atau <b>Bacaan Mazmur</b> agar sesuai dengan juri lain, lalu klik <b>Kirim</b>. Nilai kriteria yang sudah Anda berikan tetap disimpan.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-card to-secondary/40 p-5 sm:p-6 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      {scored.length} dari {kriteria.length} kriteria dinilai
                    </div>
                    {allDone && nilaiAkhir !== null && (
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-widest text-accent font-semibold">Nilai Akhir</div>
                        <div className="font-serif text-3xl font-bold text-foreground">
                          {nilaiAkhir.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <Button
                      size="lg"
                      onClick={requestKirim}
                      disabled={
                        saving ||
                        (!editMode && scored.length === 0) ||
                        (!editMode && !!pesertaId && mySubmittedIds.has(pesertaId))
                      }
                      className="gap-2 min-w-[160px]"
                    >
                      <Check className="size-4" />
                      {(!editMode && !!pesertaId && mySubmittedIds.has(pesertaId))
                        ? "Sudah Dikirim"
                        : editMode ? "Kirim Perubahan" : "Kirim"}
                    </Button>

                  </div>
                </div>

                {/* Aturan #6 — konfirmasi kirim */}
                <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-xl">Konfirmasi Pengiriman</DialogTitle>
                      <DialogDescription>
                        {editMode ? (
                          <>Perbarui penilaian menjadi <b>{currentPesertaLabel}</b>?</>
                        ) : (
                          <>Apakah Anda yakin akan mengirim penilaian untuk <b>{currentPesertaLabel}</b>?</>
                        )}
                        {allDone && nilaiAkhir !== null && (
                          <span className="block mt-2">
                            Nilai akhir yang akan dikirim: <b>{nilaiAkhir.toFixed(2)}</b>.
                          </span>
                        )}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
                      <Button onClick={doKirim} className="gap-1">
                        <Check className="size-4" /> Ya, kirim
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            );
          })()}

        </div>
      )}

      {/* Dialog perbedaan input antar juri — nama peserta & bacaan mazmur */}
      <Dialog open={!!discrepancy} onOpenChange={() => { /* wajib konfirmasi OK */ }}>
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive">
              ✦ Perbedaan Data Antar Juri
            </DialogTitle>
            <DialogDescription>
              Semua juri telah mengirim penilaian, namun ditemukan perbedaan input. Form penilaian dikunci sampai Anda menekan <b>OK</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto space-y-3 text-sm">
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
              <div className="font-semibold mb-1">Peserta</div>
              <div className="font-serif text-lg">{discrepancy?.pesertaNama}</div>
            </div>
            {discrepancy?.mazmur && (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
                <div className="font-semibold mb-2">Perbedaan Bacaan Mazmur</div>
                <ul className="space-y-1">
                  {discrepancy.mazmur.map((m, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{m.juriNama}</span>
                      <span className="font-medium text-right">{m.mazmurLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              Klik <b>OK</b> untuk mengaktifkan kembali penilaian peserta ini. Hanya pilihan <b>Peserta</b> dan <b>Bacaan Mazmur</b> yang dapat diubah — nilai kriteria yang sudah Anda berikan tetap tersimpan.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => perbaikiPenilaianSaya()} className="gap-1 w-full sm:w-auto">
              <Check className="size-4" /> OK, Lakukan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog perbedaan input Perhatian (Q2 / Q4 / Q5) */}
      <Dialog open={!!perhatianDiscrepancy} onOpenChange={() => { /* wajib konfirmasi OK */ }}>
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive">
              ✦ Potensi VAR — Perbedaan Perhatian
            </DialogTitle>
            <DialogDescription>
              Semua juri sudah mengirim penilaian, namun ditemukan perbedaan pilihan pada form <b>Perhatian</b>. Form penilaian dikunci sampai Anda menekan <b>OK</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto space-y-3 text-sm">
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
              <div className="font-semibold mb-1">Peserta</div>
              <div className="font-serif text-lg">{perhatianDiscrepancy?.pesertaNama}</div>
            </div>
            {perhatianDiscrepancy?.items.map((it, i) => (
              <div key={i} className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
                <div className="font-semibold mb-2">{it.pertanyaan}</div>
                <ul className="space-y-1">
                  {it.rows.map((r, j) => (
                    <li key={j} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{r.juriNama}</span>
                      <span className="font-medium text-right">
                        {r.ayat.length ? `Ayat: ${r.ayat.join(", ")}` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Klik <b>OK</b> untuk mengaktifkan kembali penilaian peserta ini. Nilai <b>Perhatian</b> Anda akan direset — silakan buka kembali form Perhatian, perbaiki pilihan, lalu klik <b>Kirim</b>.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => perbaikiPerhatianSaya()} className="gap-1 w-full sm:w-auto">
              <Check className="size-4" /> OK, Lakukan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>







      <Dialog
        open={!!openKriteria}
        onOpenChange={(v) => {
          if (saving) return; // jangan tutup saat sedang menyimpan
          if (!v) {
            // Aturan #3 — auto-save untuk catatan & perhatian saat dialog ditutup
            if (activeKey === "catatan") { saveCatatan(); return; }
            if (activeKey === "perhatian") { savePerhatian(); return; }
            setOpenKriteria(null);
          }
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
                    onClick={() => saveNilai(grade * 20, { type: "grade", grade, label, desc })}
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

                  {i === 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">Clear text?</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Ya", val: true },
                          { label: "Tidak", val: false },
                        ].map(opt => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setCatatanClearText(opt.val)}
                            className={[
                              "rounded-md border-2 py-2 text-sm font-semibold transition",
                              catatanClearText === opt.val
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-primary/20 bg-background hover:border-accent/60",
                            ].join(" ")}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(i !== 0 || catatanClearText) && (
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
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                Perubahan disimpan otomatis saat dialog ditutup.
              </p>

            </div>
          )}

          {activeKey === "perhatian" && (() => {
            const perbaikanAktifDlg = !!(pesertaId && perbaikanPerhatianIds.has(pesertaId));
            const VAR_TRIGGER_IDX = new Set([1, 3, 4]);
            return (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {perbaikanAktifDlg && (
                <div className="rounded-lg border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="size-4" /> Mode Perbaikan Perhatian
                  </div>
                  <div className="text-amber-800 dark:text-amber-200/90 mt-1">
                    Hanya <b>Salah kata</b>, <b>Menambah kata</b>, dan <b>Mengurangi kata</b> yang dapat diubah. Pilihan lain dikunci dan menampilkan jawaban Anda sebelumnya.
                  </div>
                </div>
              )}
              {PERHATIAN_ASPEK.map((aspek, i) => {
                const row = perhatianChecks[i] ?? [];
                const locked = perbaikanAktifDlg && !VAR_TRIGGER_IDX.has(i);
                const isTrigger = perbaikanAktifDlg && VAR_TRIGGER_IDX.has(i);
                return (
                  <div
                    key={aspek}
                    className={[
                      "rounded-lg border p-3",
                      locked ? "bg-muted/40 opacity-70" : "bg-card",
                      isTrigger ? "border-destructive/60 ring-1 ring-destructive/40 bg-destructive/5" : "",
                    ].join(" ")}
                  >
                    <div className="text-sm font-medium mb-2 flex items-center justify-between gap-2">
                      <span>{i + 1}. {aspek}</span>
                      {isTrigger && (
                        <span className="text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground px-2 py-0.5">
                          ⚠ Pemicu VAR — dapat diubah
                        </span>
                      )}
                      {locked && (
                        <span className="text-[10px] font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          Terkunci
                        </span>
                      )}
                    </div>
                    {i === 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Ya", val: true },
                          { label: "Tidak", val: false },
                        ].map(opt => {
                          const active = row[0] === opt.val;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={locked}
                              onClick={() =>
                                setPerhatianChecks(prev => prev.map((r, idx) => idx === 0 ? [opt.val] : r))
                              }
                              className={[
                                "rounded-md border-2 py-2 text-sm font-semibold transition",
                                active
                                  ? (opt.val
                                      ? "border-destructive bg-destructive text-destructive-foreground"
                                      : "border-accent bg-accent text-accent-foreground")
                                  : "border-primary/20 bg-background hover:border-accent/60",
                                locked ? "cursor-not-allowed opacity-70 hover:border-primary/20" : "",
                              ].join(" ")}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={["grid grid-cols-5 sm:grid-cols-8 gap-2", locked ? "pointer-events-none" : ""].join(" ")}>
                        {row.map((checked, ayatIdx) => (
                          <label
                            key={ayatIdx}
                            className={[
                              "select-none rounded-md border-2 px-2 py-1.5 text-xs font-semibold text-center leading-tight transition",
                              checked
                                ? "border-destructive bg-destructive text-destructive-foreground"
                                : "border-primary/20 bg-background",
                              locked ? "cursor-not-allowed" : "cursor-pointer hover:border-accent/60",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              disabled={locked}
                              onChange={() => {
                                if (locked) return;
                                setPerhatianChecks(prev =>
                                  prev.map((r, idx) =>
                                    idx === i ? r.map((c, ai) => (ai === ayatIdx ? !c : c)) : r
                                  )
                                );
                              }}
                            />
                            Ayat {ayatIdx + 1}
                          </label>
                        ))}
                      </div>

                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2">
                Perubahan disimpan otomatis saat dialog ditutup.
              </p>

            </div>
            );
          })()}


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
const RANKING_ALL = "__all__";
function RankingTab() {
  const [rows, setRows] = useState<Ranking[]>([]);
  const [peserta, setPeserta] = useState<{ id: string; kategori: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategori, setKategori] = useState<string>(RANKING_ALL);

  async function load() {
    setLoading(true);
    const [{ data: rankData, error: rankErr }, { data: pesertaData, error: pesertaErr }] = await Promise.all([
      supabase.rpc("get_ranking" as any),
      supabase.from("peserta").select("id, kategori"),
    ]);
    setLoading(false);
    if (rankErr) return toast.error(rankErr.message);
    if (pesertaErr) return toast.error(pesertaErr.message);
    setRows(((rankData ?? []) as unknown) as Ranking[]);
    setPeserta((pesertaData ?? []) as { id: string; kategori: string | null }[]);
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
    const list = kategori === RANKING_ALL ? rows : rows.filter((r) => (kategoriMap[r.peserta_id] ?? "") === kategori);
    return [...list].sort((a, b) => Number(b.total_skor) - Number(a.total_skor));
  }, [rows, kategori, kategoriMap]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <SectionCard
      title="Daftar Nilai Peserta"
      description="Filter berdasarkan kategori peserta untuk melihat peringkat per kategori."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={RANKING_ALL}>Semua Kategori</SelectItem>
              {kategoriList.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Muat Ulang</Button>
        </div>
      }
    >
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
      supabase.rpc("get_ranking" as any),
      supabase.from("peserta").select("id, nama, asal, sesi, nomor_urut"),
    ]);
    setLoading(false);
    if (rErr) return toast.error(rErr.message);
    if (pErr) return toast.error(pErr.message);
    const rmap: Record<string, Ranking> = {};
    (rankData ?? []).forEach((r: any) => { rmap[(r as unknown as Ranking).peserta_id] = (r as unknown as Ranking); });
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
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [j, p, n, k] = await Promise.all([
      supabase.from("juri_public" as any).select("*").eq("approved", true).eq("role", "juri").order("nama"),
      supabase.from("peserta").select("*"),
      supabase.rpc("admin_list_penilaian" as any),
      supabase.from("kriteria").select("*"),
    ]);
    setJuri((j.data as unknown as Juri[]) || []);
    setPeserta((p.data as Peserta[]) || []);
    setPenilaian((n.data as unknown as Penilaian[]) || []);
    setKriteria((k.data as Kriteria[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalPeserta = peserta.length;

  function computeNilai(juriId: string, pesertaId: string): number {
    const rows = penilaian.filter(x => x.juri_id === juriId && x.peserta_id === pesertaId);
    if (rows.length === 0) return 0;
    const scored = rows.map(r => {
      const k = kriteria.find(kk => kk.id === r.kriteria_id);
      return { bobot: Number(k?.bobot || 0), nilai: Number(r.nilai) };
    });
    const totalBobot = scored.reduce((s, x) => s + x.bobot, 0);
    const weighted = totalBobot > 0
      ? scored.reduce((s, x) => s + x.nilai * x.bobot, 0) / totalBobot
      : scored.reduce((s, x) => s + x.nilai, 0) / scored.length;
    return Math.round(weighted * 100) / 100;
  }

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

              {r.sudahList.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-muted-foreground mb-2">
                    {r.sudahList.length} peserta sudah dinilai
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="py-1.5 pr-3">No</th>
                          <th className="py-1.5 pr-3">Nama Peserta</th>
                          <th className="py-1.5 pr-3 text-right">Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.sudahList.map((p) => (
                          <tr key={p.id} className="border-b last:border-b-0">
                            <td className="py-1.5 pr-3">{p.nomor_urut}</td>
                            <td className="py-1.5 pr-3">{p.nama}{p.asal ? ` — ${p.asal}` : ""}</td>
                            <td className="py-1.5 pr-3 text-right font-semibold text-primary">
                              {computeNilai(r.juri.id, p.id)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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

/* LIHAT PENILAIAN */
const LIHAT_ALL = "__all__";
function LihatPenilaianTab() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [juri, setJuri] = useState<Juri[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategori, setKategori] = useState<string>(LIHAT_ALL);
  const [pesertaPilih, setPesertaPilih] = useState<string>("");

  async function load() {
    setLoading(true);
    const [p, j, k, n] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
    ]);
    setLoading(false);
    if (p.error) return toast.error(p.error.message);
    if (j.error) return toast.error(j.error.message);
    if (k.error) return toast.error(k.error.message);
    if (n.error) return toast.error(n.error.message);
    setPeserta((p.data ?? []) as Peserta[]);
    setJuri(((j.data ?? []) as unknown as Juri[]).filter((x) => x.approved && x.role !== "viewer"));
    setKriteria((k.data ?? []) as Kriteria[]);
    setPenilaian((n.data ?? []) as Penilaian[]);
  }
  useEffect(() => { load(); }, []);

  const kategoriList = useMemo(() => {
    const s = new Set<string>();
    peserta.forEach((p) => { if (p.kategori && p.kategori.trim()) s.add(p.kategori.trim()); });
    return Array.from(s).sort();
  }, [peserta]);

  const pesertaFiltered = useMemo(
    () => (kategori === LIHAT_ALL ? peserta : peserta.filter((p) => (p.kategori ?? "") === kategori)),
    [peserta, kategori]
  );

  const totalBobot = useMemo(() => kriteria.reduce((s, k) => s + Number(k.bobot || 0), 0), [kriteria]);

  // score[pesertaId][juriId] = { weighted, perKriteria: {kriteriaId: nilai} }
  const scoreMap = useMemo(() => {
    const m: Record<string, Record<string, { weighted: number; per: Record<string, number> }>> = {};
    penilaian.forEach((n) => {
      const kr = kriteria.find((k) => k.id === n.kriteria_id);
      if (!kr) return;
      m[n.peserta_id] ??= {};
      m[n.peserta_id][n.juri_id] ??= { weighted: 0, per: {} };
      m[n.peserta_id][n.juri_id].per[n.kriteria_id] = Number(n.nilai);
    });
    Object.values(m).forEach((byJuri) => {
      Object.values(byJuri).forEach((rec) => {
        let sum = 0;
        kriteria.forEach((k) => {
          const v = rec.per[k.id];
          if (v !== undefined) sum += v * Number(k.bobot || 0);
        });
        rec.weighted = totalBobot > 0 ? sum / totalBobot : 0;
      });
    });
    return m;
  }, [penilaian, kriteria, totalBobot]);

  function buildPesertaDetail(doc: jsPDF, p: Peserta, startY: number) {
    doc.setFontSize(14); doc.text(`${p.nomor_urut}. ${p.nama}`, 40, startY);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Kategori: ${p.kategori || "—"}${p.asal ? " • Asal: " + p.asal : ""}`, 40, startY + 18);
    doc.setTextColor(0);
    const dHead = [["Juri", ...kriteria.map((k) => `${k.nama} (b:${k.bobot})`), "Total Berbobot"]];
    const dBody = juri.map((j) => {
      const rec = scoreMap[p.id]?.[j.id];
      return [
        j.nama,
        ...kriteria.map((k) => {
          const v = rec?.per[k.id];
          return v === undefined ? "—" : Number(v).toFixed(2);
        }),
        rec ? rec.weighted.toFixed(2) : "—",
      ];
    });
    autoTable(doc, {
      head: dHead, body: dBody, startY: startY + 36,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [120, 30, 45], textColor: 255 },
    });
  }

  function downloadPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = "Laporan Nilai Peserta";
    const subtitle = kategori === LIHAT_ALL ? "Semua Kategori" : `Kategori: ${kategori}`;
    doc.setFontSize(16); doc.text(title, 40, 40);
    doc.setFontSize(11); doc.setTextColor(100); doc.text(subtitle, 40, 58);
    doc.setTextColor(0);

    const head = [[
      "No.", "Peserta", "Kategori",
      ...juri.map((j) => j.nama),
      "Rata-rata", "Total"
    ]];
    const body = pesertaFiltered.map((p) => {
      const scores = juri.map((j) => scoreMap[p.id]?.[j.id]?.weighted);
      const valid = scores.filter((s): s is number => typeof s === "number" && s > 0);
      const rata = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
      const total = valid.reduce((a, b) => a + b, 0);
      return [
        String(p.nomor_urut),
        p.nama,
        p.kategori || "—",
        ...scores.map((s) => (s === undefined ? "—" : s.toFixed(2))),
        valid.length ? rata.toFixed(2) : "—",
        valid.length ? total.toFixed(2) : "—",
      ];
    });

    autoTable(doc, {
      head, body, startY: 76, styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [120, 30, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 244, 240] },
      columnStyles: { 0: { halign: "center", cellWidth: 32 } },
    });

    pesertaFiltered.forEach((p) => {
      const hasAny = juri.some((j) => scoreMap[p.id]?.[j.id]);
      if (!hasAny) return;
      doc.addPage();
      buildPesertaDetail(doc, p, 40);
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = kategori === LIHAT_ALL ? "semua" : kategori.replace(/\s+/g, "_");
    doc.save(`laporan-nilai-${suffix}-${stamp}.pdf`);
  }

  function downloadPesertaPDF() {
    const p = peserta.find((x) => x.id === pesertaPilih);
    if (!p) return toast.error("Pilih peserta terlebih dahulu");
    const hasAny = juri.some((j) => scoreMap[p.id]?.[j.id]);
    if (!hasAny) return toast.error("Peserta ini belum memiliki penilaian");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16); doc.text("Laporan Nilai Peserta", 40, 40);
    buildPesertaDetail(doc, p, 76);
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = p.nama.replace(/\s+/g, "_");
    doc.save(`nilai-${p.nomor_urut}-${safe}-${stamp}.pdf`);
  }

  return (
    <SectionCard
      title="Lihat Penilaian"
      description="Rekap nilai setiap juri untuk setiap peserta dan kategori. Unduh sebagai laporan PDF."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={LIHAT_ALL}>Semua Kategori</SelectItem>
              {kategoriList.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Muat Ulang</Button>
          <Select value={pesertaPilih} onValueChange={setPesertaPilih}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pilih Peserta" /></SelectTrigger>
            <SelectContent>
              {pesertaFiltered.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nomor_urut}. {p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={downloadPesertaPDF} disabled={loading || !pesertaPilih} className="gap-2">
            <Download className="size-4" /> Unduh PDF
          </Button>
          <Button onClick={downloadPDF} disabled={loading || pesertaFiltered.length === 0} className="gap-2">
            <Download className="size-4" /> Unduh Semua
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No.</TableHead>
              <TableHead>Peserta</TableHead>
              <TableHead>Kategori</TableHead>
              {juri.map((j) => (
                <TableHead key={j.id} className="text-right whitespace-nowrap">{j.nama}</TableHead>
              ))}
              <TableHead className="text-right w-28">Rata-rata</TableHead>
              <TableHead className="text-right w-28">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5 + juri.length} className="text-center py-10 text-muted-foreground">Memuat…</TableCell></TableRow>}
            {!loading && pesertaFiltered.length === 0 && <TableRow><TableCell colSpan={5 + juri.length} className="text-center py-10 text-muted-foreground">Belum ada peserta.</TableCell></TableRow>}
            {pesertaFiltered.map((p) => {
              const scores = juri.map((j) => scoreMap[p.id]?.[j.id]?.weighted);
              const valid = scores.filter((s): s is number => typeof s === "number" && s > 0);
              const rata = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
              const total = valid.reduce((a, b) => a + b, 0);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                  <TableCell className="font-medium">{p.nama}</TableCell>
                  <TableCell className="text-muted-foreground">{p.kategori || "—"}</TableCell>
                  {scores.map((s, i) => (
                    <TableCell key={juri[i].id} className="text-right font-mono">
                      {s === undefined ? <span className="text-muted-foreground italic">—</span> : s.toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono">{valid.length ? rata.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{valid.length ? total.toFixed(2) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function RincianNilaiTab() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [juri, setJuri] = useState<Juri[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [kategoriRows, setKategoriRows] = useState<Kategori[]>([]);
  const [mazmur, setMazmur] = useState<Mazmur[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategoriFilter, setKategoriFilter] = useState<string>(LIHAT_ALL);
  const [pesertaFilter, setPesertaFilter] = useState<string>(LIHAT_ALL);

  async function load() {
    setLoading(true);
    const [p, j, k, n, kt, m] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
      supabase.from("kategori").select("*").order("created_at"),
      supabase.from("mazmur").select("*"),
    ]);
    setLoading(false);
    for (const r of [p, j, k, n, kt, m]) if ((r as any).error) return toast.error((r as any).error.message);
    setPeserta((p.data ?? []) as Peserta[]);
    setJuri(((j.data ?? []) as unknown as Juri[]).filter((x) => x.approved && x.role !== "viewer"));
    setKriteria((k.data ?? []) as Kriteria[]);
    setPenilaian((n.data ?? []) as Penilaian[]);
    setKategoriRows((kt.data ?? []) as Kategori[]);
    setMazmur((m.data ?? []) as Mazmur[]);
  }
  useEffect(() => {
    load();
  }, []);

  const kategoriList = useMemo(() => {
    const s = new Set<string>();
    peserta.forEach((p) => { if (p.kategori && p.kategori.trim()) s.add(p.kategori.trim()); });
    return Array.from(s).sort();
  }, [peserta]);

  const pesertaFiltered = useMemo(
    () => (kategoriFilter === LIHAT_ALL ? peserta : peserta.filter((p) => (p.kategori ?? "") === kategoriFilter)),
    [peserta, kategoriFilter]
  );
  const pesertaShown = useMemo(
    () => (pesertaFilter === LIHAT_ALL ? pesertaFiltered : pesertaFiltered.filter((p) => p.id === pesertaFilter)),
    [pesertaFiltered, pesertaFilter]
  );

  const totalBobotKriteria = useMemo(() => kriteria.reduce((s, k) => s + Number(k.bobot || 0), 0), [kriteria]);

  function kategoriForKriteria(krNama: string) {
    return kategoriRows.find(
      (k) => (k.kriteria_penilaian ?? "").toLowerCase().trim() === krNama.toLowerCase().trim()
    );
  }

  function buildPesertaPDF(doc: jsPDF, p: Peserta, startFresh: boolean) {
    if (!startFresh) doc.addPage();
    doc.setFontSize(16); doc.text("Rincian Penilaian Peserta", 40, 40);
    doc.setFontSize(12); doc.setTextColor(60);
    doc.text(`${p.nomor_urut}. ${p.nama}`, 40, 62);
    doc.setFontSize(10); doc.setTextColor(100);
    const meta = [
      p.kategori ? `Kategori: ${p.kategori}` : null,
      p.asal ? `Asal: ${p.asal}` : null,
      p.sesi ? `Sesi: ${p.sesi}` : null,
    ].filter(Boolean).join("  •  ");
    if (meta) doc.text(meta, 40, 78);
    doc.setTextColor(0);

    let y = meta ? 96 : 82;

    const juriDenganNilai = juri.filter((j) => penilaian.some((n) => n.peserta_id === p.id && n.juri_id === j.id));
    if (juriDenganNilai.length === 0) {
      doc.setFontSize(11); doc.setTextColor(120);
      doc.text("Belum ada penilaian untuk peserta ini.", 40, y);
      return;
    }

    juriDenganNilai.forEach((j) => {
      const rows = kriteria.map((k) => {
        const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
        const kat = kategoriForKriteria(k.nama);
        const nilai = rec ? Number(rec.nilai) : null;
        const bobot = Number(k.bobot || 0);
        const berbobot = nilai !== null ? (nilai * bobot) : null;
        return [
          k.nama,
          kat?.kriteria_peserta ?? (p.kategori || "—"),
          bobot.toString(),
          kat ? `${kat.batas_bawah} – ${kat.batas_atas}` : "—",
          kat ? String(kat.nilai_tengah) : "—",
          kat ? String(kat.nilai_standart) : "—",
          nilai !== null ? nilai.toFixed(2) : "—",
          berbobot !== null ? berbobot.toFixed(2) : "—",
        ];
      });
      const totalNilai = rows.reduce((s, r) => s + (r[6] === "—" ? 0 : parseFloat(r[6] as string)), 0);
      const totalBerbobot = rows.reduce((s, r) => s + (r[7] === "—" ? 0 : parseFloat(r[7] as string)), 0);
      const rata = totalBobotKriteria > 0 ? totalBerbobot / totalBobotKriteria : 0;

      const mzId = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id)?.mazmur_id;
      const mz = mazmur.find((x) => x.id === mzId);

      doc.setFontSize(11); doc.setTextColor(0);
      doc.text(`Juri: ${j.nama}${j.jabatan ? " — " + j.jabatan : ""}`, 40, y);
      if (mz) { doc.setFontSize(9); doc.setTextColor(110); doc.text(`Mazmur: ${mz.bacaan} (${mz.jumlah_ayat} ayat)`, 40, y + 12); doc.setTextColor(0); }
      autoTable(doc, {
        startY: y + (mz ? 18 : 6),
        head: [["Kriteria (Kategori)", "Kriteria Peserta", "Bobot", "Batas", "Tengah", "Standar", "Nilai", "Berbobot"]],
        body: rows,
        foot: [["", "", "", "", "", "Total", totalNilai.toFixed(2), totalBerbobot.toFixed(2)],
               ["", "", "", "", "", "Rata-rata Berbobot", "", rata.toFixed(2)]],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [120, 30, 45], textColor: 255 },
        footStyles: { fillColor: [245, 235, 220], textColor: 40, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [250, 247, 243] },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;

      // Rincian pilihan per kriteria (detail sub-tables)
      kriteria.forEach((k) => {
        const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
        const d = (rec as any)?.detail as PenilaianDetail | undefined;
        if (!d) return;
        let head: string[][] = [];
        let body: (string | number)[][] = [];
        let title = `Rincian: ${k.nama}`;
        if (d.type === "grade") {
          head = [["Pilihan", "Deskripsi"]];
          body = [[d.label, d.desc]];
        } else if (d.type === "catatan") {
          head = [["#", "Aspek", "Clear Text", "Nilai (1–5)"]];
          body = d.aspek.map((a, i) => [
            i + 1, a.nama,
            i === 0 ? (d.clearText ? "Ya" : "Tidak") : "—",
            a.skipped ? "— (dilewati)" : String(a.nilai),
          ]);
        } else if (d.type === "perhatian") {
          head = [["#", "Aspek", "Penanda"]];
          body = [
            ["1", "Tidak Membaca Perikop", d.membacaPerikop === null ? "—" : d.membacaPerikop ? "Ya" : "Tidak"],
            ...d.aspek.map((a, i) => [
              String(i + 2),
              a.nama,
              a.ditandai.length ? `Ayat: ${a.ditandai.join(", ")}` : "—",
            ]),
          ];
        }
        if (body.length === 0) return;
        doc.setFontSize(9); doc.setTextColor(90);
        doc.text(title, 40, y);
        autoTable(doc, {
          startY: y + 4,
          head, body,
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: { fillColor: [180, 140, 60], textColor: 255 },
          alternateRowStyles: { fillColor: [252, 249, 244] },
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 10;
        if (y > 520) { doc.addPage(); y = 40; }
      });

      y += 10;
      if (y > 520) { doc.addPage(); y = 40; }
    });
  }

  function downloadSatu(p: Peserta) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    buildPesertaPDF(doc, p, true);
    doc.save(`rincian-${p.nomor_urut}-${p.nama.replace(/\s+/g, "_")}.pdf`);
  }
  function downloadSemua() {
    if (pesertaShown.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pesertaShown.forEach((p, i) => buildPesertaPDF(doc, p, i === 0));
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = kategoriFilter === LIHAT_ALL ? "semua" : kategoriFilter.replace(/\s+/g, "_");
    doc.save(`rincian-nilai-${suffix}-${stamp}.pdf`);
  }

  return (
    <SectionCard
      title="Rincian Nilai"
      description="Rincian penilaian per juri, per kriteria, dan per pilihan kategori. Unduh laporan PDF satu-satu atau sekaligus."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kategoriFilter} onValueChange={(v) => { setKategoriFilter(v); setPesertaFilter(LIHAT_ALL); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={LIHAT_ALL}>Semua Kategori</SelectItem>
              {kategoriList.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={pesertaFilter} onValueChange={setPesertaFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Semua Peserta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={LIHAT_ALL}>Semua Peserta</SelectItem>
              {pesertaFiltered.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nomor_urut}. {p.nama}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Muat Ulang</Button>
          <Button onClick={downloadSemua} disabled={loading || pesertaShown.length === 0} className="gap-2">
            <Download className="size-4" /> Unduh Semua PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {loading && <div className="text-center py-10 text-muted-foreground">Memuat…</div>}
        {!loading && pesertaShown.length === 0 && <div className="text-center py-10 text-muted-foreground">Tidak ada peserta.</div>}
        {!loading && pesertaShown.map((p) => {
          const juriDenganNilai = juri.filter((j) => penilaian.some((n) => n.peserta_id === p.id && n.juri_id === j.id));
          return (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-base">{p.nomor_urut}. {p.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    {[p.kategori && `Kategori: ${p.kategori}`, p.asal && `Asal: ${p.asal}`, p.sesi && `Sesi: ${p.sesi}`].filter(Boolean).join(" • ") || "—"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadSatu(p)} className="gap-2">
                  <Download className="size-4" /> Unduh PDF
                </Button>
              </div>
              {juriDenganNilai.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">Belum ada penilaian.</div>
              ) : (
                <div className="space-y-4">
                  {juriDenganNilai.map((j) => {
                    let totalNilai = 0, totalBerbobot = 0;
                    const rows = kriteria.map((k) => {
                      const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
                      const kat = kategoriForKriteria(k.nama);
                      const nilai = rec ? Number(rec.nilai) : null;
                      const bobot = Number(k.bobot || 0);
                      const berbobot = nilai !== null ? nilai * bobot : null;
                      if (nilai !== null) { totalNilai += nilai; totalBerbobot += berbobot!; }
                      return { k, kat, nilai, bobot, berbobot };
                    });
                    const rata = totalBobotKriteria > 0 ? totalBerbobot / totalBobotKriteria : 0;
                    return (
                      <div key={j.id} className="rounded-md border bg-background overflow-x-auto">
                        <div className="px-3 py-2 text-sm font-medium bg-secondary/60">Juri: {j.nama}{j.jabatan ? ` — ${j.jabatan}` : ""}</div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kriteria</TableHead>
                              <TableHead>Kriteria Peserta</TableHead>
                              <TableHead className="text-right">Bobot</TableHead>
                              <TableHead className="text-right">Batas</TableHead>
                              <TableHead className="text-right">Tengah</TableHead>
                              <TableHead className="text-right">Standar</TableHead>
                              <TableHead className="text-right">Nilai</TableHead>
                              <TableHead className="text-right">Berbobot</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map(({ k, kat, nilai, bobot, berbobot }) => (
                              <TableRow key={k.id}>
                                <TableCell className="font-medium">{k.nama}</TableCell>
                                <TableCell className="text-muted-foreground">{kat?.kriteria_peserta ?? (p.kategori || "—")}</TableCell>
                                <TableCell className="text-right font-mono">{bobot}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{kat ? `${kat.batas_bawah}–${kat.batas_atas}` : "—"}</TableCell>
                                <TableCell className="text-right font-mono">{kat ? kat.nilai_tengah : "—"}</TableCell>
                                <TableCell className="text-right font-mono">{kat ? kat.nilai_standart : "—"}</TableCell>
                                <TableCell className="text-right font-mono">{nilai !== null ? nilai.toFixed(2) : <span className="italic text-muted-foreground">—</span>}</TableCell>
                                <TableCell className="text-right font-mono">{berbobot !== null ? berbobot.toFixed(2) : "—"}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-secondary/40 font-semibold">
                              <TableCell colSpan={6} className="text-right">Total</TableCell>
                              <TableCell className="text-right font-mono">{totalNilai.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono">{totalBerbobot.toFixed(2)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-primary/10 font-semibold">
                              <TableCell colSpan={7} className="text-right">Rata-rata Berbobot</TableCell>
                              <TableCell className="text-right font-mono text-primary">{rata.toFixed(2)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <div className="px-3 py-3 space-y-3 border-t bg-muted/20">
                          {kriteria.map((k) => {
                            const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
                            if (!rec) return null;
                            const d = (rec as any)?.detail as PenilaianDetail | undefined;
                            if (!d) return (
                              <div key={k.id} className="rounded border bg-background p-3">
                                <div className="text-xs font-semibold text-primary mb-1">Rincian: {k.nama}</div>
                                <div className="text-xs italic text-muted-foreground">Rincian pilihan belum tersedia (penilaian dibuat sebelum fitur rincian aktif). Hapus lalu input ulang penilaian ini agar rincian tersimpan.</div>
                              </div>
                            );
                            return (
                              <div key={k.id} className="rounded border bg-background p-3">
                                <div className="text-xs font-semibold text-primary mb-2">Rincian: {k.nama}</div>
                                {d.type === "grade" && (
                                  <div className="text-xs">
                                    <span className="font-semibold">{d.label}</span> — <span className="text-muted-foreground">{d.desc}</span>
                                  </div>
                                )}
                                {d.type === "catatan" && (
                                  <div className="grid gap-1 text-xs">
                                    {d.aspek.map((a, i) => (
                                      <div key={i} className="flex justify-between gap-3 border-b last:border-0 py-1">
                                        <span>{i + 1}. {a.nama}{i === 0 ? ` (Clear text: ${d.clearText ? "Ya" : "Tidak"})` : ""}</span>
                                        <span className="font-mono">{a.skipped ? "—" : a.nilai}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {d.type === "perhatian" && (
                                  <div className="grid gap-1 text-xs">
                                    <div className="flex justify-between gap-3 border-b py-1">
                                      <span>1. Tidak Membaca Perikop</span>
                                      <span className="font-mono">{d.membacaPerikop === null ? "—" : d.membacaPerikop ? "Ya" : "Tidak"}</span>
                                    </div>
                                    {d.aspek.map((a, i) => (
                                      <div key={i} className="flex justify-between gap-3 border-b last:border-0 py-1">
                                        <span>{i + 2}. {a.nama}</span>
                                        <span className="font-mono text-right">{a.ditandai.length ? `Ayat: ${a.ditandai.join(", ")}` : "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}


/* Tombol Reset SEMUA Penilaian (semua juri, semua peserta) */
function ResetAllPenilaianButton() {
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (!window.confirm("Reset SEMUA nilai peserta dari seluruh juri?\n\nSemua data penilaian akan dihapus permanen dan tidak dapat dikembalikan.")) return;
    if (!window.confirm("Konfirmasi sekali lagi: hapus SEMUA penilaian sekarang?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_reset_all_penilaian" as any);
    setBusy(false);
    if (error) return toast.error("Gagal reset: " + error.message);
    toast.success("✦ Semua penilaian telah direset", { description: "Data nilai peserta dari seluruh juri telah dihapus." });
  }
  return (
    <Button variant="destructive" size="sm" onClick={reset} disabled={busy} className="gap-2">
      <Trash2 className="size-4" />{busy ? "Mereset..." : "Reset Semua Nilai"}
    </Button>
  );
}

