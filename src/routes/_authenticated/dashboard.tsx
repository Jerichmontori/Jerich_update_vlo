import { usePolling } from "@/hooks/usePolling";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import VarPersepsiDetail from "@/components/VarPersepsiDetail";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { Trash2, Plus, Trophy, Users, Gavel, ListChecks, ClipboardCheck, BookOpenText, Upload, Download, Check, Tags, ChevronLeft, ChevronRight, ChevronDown, LayoutDashboard, CheckCircle2, XCircle, FileText, KeyRound, AlertTriangle, Eye, EyeOff, RotateCcw } from "lucide-react";
import SesiLiveRanking from "@/components/SesiLiveRanking";
import AdminVarTab from "@/components/AdminVarTab";
import BackupExcelButton from "@/components/BackupExcelButton";
import LaporanPertanggungjawabanButton from "@/components/LaporanPertanggungjawabanButton";
import Top10PdfButton from "@/components/Top10PdfButton";
import JuriHasilFinalTab from "@/components/JuriHasilFinalTab";
import GantiPasswordButton from "@/components/GantiPasswordButton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BrandLogo from "@/components/BrandLogo";
import { useBranding } from "@/hooks/useBranding";
import BrandingSettingsButton from "@/components/BrandingSettingsButton";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar, { ADMIN_SECTION_LABEL, type AdminSection } from "@/components/AdminSidebar";
import PitaNilaiTab from "@/components/PitaNilaiTab";
import ModeInspekturSetting from "@/components/ModeInspekturSetting";

import PratinjauPita from "@/components/PratinjauPita";


import KeberatanTab from "@/components/KeberatanTab";
import PerbaikanNotifikasi from "@/components/PerbaikanNotifikasi";
import PermintaanPerbaikanJuri from "@/components/PermintaanPerbaikanJuri";
import PerbaikanAktifPanel from "@/components/PerbaikanAktifPanel";
import JuriAjukanPerbaikan from "@/components/JuriAjukanPerbaikan";

import PeninjauanTab from "@/components/PeninjauanTab";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: App,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null; sesi: string | null; kategori: string | null };
type AppRole = "admin" | "juri" | "panitia" | "inspektur" | "inspektur_var" | "ketua_juri" | "viewer" | "operator_vmix";
const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  juri: "Juri",
  panitia: "Panitia",
  inspektur: "Inspektur Pertandingan",
  inspektur_var: "Inspektur VAR",
  ketua_juri: "Ketua Dewan Juri",
  viewer: "Sekretariat",
  operator_vmix: "Operator vMix",
};
type Juri = { id: string; nama: string; jabatan: string | null; email: string | null; role: AppRole | null; approved: boolean; user_id: string | null; aktif_menilai?: boolean };
type Kriteria = { id: string; nama: string; bobot: number; batas_atas: number; batas_bawah: number };
type Mazmur = { id: string; bacaan: string; jumlah_ayat: number; kategori: string | null };
type PenilaianDetail =
  | { type: "grade"; grade: number; label: string; desc: string }
  | { type: "catatan"; clearText?: boolean; aspek: { nama: string; nilai: number; skipped?: boolean }[] }
  | { type: "perhatian"; clearText: boolean | null; membacaPerikop?: boolean | null; aspek: { nama: string; ayat: boolean[]; ditandai: number[] }[] }
  | null;
type Penilaian = { id: string; peserta_id: string; juri_id: string; kriteria_id: string; nilai: number; mazmur_id: string | null; detail?: PenilaianDetail; created_at?: string };
type Ranking = { peserta_id: string; nomor_urut: number; nama: string; asal: string | null; total_skor: number; rata_rata: number; jumlah_juri: number; nilai_akhir: number | null; var_status?: string | null; juri_total_sum?: number | null; juri_spread?: number | null };
type Kategori = { id: string; kategori: string | null; batas_atas: number; batas_bawah: number; kriteria_penilaian: string | null; kriteria_peserta: string | null; bobot: number; nilai_tengah: number; nilai_standart: number };
type Submission = { peserta_id: string; juri_id: string };

function App() {
  // Single-device enforcement dijalankan di layout `_authenticated/route.tsx`
  // agar berlaku untuk semua halaman (dashboard, operator, inspektur).
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [roles, setRoles] = useState<{
    isAdm: boolean; isPan: boolean; isJuri: boolean; isInsp: boolean; isKetua: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const [{ data: isAdm }, { data: isPan }, { data: isJuri }, { data: isInsp }, { data: isKetua }, { data: isVmix }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "panitia" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "juri" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "inspektur" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "ketua_juri" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "operator_vmix" as any }),
      ]);
      // Role tunggal → arahkan ke halaman khusus role tersebut
      if (!isAdm) {
        if (isVmix && !isPan && !isJuri && !isInsp && !isKetua) { window.location.href = "/vmix"; return; }
        if (isPan && !isJuri && !isInsp && !isKetua) { window.location.href = "/operator"; return; }
        if (isInsp && !isPan && !isJuri && !isKetua) { window.location.href = "/inspektur"; return; }
        if (!isPan && !isJuri && !isInsp && !isKetua) { window.location.href = "/viewer"; return; }
      }
      setRoles({ isAdm: !!isAdm, isPan: !!isPan, isJuri: !!isJuri, isInsp: !!isInsp, isKetua: !!isKetua });
    })();
  }, []);

  if (!roles) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;

  // Juri murni (bukan admin/panitia/inspektur/ketua) → hanya tab Penilaian
  const juriOnly = roles.isJuri && !roles.isAdm && !roles.isPan && !roles.isInsp && !roles.isKetua;

  const toaster = (
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
  );

  if (juriOnly) {
    return (
      <div className="min-h-screen">
        {toaster}
        <Header />
        <main className="mx-auto max-w-6xl px-4 pb-16">
          <Tabs defaultValue="penilaian" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-secondary/60 p-1">
              <TabsTrigger value="penilaian" className="gap-2"><ClipboardCheck className="size-4" />Penilaian</TabsTrigger>
              <TabsTrigger value="hasil" className="gap-2"><FileText className="size-4" />Hasil Saya</TabsTrigger>
              <TabsTrigger value="perbaikan" className="gap-2"><RotateCcw className="size-4" />Perbaikan</TabsTrigger>
            </TabsList>
            <TabsContent value="penilaian"><PanelErrorBoundary label="penilaian_juri"><PenilaianTab /></PanelErrorBoundary></TabsContent>
            <TabsContent value="hasil"><JuriHasilFinalTab /></TabsContent>
            <TabsContent value="perbaikan"><JuriAjukanPerbaikan /></TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {toaster}
      <div className="min-h-screen flex w-full">
        <AdminSidebar value={section} onChange={setSection} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16">
            <div className="flex flex-wrap items-center gap-2 pb-4">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">{ADMIN_SECTION_LABEL[section]}</h2>
              {roles.isAdm && (
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <BrandingSettingsButton /><Top10PdfButton /><LaporanPertanggungjawabanButton /><BackupExcelButton />
                </div>
              )}
            </div>
            {section === "dashboard" && (
              <div className="space-y-4">
                <PerbaikanNotifikasi />
                {roles.isAdm && <PermintaanPerbaikanJuri />}
                {roles.isAdm && <PerbaikanAktifPanel mode="admin" />}
                <DashboardTab />
              </div>
            )}
            {section === "hasil" && <HasilNilaiTab />}
            {section === "live" && <SesiLiveRanking />}
            {section === "penilaian" && <PanelErrorBoundary label="penilaian_admin"><PenilaianTab /></PanelErrorBoundary>}
            {section === "var" && (
              <div className="space-y-4">
                <PerbaikanNotifikasi />
                <AdminVarTab />
              </div>
            )}
            {section === "keberatan" && <KeberatanTab canDecide={roles.isAdm} canConfig={roles.isAdm} />}

            {section === "peninjauan" && <PeninjauanTab canDecide={roles.isAdm} />}
            {section === "peserta" && <PesertaTab />}
            {section === "juri" && <JuriTab />}
            {section === "pengaturan-nilai" && <PengaturanNilaiTab />}
            {section === "mazmur" && <MazmurTab />}
            {section === "reset" && <ResetTab />}

          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/** Gabungan tab Ranking + Posisi + Lihat Nilai + Rincian Nilai.
 *  Hanya tampilan aktif yang dimuat sehingga query berat tidak berjalan berulang. */
function HasilNilaiTab() {
  return (
    <Tabs defaultValue="peringkat" className="w-full">
      <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto bg-secondary/60 p-1 [&>button]:flex-1 [&>button]:min-w-[8rem]">
        <TabsTrigger value="peringkat" className="gap-2"><Trophy className="size-4" />Peringkat</TabsTrigger>
        <TabsTrigger value="sesi" className="gap-2"><Trophy className="size-4" />Per Sesi</TabsTrigger>
        <TabsTrigger value="juri" className="gap-2"><FileText className="size-4" />Nilai per Juri</TabsTrigger>
        <TabsTrigger value="rincian" className="gap-2"><FileText className="size-4" />Detail Kriteria</TabsTrigger>
      </TabsList>
      <TabsContent value="peringkat"><RankingTab /></TabsContent>
      <TabsContent value="sesi"><PosisiTab /></TabsContent>
      <TabsContent value="juri"><LihatPenilaianTab /></TabsContent>
      <TabsContent value="rincian"><RincianNilaiTab /></TabsContent>
    </Tabs>
  );
}

/** Gabungan tab Kriteria + Kategori. */
function PengaturanNilaiTab() {
  return (
    <div className="space-y-4">
      <ModeInspekturSetting />
      <Tabs defaultValue="kriteria" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto bg-secondary/60 p-1">
          <TabsTrigger value="kriteria" className="gap-2"><ListChecks className="size-4" />Kriteria</TabsTrigger>
          <TabsTrigger value="kategori" className="gap-2"><Tags className="size-4" />Kategori</TabsTrigger>
          <TabsTrigger value="pita" className="gap-2"><Tags className="size-4" />Pita Nilai</TabsTrigger>
        </TabsList>
        <TabsContent value="kriteria"><KriteriaTab /></TabsContent>
        <TabsContent value="kategori"><KategoriTab /></TabsContent>
        <TabsContent value="pita"><PitaNilaiTab /></TabsContent>
      </Tabs>
    </div>
  );
}


function Header() {
  const branding = useBranding();
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
          <BrandLogo className="h-11 sm:h-14 w-auto shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">{branding.kicker}</p>
            <h1 className="truncate text-2xl sm:text-4xl font-serif font-semibold text-foreground">{branding.judul}</h1>
            <p className="text-sm text-muted-foreground mt-1">{branding.subjudul}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {currentUser && (
            <div className="text-right text-sm hidden sm:block">
              <div className="font-semibold leading-tight">{currentUser.nama}</div>
              <div className="text-xs text-muted-foreground">{currentUser.role}{currentUser.email ? ` · ${currentUser.email}` : ""}</div>
            </div>
          )}
          <GantiPasswordButton variant="outline" />
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
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const [isAdm, setIsAdm] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) return;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" as any });
      setIsAdm(!!data);
    })();
  }, []);


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

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [items.length]);




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

  async function toggleTerlambat(p: Peserta) {
    const next = !(p as any).terlambat;
    if (next && !confirm(`Tandai ${p.nomor_urut}. ${p.nama} sebagai TERLAMBAT? Peserta dianggap selesai dinilai dengan nilai akhir 1.`)) return;
    const { error } = await supabase.rpc("set_peserta_terlambat" as any, { _peserta: p.id, _terlambat: next });
    if (error) return toast.error(error.message);
    toast.success(next ? "Peserta ditandai terlambat (nilai akhir 1)" : "Status terlambat dibatalkan");
    load();
  }

  async function bukaPenilaianUlang(p: Peserta) {
    const alasan = window.prompt(
      `Buka kembali penilaian untuk ${p.nomor_urut}. ${p.nama}?\n` +
      `Seluruh kiriman juri untuk peserta ini akan dibuka kembali (nilai lama dicadangkan otomatis).\n\n` +
      `Tulis alasan (wajib):`
    );
    if (alasan === null) return;
    if (!alasan.trim()) return toast.error("Alasan buka perbaikan wajib diisi");
    const { error } = await supabase.rpc("admin_buka_penilaian_ulang" as any, { _peserta: p.id, _catatan: alasan.trim() });
    if (error) return toast.error(error.message);
    toast.success("Penilaian dibuka kembali — dapat dibatalkan selama belum ada nilai baru");
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


  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = page * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  return (
    <SectionCard
      title="Daftar Peserta"
      description="Tambahkan peserta satu per satu atau impor banyak sekaligus dari file Excel."
      action={
        <div className="flex flex-wrap gap-2">
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
              <TableHead className="w-72 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada peserta.</TableCell></TableRow>}
            {paginatedItems.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                <TableCell className="font-medium">
                  <button type="button" onClick={()=>pilihUntukEdit(p)} className="text-left hover:underline hover:text-primary transition-colors">{p.nama}</button>
                  {(p as any).terlambat && <Badge variant="destructive" className="ml-2 align-middle">Terlambat</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.asal || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{scoredIds.has(p.id) ? sesiDari(p.nomor_urut) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.kategori || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button size="sm" variant={(p as any).terlambat ? "secondary" : "outline"} onClick={()=>toggleTerlambat(p)}>
                      {(p as any).terlambat ? "Batal Terlambat" : "Terlambat"}
                    </Button>
                    {isAdm && (
                      <Button size="sm" variant="outline" onClick={()=>bukaPenilaianUlang(p)}>Buka Perbaikan</Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={()=>hapus(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft className="size-4" /> Sebelumnya
          </Button>
          <div className="text-sm text-muted-foreground">
            Halaman {page + 1} dari {totalPages}
          </div>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
            Berikutnya <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

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

  async function ubahRole(id: string, role: AppRole) {
    try {
      const { setJuriRole } = await import("@/lib/juri-users.functions");
      await setJuriRole({ data: { juriId: id, role } });
      toast.success(`Role diubah menjadi ${ROLE_LABEL[role]}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah role");
    }
  }

  async function ubahAktifMenilai(id: string, aktif: boolean) {
    const { error } = await supabase.rpc("admin_set_juri_aktif" as any, { _juri: id, _aktif: aktif });
    if (error) return toast.error(error.message);
    toast.success(aktif ? "Juri diaktifkan untuk menilai" : "Juri dinonaktifkan dari penilaian (data tetap tersimpan)");
    load();
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
    <>
    <PendingPasswordResets />
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
                  <SelectItem value="inspektur_var">Inspektur VAR</SelectItem>
                  <SelectItem value="operator_vmix">Operator vMix</SelectItem>
                  <SelectItem value="viewer">Sekretariat</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground break-all">{j.email || "—"}</div>
            {j.approved && j.role === "juri" && (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                <span className="text-xs">Ikut menilai</span>
                <Switch checked={j.aktif_menilai !== false} onCheckedChange={(v)=>ubahAktifMenilai(j.id, v)} />
              </div>
            )}
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
              <TableHead>Ikut Menilai</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada pendaftar juri.</TableCell></TableRow>}
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
                      <SelectItem value="inspektur_var">Inspektur VAR</SelectItem>
                      <SelectItem value="operator_vmix">Operator vMix</SelectItem>
                  <SelectItem value="viewer">Sekretariat</SelectItem>
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
                <TableCell>
                  {j.approved && j.role === "juri" ? (
                    <div className="flex items-center gap-2">
                      <Switch checked={j.aktif_menilai !== false} onCheckedChange={(v)=>ubahAktifMenilai(j.id, v)} />
                      <span className="text-xs text-muted-foreground">{j.aktif_menilai !== false ? "Aktif" : "Nonaktif"}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
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
    </>
  );
}

function PendingPasswordResets() {
  const [items, setItems] = useState<Array<{ id: string; identifier: string; created_at: string; user_id: string | null }>>([]);
  const [pwInput, setPwInput] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.access_token) return;
      const { listPasswordResets } = await import("@/lib/password-reset.functions");
      const data = await listPasswordResets();
      setItems(data as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Unauthorized|401|authorization header/i.test(msg)) return;
      toast.error(msg || "Gagal memuat permintaan");
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  async function approve(id: string, ident: string) {
    if (loading) return;
    const newPassword = (pwInput[id] ?? "").trim();
    if (newPassword.length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter");
      return;
    }
    if (!confirm(`Terapkan kata sandi baru untuk "${ident}"?`)) return;
    setLoading(true);
    try {
      const { approvePasswordReset } = await import("@/lib/password-reset.functions");
      await approvePasswordReset({ data: { id, newPassword } });
      toast.success(`Kata sandi baru untuk "${ident}" telah diterapkan`);
      setPwInput((s) => { const n = { ...s }; delete n[id]; return n; });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyetujui");
    } finally {
      setLoading(false);
    }
  }

  async function reject(id: string, ident: string) {
    if (loading) return;
    if (!confirm(`Tolak permintaan reset kata sandi untuk "${ident}"?`)) return;
    setLoading(true);
    try {
      const { rejectPasswordReset } = await import("@/lib/password-reset.functions");
      await rejectPasswordReset({ data: { id } });
      toast.success("Permintaan ditolak");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menolak");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <SectionCard
      title="Permintaan Reset Kata Sandi"
      description="Tetapkan kata sandi baru untuk pemohon. Sampaikan sandi tersebut langsung kepada yang bersangkutan — kata sandi tidak disimpan di database."
    >
      <div className="grid gap-2">
        {items.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{r.identifier}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("id-ID")}
                {!r.user_id && <span className="ml-2 text-destructive">akun belum ditemukan</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <Input
                    type={showPw[r.id] ? "text" : "password"}
                    placeholder="Kata sandi baru (min. 8)"
                    className="pr-10 h-8 text-sm"
                    value={pwInput[r.id] ?? ""}
                    onChange={(e) => setPwInput((s) => ({ ...s, [r.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => ({ ...s, [r.id]: !s[r.id] }))}
                    className="absolute inset-y-0 right-0 grid place-items-center px-2 text-muted-foreground hover:text-foreground"
                    aria-label="Tampilkan/sembunyikan"
                  >
                    {showPw[r.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => approve(r.id, r.identifier)} disabled={loading || !r.user_id} className="gap-1">
                <Check className="size-4" />Setujui
              </Button>
              <Button size="sm" variant="outline" onClick={() => reject(r.id, r.identifier)} disabled={loading}>
                Tolak
              </Button>
            </div>
          </div>
        ))}
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
  "Interpretasi",
  "Penghayatan",
  "Artikulasi",
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
    const { data, error } = await supabase.from("kategori").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false });
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
      kategori: kriteriaPeserta,
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
        <div><Label>NIlai VAR / tidak Clear</Label><Input type="number" step="0.01" value={nilaiStandart} onChange={e=>setNilaiStandart(e.target.value)} placeholder="75" /></div>
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
              <TableHead className="text-center">NIlai VAR / tidak Clear</TableHead>
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

  async function simpanBobot(k: Kriteria) {
    const raw = edits[k.id];
    const val = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(val)) {
      setEdits(prev => ({ ...prev, [k.id]: String(Number(k.bobot)) }));
      return;
    }
    if (val === Number(k.bobot)) return;
    const { error } = await supabase.from("kriteria").update({ bobot: val }).eq("id", k.id);
    if (error) {
      setEdits(prev => ({ ...prev, [k.id]: String(Number(k.bobot)) }));
      return toast.error(error.message);
    }
    setItems(prev => prev.map(i => (i.id === k.id ? { ...i, bobot: val } : i)));
    toast.success(`Bobot ${k.nama} disimpan`);
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
        <div><Label>Bobot</Label><Input type="number" step="0.1" value={bobot} onChange={e=>setBobot(e.target.value)} placeholder="25" /></div>
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
                      onBlur={() => simpanBobot(k)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    />
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
              <TableCell colSpan={2}><Badge className="bg-accent text-accent-foreground">{totalBobot}</Badge></TableCell>
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

// Kriteria induk untuk setiap aspek Catatan Juri (urutan sama dengan CATATAN_ASPEK).
// Kontribusi aspek = lookup(grade aspek) x lookup(grade kriteria induk) x bobot aspek.
const CATATAN_INDUK: ("vokal" | "penghayatan" | "intonasi" | "penampilan")[] = [
  "vokal",        // Kesan dari teks bacaan
  "vokal",        // Penguasaan teks
  "penghayatan",  // Emosi
  "penghayatan",  // Ekspresi
  "penghayatan",  // Intonasi dan Irama
  "penghayatan",  // Kesesuaian Vokal
  "intonasi",     // Penggunaan kata dan kalimat sesuai teks bacaan
  "intonasi",     // Sesuai Tanda Baca
  "penampilan",   // Keserasian Penampilan
  "penampilan",   // Penguasaan Panggung
];
const INDUK_LABEL: Record<string, string> = {
  vokal: "Vokal / Interpretasi",
  penghayatan: "Penghayatan",
  intonasi: "Intonasi / Artikulasi",
  penampilan: "Penampilan",
};

// Jumlah aspek Catatan Juri di bawah setiap kriteria induk.
const CATATAN_INDUK_COUNT: Record<string, number> = {
  vokal: 2,
  penghayatan: 4,
  intonasi: 2,
  penampilan: 2,
};

// Bobot tetap tiap aspek catatan = (bobot induk / bobot catatan juri) / jumlah aspek dalam induk.
function bobotAspekCatatan(indukKey: string | null, bobotInduk: number, bobotCat: number): number {
  if (!indukKey) return 1;
  const n = CATATAN_INDUK_COUNT[indukKey] ?? 0;
  if (!n || !bobotCat) return 1;
  return (bobotInduk / bobotCat) / n;
}




const PERHATIAN_ASPEK = [
  "Clear Text",
  "Salah kata",
  "Menambah kata",
  "Mengurangi kata",
  "Mengulang kata",
];

/** True bila ada minimal satu ayat ditandai pada pertanyaan selain Clear Text. */
function adaPenandaanAyat(checks: boolean[][]): boolean {
  if (!Array.isArray(checks)) return false;
  return checks
    .slice(1)
    .some((row) => (Array.isArray(row) ? row.some(Boolean) : false));
}


function kriteriaKey(nama: string): keyof typeof GRADE_DESCRIPTIONS | "catatan" | "perhatian" | null {
  const n = nama.toLowerCase();
  if (n.includes("perhatian")) return "perhatian";
  if (n.includes("catatan")) return "catatan";
  if (n.includes("interpretasi") || n.includes("vokal") || n.includes("vocal")) return "vokal";
  if (n.includes("hayat")) return "penghayatan";
  if (n.includes("artikulasi") || n.includes("intonasi") || n.includes("pelafalan")) return "intonasi";
  if (n.includes("penampilan")) return "penampilan";
  return null;
}


/* PENILAIAN */
function CriteriaPillButton({
  label,
  active,
  disabled,
  onClick,
  subLabel,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  subLabel?: string | null;
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
      <div className="relative flex flex-col items-center justify-center gap-2">
        <span className="text-xl sm:text-2xl font-semibold tracking-wide">
          {label}
        </span>
        {subLabel ? (
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-sans font-semibold tracking-wide",
              active ? "bg-accent-foreground/15 text-accent-foreground" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {subLabel}
          </span>
        ) : (
          <span className="text-xs font-sans text-muted-foreground">Belum dinilai</span>
        )}
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
  const PERHATIAN_VAR_TRIGGER_IDX = new Set([0, 1, 2, 3, 4]);
  const [saving, setSaving] = useState(false);
  // Auto-scroll ke grade terpilih: dijalankan sekali per elemen, dibungkus try/catch
  // karena sebagian browser tablet (Samsung Internet lawas) tidak stabil dengan
  // scrollIntoView beropsi saat elemen baru dipasang.
  const sudahScrollRef = useRef<Element | null>(null);
  const scrollKePilihan = useCallback((el: HTMLButtonElement | null) => {
    if (!el || sudahScrollRef.current === el) return;
    sudahScrollRef.current = el;
    try {
      requestAnimationFrame(() => {
        try { el.scrollIntoView({ block: "center" }); } catch { /* abaikan */ }
      });
    } catch { /* abaikan */ }
  }, []);
  // Aturan #3 — nama juri otomatis dari user yang login (juri tidak bisa memilih juri lain)
  const [myJuriId, setMyJuriId] = useState<string>("");
  const [myJuriNama, setMyJuriNama] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  // Aturan #7 — kunci form setelah kirim, buka lagi setelah semua juri selesai
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);
  // Semua peserta yang PERNAH saya kirim (persist antar refresh) — mencegah kirim ulang
  const [mySubmittedIds, setMySubmittedIds] = useState<Set<string>>(new Set());
  // Peserta yang sudah saya kirim-ulang selama siklus Perbaikan Perhatian yang aktif.
  const [perbaikanResubmittedIds, setPerbaikanResubmittedIds] = useState<Set<string>>(new Set());
  const [judgesDoneForPeserta, setJudgesDoneForPeserta] = useState<number>(0);
  const [judgesTotalForPeserta, setJudgesTotalForPeserta] = useState<number>(0);
  const [nilaiJuriPreview, setNilaiJuriPreview] = useState<number | null>(null);
  const pollingInFlightRef = useRef(false);
  const resolvingCompletionRef = useRef<string | null>(null);
  // Waktu overlay mulai tampil — dipakai memastikan overlay tidak "berkedip"
  // bila juri saat ini kebetulan menjadi juri terakhir yang mengirim.
  const overlayShownAtRef = useRef<number | null>(null);
  const OVERLAY_MIN_MS = 1800;
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
    items: { pertanyaan: string; rows: { juriNama: string; ayat: number[]; teks?: string }[] }[];
  };
  const [perhatianDiscrepancy, setPerhatianDiscrepancy] = useState<PerhatianDiscrepancyReport | null>(null);

  // Masukan Juri per ayat — bukan bagian penilaian, hanya lampiran rincian nilai
  const [openMasukan, setOpenMasukan] = useState(false);
  
  const [masukanUmum, setMasukanUmum] = useState("");
  const [savingMasukan, setSavingMasukan] = useState(false);


  // Sesi aktif dari Panitia/Operator Lomba — juri tidak boleh memilih peserta/mazmur secara manual
  const [activeSession, setActiveSession] = useState<{ id: string; peserta_id: string; mazmur_id: string | null } | null>(null);
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
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
    const id = setInterval(poll, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  // Auto-terapkan sesi aktif untuk non-admin (juri): kunci peserta & mazmur mengikuti pilihan Operator
  useEffect(() => {
    if (!activeSession) return;
    if (isAdmin) return;
    if (editMode) return;
    // Jangan pindahkan peserta/mazmur selama overlay "menunggu" aktif —
    // biarkan form tetap terkunci pada peserta yang baru dikirim sampai semua juri selesai.
    if (submittedFor) return;
    setPesertaId(prev => prev === activeSession.peserta_id ? prev : activeSession.peserta_id);
    if (activeSession.mazmur_id) {
      setMazmurId(prev => prev === activeSession.mazmur_id ? prev : activeSession.mazmur_id!);
    }
  }, [activeSession, isAdmin, editMode, submittedFor]);
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
      if (typeof document !== "undefined" && document.hidden) return;
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
    const id = setInterval(poll, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  // Saat VAR sedang berjalan (perbaikan perhatian, klarifikasi VAR dibuka Inspektur,
  // atau perbaikan VAR manual), juri hanya boleh membuka kriteria Perhatian.
  const PERHATIAN_ONLY_STATUS = new Set(["perbaikan_perhatian", "klarifikasi_var", "musyawarah", "perbaikan_var_manual"]);
  const perbaikanPerhatianIds = new Set(varAktifList.filter(v => PERHATIAN_ONLY_STATUS.has(v.status)).map(v => v.peserta_id));
  // Setelah juri mengirim ulang nilai pada mode Perbaikan, kriteria Perhatian & Catatan Juri
  // disembunyikan/dikunci kembali sampai Inspektur membuka perbaikan berikutnya.
  const perbaikanAktifIds = new Set([...perbaikanPerhatianIds].filter(id => !perbaikanResubmittedIds.has(id)));
  useEffect(() => {
    // Saat siklus Perbaikan Perhatian selesai untuk suatu peserta,
    // bersihkan pula catatan "sudah kirim-ulang" agar siklus berikutnya bisa dibuka lagi.
    setPerbaikanResubmittedIds(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      prev.forEach(id => {
        if (!perbaikanPerhatianIds.has(id)) { next.delete(id); changed = true; }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varAktifList]);
  const KOMP_LABEL: Record<string, string> = {
    clear_text: "Clear Text",
    salah_kata: "Salah kata",
    menambah_kata: "Menambah kata",
    mengurangi_kata: "Mengurangi kata",
    mengulang_kata: "Mengulang kata",
  };

  // VAR manual — pending approval untuk juri
  type VarManualPending = { session_id: string; peserta_id: string; peserta_nama: string; nomor_urut: number; alasan: string; sudah_vote: boolean };
  const [varManualPending, setVarManualPending] = useState<VarManualPending[]>([]);
  const [varManualLoading, setVarManualLoading] = useState<string | null>(null);
  const varManualSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data, error } = await supabase.rpc("get_var_manual_pending" as any);
      if (stopped) return;
      if (error) { console.error("get_var_manual_pending", error.message); return; }
      const rows = ((data as any[]) ?? []) as VarManualPending[];
      setVarManualPending(rows);
      // Notifikasi saat ada pengajuan VAR baru yang belum Anda tanggapi
      const baru = rows.filter((r) => !r.sudah_vote && !varManualSeen.current.has(r.session_id));
      if (baru.length > 0) {
        baru.forEach((r) => {
          varManualSeen.current.add(r.session_id);
          toast.warning("⚠ Inspektur mengajukan VAR", {
            description: `Peserta No. ${r.nomor_urut} — ${r.peserta_nama}. Mohon berikan persetujuan Anda.`,
            duration: 10000,
          });
        });
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AC) {
            const ctx = new AC();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
          }
        } catch { /* abaikan */ }
      }
      const aktif = new Set(rows.map((r) => r.session_id));
      varManualSeen.current.forEach((id) => { if (!aktif.has(id)) varManualSeen.current.delete(id); });
    }
    poll();
    const id = setInterval(poll, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  async function voteVarManual(sessionId: string, setuju: boolean) {
    setVarManualLoading(sessionId);
    try {
      const { data, error } = await supabase.rpc("juri_vote_var" as any, { _session: sessionId, _setuju: setuju });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === "disetujui_juri") {
        toast.success("✦ VAR disetujui semua juri", { description: "Form penilaian dibuka kembali — silakan perbarui nilai dan kirim ulang." });
        setSubmittedFor(null);
        setMySubmittedIds(prev => {
          const next = new Set(prev);
          const target = varManualPending.find(v => v.session_id === sessionId);
          if (target) next.delete(target.peserta_id);
          return next;
        });
        loadAll({ restoreSubmissionState: false });
      } else if (status === "ditolak_juri") {
        toast.info("Pengajuan VAR ditolak", { description: "Salah satu juri menolak; nilai tetap sebagaimana adanya." });
      } else {
        toast.success(setuju ? "Persetujuan Anda tercatat" : "Penolakan Anda tercatat");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim suara");
    } finally {
      setVarManualLoading(null);
    }
  }







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
    const juriList = ((j.data ?? []) as unknown as Juri[]).filter(x => x.approved && x.role === "juri" && x.aktif_menilai !== false);
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
        let latestDone = submissionList.filter(x => x.peserta_id === latest.peserta_id).length;
        let latestTotal = totalJuri;
        const { data: latestProgress } = await supabase.rpc("get_submission_progress" as any, { _peserta: latest.peserta_id });
        const latestProgressRow = Array.isArray(latestProgress) ? latestProgress[0] : latestProgress;
        if (latestProgressRow) {
          latestDone = Number(latestProgressRow.done_count ?? latestDone);
          latestTotal = Number(latestProgressRow.total_count ?? latestTotal);
        }
        if (latestTotal > 0 && latestDone < latestTotal) {
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

  useEffect(() => {
    let cancelled = false;
    async function loadNilaiJuriPreview() {
      if (!juriId || !pesertaId || kriteria.length === 0) {
        setNilaiJuriPreview(null);
        return;
      }
      const complete = kriteria.every((k) =>
        penilaian.some((n) => n.juri_id === juriId && n.peserta_id === pesertaId && n.kriteria_id === k.id),
      );
      if (!complete) {
        setNilaiJuriPreview(null);
        return;
      }
      const { data, error } = await supabase.rpc("hitung_nilai_juri" as any, { _peserta: pesertaId, _juri: juriId });
      if (cancelled) return;
      setNilaiJuriPreview(error || data == null ? null : Number(data));
    }
    loadNilaiJuriPreview();
    return () => { cancelled = true; };
  }, [juriId, pesertaId, kriteria, penilaian]);

  // Aturan #7 — polling jumlah juri yang sudah menilai peserta terkunci
  useEffect(() => {
    if (!submittedFor) { overlayShownAtRef.current = null; setJudgesTotalForPeserta(0); return; }
    if (overlayShownAtRef.current == null) overlayShownAtRef.current = Date.now();
    const lockedPesertaId = submittedFor;
    resolvingCompletionRef.current = null;
    let stopped = false;
    async function ensureMinDisplay() {
      const start = overlayShownAtRef.current ?? Date.now();
      const wait = OVERLAY_MIN_MS - (Date.now() - start);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
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
          setJudgesTotalForPeserta(0);
          return;
        }
      }
      // Operator sudah menutup sesi peserta ini (atau membuka sesi peserta lain).
      // Jangan biarkan juri terjebak di overlay "Menunggu Juri Lain".
      {
        const { data: sesiRow } = await supabase
          .from("sesi_penilaian")
          .select("status")
          .eq("peserta_id", lockedPesertaId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sesiRow && sesiRow.status !== "active") {
          stopped = true;
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setPesertaId("");
          setMazmurId("");
          setOpenKriteria(null);
          setJudgesDoneForPeserta(0);
          setJudgesTotalForPeserta(0);
          loadAll({ restoreSubmissionState: false });
          return;
        }
      }
      // Sumber kebenaran: RPC backend agar semua device membaca progres yang sama,
      // tidak bergantung cache/list juri di browser.
      const { data: progressRows, error: progressError } = await supabase.rpc("get_submission_progress" as any, { _peserta: lockedPesertaId });
      if (stopped) return;
      if (progressError) {
        console.error("submission progress", progressError);
        return;
      }
      const progressRow = Array.isArray(progressRows) ? progressRows[0] : progressRows;
      const done = Number(progressRow?.done_count ?? 0);
      const totalRequired = Number(progressRow?.total_count ?? totalJuriApproved);
      setJudgesDoneForPeserta(done);
      setJudgesTotalForPeserta(totalRequired);

      // Deteksi perbedaan input SELAMA menunggu (peserta/mazmur berbeda antar juri)
      const pending = await checkPendingDiscrepancy(lockedPesertaId);
      if (!stopped) setPendingDiscrepancy(pending);

      if (totalRequired > 0 && done >= totalRequired) {
        const resolutionKey = `${lockedPesertaId}:${done}:${totalRequired}`;
        if (resolvingCompletionRef.current === resolutionKey) return;
        resolvingCompletionRef.current = resolutionKey;

        // Urutan pemeriksaan:
        // 1) Semua juri sudah klik Kirim (terpenuhi di sini).
        // 2) Perbedaan pilihan Peserta / Bacaan Mazmur.
        const report = await checkDiscrepancy(lockedPesertaId);
        if (report) {
          stopped = true;
          await ensureMinDisplay();
          setDiscrepancy(report);
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setJudgesDoneForPeserta(0);
          setJudgesTotalForPeserta(0);
          return;
        }
        // 3) Perbedaan parameter di form Perhatian (Q2, Q4, Q5).
        const perhatianReport = await checkPerhatianDiscrepancy(lockedPesertaId);
        if (perhatianReport) {
          stopped = true;
          await ensureMinDisplay();
          setPerhatianDiscrepancy(perhatianReport);
          setSubmittedFor(current => current === lockedPesertaId ? null : current);
          setPendingDiscrepancy(null);
          setJudgesDoneForPeserta(0);
          setJudgesTotalForPeserta(0);
          return;
        }
        stopped = true;
        await ensureMinDisplay();
        toast.success("✦ Semua juri sudah menilai", {
          description: "Silahkan melakukan penilaian peserta selanjutnya.",
        });
        setSubmittedFor(current => current === lockedPesertaId ? null : current);
        setPendingDiscrepancy(null);
        setPesertaId("");
        setMazmurId("");
        setOpenKriteria(null);
        setJudgesDoneForPeserta(0);
        setJudgesTotalForPeserta(0);
        loadAll({ restoreSubmissionState: false });
      }
      } finally {
        pollingInFlightRef.current = false;
      }
    }
    tick();
    const id = setInterval(tick, 12000);
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


  // Pemeriksaan #3 — Perbedaan pilihan pada form Perhatian, khusus 3 pemicu VAR.
  // Aspek pada detail = PERHATIAN_ASPEK.slice(1) → [Salah kata, Menambah kata, Mengurangi kata]
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
      { idx: 0, label: "Salah kata" },
      { idx: 1, label: "Menambah kata" },
      { idx: 2, label: "Mengurangi kata" },
    ];
    const items: PerhatianDiscrepancyReport["items"] = [];

    // Parameter wajib sama: Clear Text
    {
      const perJuriCT: { juriNama: string; ayat: number[]; teks: string }[] = [];
      for (const r of rows as any[]) {
        const d = r.detail;
        if (!d || d.type !== "perhatian") continue;
        const val = d.clearText ?? d.membacaPerikop ?? null;
        perJuriCT.push({
          juriNama: juriMap.get(r.juri_id) ?? "—",
          ayat: [],
          teks: val === true ? "Ya" : val === false ? "Tidak" : "—",
        });
      }
      const sigCT = new Set(perJuriCT.map(x => x.teks));
      if (sigCT.size > 1) items.push({ pertanyaan: "Clear Text", rows: perJuriCT });
    }

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

  function currentDetail(kId: string): any {
    if (!juriId || !pesertaId) return null;
    const row = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === kId);
    return (row?.detail as any) ?? null;
  }

  function gradeLabel(grade: number): string {
    return Number.isInteger(grade) ? `Grade ${grade}` : `Grade ${Math.floor(grade)}½`;
  }

  // Ringkasan pilihan juri yang tampil di tombol kriteria (agar terlihat saat
  // penilaian dibuka kembali sebelum dikirim).
  function ringkasanPilihan(k: Kriteria): string | null {
    const val = currentNilai(k.id);
    if (val === null) return null;
    const key = kriteriaKey(k.nama);
    const d = currentDetail(k.id);
    if (key === "catatan") {
      const terisi = Array.isArray(d?.aspek)
        ? d.aspek.filter((a: any) => a && !a.skipped && Number(a.nilai) > 0).length
        : 0;
      return terisi > 0 ? `${terisi} aspek terisi` : "Tidak ada aspek diisi";
    }
    if (key === "perhatian") {
      const v = d?.clearText ?? d?.membacaPerikop;
      if (v === true) return "Clear Text: Ya";
      if (v === false) return "Clear Text: Tidak";
      return "Sudah diisi";
    }
    const g = Number(d?.grade);
    if (Number.isFinite(g) && g > 0) return gradeLabel(g);
    return gradeLabel(val / 20);
  }



  // Catatan Juri selalu opsional, terlepas dari jawaban Clear Text.
  const clearTextSaya: boolean | null = (() => {
    if (!juriId || !pesertaId) return null;
    const kPerhatian = kriteria.find(k => kriteriaKey(k.nama) === "perhatian");
    if (!kPerhatian) return null;
    const row = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === kPerhatian.id);
    const d: any = row?.detail ?? null;
    if (!d || d.type !== "perhatian") return null;
    const v = d.clearText ?? d.membacaPerikop;
    return v === true || v === false ? Boolean(v) : null;
  })();




  function openDialog(k: Kriteria) {
    if (editMode) return toast.warning("Mode perubahan aktif — hanya Peserta & Bacaan Mazmur yang dapat diubah.");
    if (!juriId) return toast.error("Pilih juri terlebih dahulu");
    if (!pesertaId) return toast.error("Pilih peserta terlebih dahulu");
    const key = kriteriaKey(k.nama);
    if (pesertaId && mySubmittedIds.has(pesertaId) && !perbaikanAktifIds.has(pesertaId)) {
      return toast.warning("Penilaian sudah dikirim — nilai tidak dapat diubah lagi.");
    }
    if (pesertaId && perbaikanAktifIds.has(pesertaId) && key !== "perhatian" && key !== "catatan" && currentNilai(k.id) !== null) {
      return toast.warning("Mode Perbaikan aktif — hanya kriteria Perhatian dan Catatan Juri yang dapat diubah.");
    }
    if (key === "catatan") {
      // Tampilkan kembali pilihan terakhir juri agar dapat diubah (mis. saat mode Perbaikan).
      const prevRow = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === k.id);
      const prevDetail: any = prevRow?.detail ?? null;
      if (prevDetail && prevDetail.type === "catatan" && Array.isArray(prevDetail.aspek)) {
        setCatatanValues(CATATAN_ASPEK.map((_, i) => {
          const a = prevDetail.aspek[i];
          if (!a || a.skipped) return null;
          const v = Number(a.nilai);
          return Number.isFinite(v) && v > 0 ? v : null;
        }));
      } else {
        setCatatanValues(CATATAN_ASPEK.map(() => null));
      }
      setCatatanClearText(null);
    }
    if (key === "perhatian") {
      if (!selectedMazmur) return toast.error("Pilih bacaan mazmur terlebih dahulu");
      const isPerbaikan = !!(pesertaId && perbaikanAktifIds.has(pesertaId));
      const prevRow = penilaian.find(x => x.juri_id === juriId && x.peserta_id === pesertaId && x.kriteria_id === k.id);
      const prevDetail: any = prevRow?.detail ?? null;
      // Selalu tampilkan pilihan terakhir juri bila baris penilaian sebelumnya masih ada
      // (mis. saat Potensi VAR / Perbaikan Perhatian) — bukan hanya di mode perbaikan Inspektur.
      if (prevDetail && prevDetail.type === "perhatian") {
        const restored: boolean[][] = PERHATIAN_ASPEK.map((_, i) => {
          if (i === 0) {
            const v = prevDetail.clearText ?? prevDetail.membacaPerikop;
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

  async function openMasukanDialog() {
    if (!juriId) return toast.error("Pilih juri terlebih dahulu");
    if (!pesertaId) return toast.error("Pilih peserta terlebih dahulu");
    if (!selectedMazmur) return toast.error("Pilih bacaan mazmur terlebih dahulu");
    const { data } = await supabase
      .from("masukan_juri" as any)
      .select("catatan")
      .eq("peserta_id", pesertaId)
      .eq("juri_id", juriId)
      .maybeSingle();
    const existing = ((data as any)?.catatan ?? []) as { ayat: number; teks: string }[];
    setMasukanUmum(String(existing.find((e) => e && e.ayat === 0)?.teks ?? ""));
    setOpenMasukan(true);
  }

  async function saveMasukan() {
    if (!juriId || !pesertaId || !selectedMazmur) { setOpenMasukan(false); return; }
    setSavingMasukan(true);
    const umum = (masukanUmum || "").trim();
    const catatan = umum ? [{ ayat: 0, teks: umum }] : [];
    const { error } = await supabase
      .from("masukan_juri" as any)
      .upsert(
        {
          peserta_id: pesertaId,
          juri_id: juriId,
          mazmur_id: mazmurId || null,
          catatan,
        } as any,
        { onConflict: "peserta_id,juri_id" }
      );
    setSavingMasukan(false);
    if (error) { toast.error(error.message); return; }
    toast.success("✦ Masukan juri tersimpan", {
      description: umum ? "Catatan umum tersimpan." : "Catatan dikosongkan.",
    });
    setOpenMasukan(false);
  }





  async function saveNilai(nilai: number, detail: PenilaianDetail = null) {
    if (!openKriteria) return;
    const namaKriteria = openKriteria.nama;
    setSaving(true);
    try {
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
      if (error) {
        toast.error(`Gagal menyimpan: ${error.message}. Coba lagi.`);
        return;
      }
      toast.success(`Nilai ${namaKriteria} disimpan`);
      setOpenKriteria(null);
      setCatatanValues(CATATAN_ASPEK.map(() => null));
      setCatatanClearText(null);
      // Bentuk state harus sama dengan nilai awal (satu baris per pertanyaan),
      // agar render berikutnya tidak bertemu bentuk data tak terduga.
      setPerhatianChecks(PERHATIAN_ASPEK.map(() => []));
    } catch (err) {
      // Kegagalan jaringan / penyimpanan browser tidak boleh menjatuhkan halaman.
      console.error(err);
      toast.error(
        err instanceof Error
          ? `Gagal menyimpan: ${err.message}. Coba lagi.`
          : "Gagal menyimpan. Periksa koneksi lalu coba lagi."
      );
      return;
    } finally {
      setSaving(false);
    }

    // Muat ulang terpisah & tahan-error: kegagalan di sini tidak membatalkan
    // penyimpanan yang sudah berhasil.
    try {
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("Nilai tersimpan, tetapi gagal memuat ulang data. Tarik untuk menyegarkan.");
    }
  }


  async function saveCatatan() {
    // Catatan Juri selalu opsional — juri boleh mengisi sebagian aspek saja.
    const skippedFlags = catatanValues.map(v => v === null || v === undefined);


    const contributions: number[] = [];
    catatanValues.forEach((v, i) => {
      if (!skippedFlags[i] && v !== null && v !== undefined) contributions.push(v);
    });
    const avg = contributions.length === 0 ? 0 : contributions.reduce((a, b) => a + b, 0) / contributions.length;
    const nilai = Math.round(avg * 20 * 100) / 100; // scale 1-5 → 20-100
    const detail: PenilaianDetail = {
      type: "catatan",
      aspek: CATATAN_ASPEK.map((nama, i) => ({
        nama,
        nilai: skippedFlags[i] ? 0 : (catatanValues[i] as number),
        skipped: skippedFlags[i],
      })),
    };
    await saveNilai(nilai, detail);
  }

  // Penandaan ayat kini hanya informasi lokasi kesalahan — tidak mempengaruhi nilai.
  const perhatianAdaTanda = adaPenandaanAyat(perhatianChecks);

  async function savePerhatian() {
    // Guard: bila mode Perbaikan Perhatian aktif, paksa baris non-pemicu kembali ke baseline saat dialog dibuka.
    const perbaikanAktifNow = !!(pesertaId && perbaikanAktifIds.has(pesertaId));
    const baseline = perhatianBaselineRef.current;
    const effective = (perbaikanAktifNow && baseline)
      ? perhatianChecks.map((row, i) => PERHATIAN_VAR_TRIGGER_IDX.has(i) ? row : (baseline[i] ? [...baseline[i]] : row))
      : perhatianChecks;
    // Ada penandaan ayat → status otomatis "tidak clear".
    const adaTanda = adaPenandaanAyat(effective);
    const clearText = adaTanda ? false : ((effective[0]?.[0] as unknown as boolean) ?? null);
    // Wajibkan jawaban "Clear Text" (Ya/Tidak) bila tidak ada penandaan.
    if (clearText === null) {
      return toast.warning("Pilih jawaban untuk 'Clear Text' terlebih dahulu.");
    }
    const detail: PenilaianDetail = {
      type: "perhatian",
      clearText,
      aspek: PERHATIAN_ASPEK.slice(1).map((nama, idx) => {
        const row = effective[idx + 1] ?? [];
        const ditandai: number[] = [];
        row.forEach((c, ai) => { if (c) ditandai.push(ai + 1); });
        return { nama, ayat: row, ditandai };
      }),
    };
    // Nilai kriteria Perhatian hanya informatif (tanpa penalti).
    await saveNilai(0, detail);
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
          {/* Overlay "menunggu juri lain" — aktif setelah juri klik Kirim, nonaktif ketika semua juri selesai. */}
          {submittedFor && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-background/85 backdrop-blur-sm">
              <div className="max-w-md mx-4 rounded-2xl border-2 border-accent/50 bg-card p-6 text-center shadow-xl">
                <div className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Penilaian Terkirim</div>
                <div className="font-serif text-2xl mt-2">Menunggu Juri Lain</div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Nilai Anda untuk peserta ini sudah tersimpan. Form akan terbuka kembali setelah semua juri menyelesaikan penilaian.
                </div>
                <div className="mt-4 font-serif text-3xl font-bold text-primary tabular-nums">
                  {judgesDoneForPeserta} / {judgesTotalForPeserta || totalJuriApproved}
                </div>
                <div className="text-xs text-muted-foreground mt-1">juri telah mengirim penilaian</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSubmittedFor(null);
                    setPendingDiscrepancy(null);
                    setPesertaId("");
                    setMazmurId("");
                    setOpenKriteria(null);
                    setJudgesDoneForPeserta(0);
                    setJudgesTotalForPeserta(0);
                    loadAll({ restoreSubmissionState: false });
                  }}
                >
                  Buka Form Penilaian
                </Button>
              </div>
            </div>
          )}


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

          {juriId && pesertaId && (
            <div className="mb-4">
              <PratinjauPita
                pesertaId={pesertaId}
                juriId={juriId}
                refreshKey={penilaian
                  .filter(x => x.juri_id === juriId && x.peserta_id === pesertaId)
                  .map(x => `${x.kriteria_id}:${x.nilai}:${JSON.stringify(x.detail ?? null)}`)
                  .sort()
                  .join("|")}
              />
            </div>
          )}





          {/* Nilai Akhir juri ini (muncul saat seluruh kriteria terisi) */}
          {nilaiJuriPreview !== null && (
            <div className="mb-6 rounded-xl border-2 border-accent/50 bg-gradient-to-br from-accent/10 via-card to-primary/5 p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Nilai Akhir Anda</div>
                <div className="text-xs text-muted-foreground mt-0.5">Perhitungan otomatis dari seluruh kriteria yang telah Anda nilai.</div>
              </div>
              <div className="font-serif text-4xl font-bold text-primary tabular-nums">
                {nilaiJuriPreview.toFixed(3)}
              </div>
            </div>
          )}


          {(() => {
            const perbaikanAktifNow = !!pesertaId && perbaikanAktifIds.has(pesertaId);
            // Setelah juri menekan Kirim untuk peserta ini, pilihan kriteria disembunyikan
            // agar nilai tidak bisa diubah. Terbuka lagi saat peserta berikutnya dimulai,
            // atau saat VAR dari Inspektur disetujui (mode perbaikan aktif).
            const terkunciSetelahKirim = !!pesertaId && mySubmittedIds.has(pesertaId) && !perbaikanAktifNow;
            if (terkunciSetelahKirim) {
              return (
                <div className="mb-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-center">
                  <div className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">Penilaian Terkunci</div>
                  <div className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
                    Anda sudah mengirim penilaian untuk peserta ini, sehingga nilai tidak dapat diubah lagi.
                    Pilihan kriteria akan aktif kembali saat penilaian peserta berikutnya dimulai, atau bila
                    Inspektur mengajukan VAR dan disetujui para juri.
                  </div>
                </div>
              );
            }
            return (
              <>
                <div className="mb-2">
                  <Label className="text-base">Pilih Kriteria</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8 pb-4">
                  {kriteria.map(k => {
                    const val = currentNilai(k.id);
                    const key = kriteriaKey(k.nama);
                    // Kriteria yang belum pernah dinilai tetap dapat diisi agar juri bisa
                    // melengkapi penilaian dan menekan Kirim, meski mode Perbaikan aktif.
                    const isDisabled = perbaikanAktifNow && key !== "perhatian" && key !== "catatan" && val !== null;
                    return (
                      <div key={k.id} className="relative">
                        <CriteriaPillButton
                          label={k.nama}
                          active={val !== null}
                          subLabel={ringkasanPilihan(k)}
                          disabled={isDisabled}
                          onClick={() => openDialog(k)}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}


          {/* Masukan Juri — di luar penilaian, hanya lampiran rincian */}
          {juriId && pesertaId && selectedMazmur && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-serif text-base font-semibold">Masukan Juri</div>
                <div className="text-xs text-muted-foreground max-w-xl">
                  Satu catatan umum untuk peserta. Tidak masuk perhitungan nilai — hanya
                  menjadi lampiran pada rincian nilai peserta.
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={openMasukanDialog}
                disabled={savingMasukan}
              >
                <FileText className="size-4" />
                Isi Masukan
              </Button>
            </div>
          )}



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
            const nilaiAkhir = allDone ? nilaiJuriPreview : null;

            function requestKirim() {
              if (!juriId || !pesertaId) return toast.error("Pilih juri dan peserta");
              // Tidak boleh ada item kriteria yang kosong — berlaku juga saat mode Perbaikan/Edit.
              if (!allDone) {
                const kosong = kriteria.filter(k => currentNilai(k.id) === null).map(k => k.nama);
                return toast.warning("Masih ada item penilaian yang kosong", {
                  description: `Lengkapi terlebih dahulu: ${kosong.join(", ")}.`,
                });
              }
              if (editMode && !mazmurId) return toast.error("Pilih bacaan mazmur");
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
                setPerbaikanResubmittedIds(prev => new Set(prev).add(pesertaId));
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

            // Hanya tampilkan VAR untuk peserta yang sedang dinilai (sesi berlangsung).
            const fokusPesertaId = activeSession?.peserta_id ?? pesertaId ?? "";
            const varFokus = fokusPesertaId ? varAktifList.filter(v => v.peserta_id === fokusPesertaId) : [];
            const perbaikanRows = varFokus.filter(v => v.status === "perbaikan_perhatian");
            const varRows = varFokus.filter(v => v.status !== "perbaikan_perhatian");
            return (
              <>
                {varRows.length > 0 && (
                  <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-500/10 p-4 mb-4 animate-pulse">
                    <div className="flex items-center gap-2 font-serif text-lg text-rose-700">
                      <AlertTriangle className="size-5" /> ⚠ POTENSI VAR — Menunggu Keputusan Inspektur
                    </div>
                    <ul className="mt-2 space-y-3 text-sm text-rose-900">
                      {varRows.map((v) => (
                        <li key={v.peserta_id}>
                          <b>{v.peserta_nama || "—"}</b> · Perbedaan pada:{" "}
                          <span className="font-semibold">
                            {v.komponen.map((k) => KOMP_LABEL[k] ?? k).join(", ") || "—"}
                          </span>
                          <VarPersepsiDetail pesertaId={v.peserta_id} tone="rose" />
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
                    <ul className="mt-2 space-y-3 text-sm text-amber-900">
                      {perbaikanRows.map((v) => (
                        <li key={v.peserta_id}>
                          <b>{v.peserta_nama || "—"}</b> — silakan buka kembali kriteria <b>Perhatian</b>, samakan jawaban Anda dengan juri lain, lalu klik <b>Kirim</b>.
                          <VarPersepsiDetail pesertaId={v.peserta_id} tone="amber" />
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
                          {nilaiAkhir.toFixed(3)}
                        </div>
                      </div>
                    )}
                    <Button
                      size="lg"
                      onClick={requestKirim}
                      disabled={(() => {
                        if (saving) return true;
                        if (!allDone) return true;
                        if (editMode) return false;
                        if (!pesertaId) return false;
                        const inPerbaikan = perbaikanPerhatianIds.has(pesertaId);
                        if (inPerbaikan) return perbaikanResubmittedIds.has(pesertaId);
                        return mySubmittedIds.has(pesertaId);
                      })()}
                      className="gap-2 min-w-[160px]"
                    >
                      <Check className="size-4" />
                      {(() => {
                        if (editMode) return "Kirim Perubahan";
                        if (!pesertaId) return "Kirim";
                        const inPerbaikan = perbaikanPerhatianIds.has(pesertaId);
                        if (inPerbaikan) return perbaikanResubmittedIds.has(pesertaId) ? "Sudah Dikirim" : "Kirim";
                        return mySubmittedIds.has(pesertaId) ? "Sudah Dikirim" : "Kirim";
                      })()}
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
                            Nilai akhir yang akan dikirim: <b>{nilaiAkhir.toFixed(3)}</b>.
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

      {/* Dialog Masukan Juri */}
      <Dialog
        open={openMasukan}
        onOpenChange={(v) => {
          if (savingMasukan) return;
          if (!v) { saveMasukan(); return; }
        }}
      >
        <DialogContent
          className="max-w-2xl w-[95vw] max-h-[90dvh] p-4 sm:p-6 flex flex-col overflow-hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Masukan Juri</DialogTitle>
            <DialogDescription>
              Tulis satu catatan umum untuk peserta ini. Kosongkan bila tidak ada catatan.
              Perubahan disimpan otomatis saat dialog ditutup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
            {/* Hasil penilaian semua juri untuk peserta ini (tidak memengaruhi masukan) */}
            {(() => {
              const rows = juri
                .map((j) => {
                  const nilai = kriteria.map((k) => {
                    const r = penilaian.find(
                      (x) => x.juri_id === j.id && x.peserta_id === pesertaId && x.kriteria_id === k.id
                    );
                    return { kriteria: k.nama, nilai: r ? Number(r.nilai) : null };
                  });
                  return { juri: j, nilai, ada: nilai.some((n) => n.nilai !== null) };
                })
                .filter((r) => r.ada);
              if (rows.length === 0) return null;
              return (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <Label className="text-sm font-semibold mb-2 block">Hasil Penilaian Semua Juri</Label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-2 font-medium">Juri</th>
                          {kriteria.map((k) => (
                            <th key={k.id} className="py-1 px-2 font-medium whitespace-nowrap">{k.nama}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.juri.id} className="border-t">
                            <td className="py-1 pr-2 font-medium whitespace-nowrap">{r.juri.nama}</td>
                            {r.nilai.map((n, i) => (
                              <td key={i} className="py-1 px-2 tabular-nums">{n.nilai ?? "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Hanya referensi — masukan pada form ini tidak masuk perhitungan nilai.
                  </p>
                </div>
              );
            })()}
            <div className="rounded-lg border-2 border-accent/40 bg-accent/5 p-3">
              <Label className="text-sm font-semibold mb-2 block">Catatan Umum</Label>
              <Textarea
                value={masukanUmum}
                rows={6}
                placeholder="Tulis catatan umum untuk peserta ini (opsional)…"
                onChange={(e) => setMasukanUmum(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Berlaku untuk keseluruhan bacaan peserta ini.
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMasukan(false)} disabled={savingMasukan}>
              Batal
            </Button>
            <Button onClick={saveMasukan} disabled={savingMasukan} className="gap-1">
              <Check className="size-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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
                        {r.teks ? r.teks : r.ayat.length ? `Ayat: ${r.ayat.join(", ")}` : "—"}
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
            <DialogTitle className="font-serif text-2xl flex flex-wrap items-center gap-2">
              {openKriteria?.nama}
              {openKriteria && activeKey && activeKey !== "catatan" && activeKey !== "perhatian" && currentNilai(openKriteria.id) !== null && (
                <span className="rounded-full bg-accent px-3 py-1 font-sans text-xs font-semibold text-accent-foreground">
                  Pilihan saat ini: {ringkasanPilihan(openKriteria)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeKey === "catatan"
                ? "Pengisian bersifat opsional. Beri nilai 1–5 pada aspek yang ingin dinilai."


                : activeKey === "perhatian"
                ? "Centang setiap ayat yang mengalami masalah pada aspek terkait."
                : "Pilih grade yang paling sesuai dengan penampilan peserta."}
            </DialogDescription>

          </DialogHeader>

          {activeKey && activeKey !== "catatan" && activeKey !== "perhatian" && (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {(() => {
                // Kriteria baru yang belum punya deskripsi grade tidak boleh
                // menjatuhkan panel — pakai label generik sebagai cadangan.
                const descs = GRADE_DESCRIPTIONS[activeKey] ?? [
                  "Sangat kurang.", "Kurang.", "Cukup.", "Baik.", "Sangat baik.",
                ];
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
                const nilaiTersimpan = openKriteria ? currentNilai(openKriteria.id) : null;
                const detailTersimpan = openKriteria ? currentDetail(openKriteria.id) : null;
                const gradeTersimpan = (() => {
                  const g = Number(detailTersimpan?.grade);
                  if (Number.isFinite(g) && g > 0) return g;
                  return nilaiTersimpan !== null ? nilaiTersimpan / 20 : null;
                })();
                return items.map(({ grade, label, desc }) => {
                  const dipilih = gradeTersimpan !== null && Math.abs(gradeTersimpan - grade) < 1e-6;
                  return (
                  <button
                    key={grade}
                    type="button"
                    disabled={saving}
                    ref={dipilih ? scrollKePilihan : undefined}
                    onClick={() => saveNilai(grade * 20, { type: "grade", grade, label, desc })}
                    className={[
                      "flex items-start gap-4 text-left rounded-xl border-2 p-4 transition disabled:opacity-60",
                      dipilih
                        ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                        : "border-primary/20 bg-card hover:border-accent hover:bg-accent/5",
                    ].join(" ")}
                  >
                    <div className="grid place-items-center size-12 shrink-0 rounded-full bg-primary text-primary-foreground font-serif text-lg font-bold shadow">
                      {Number.isInteger(grade) ? grade : `${Math.floor(grade)}½`}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{label}</div>
                      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                    </div>
                    {dipilih && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                        <Check className="size-3.5" /> Pilihan Anda
                      </span>
                    )}
                  </button>
                  );
                });
              })()}
            </div>
          )}

          {activeKey === "catatan" && (() => {
            const terisi = catatanValues.filter(v => v != null).length;


            return (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={catatanValues.every(v => v == null)}
                  onClick={() => setCatatanValues(CATATAN_ASPEK.map(() => null))}
                >
                  <RotateCcw className="size-3.5" /> Reset Pilihan
                </Button>
              </div>
              {CATATAN_ASPEK.map((aspek, i) => {
                return (

                <div key={aspek} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{i + 1}. {aspek}</span>
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                      Opsional
                    </span>
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
                );
              })}
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Semua aspek bersifat opsional — isi hanya yang perlu. Terisi <b>{terisi}</b> aspek.
              </div>


              <p className="text-xs text-muted-foreground pt-2">
                Perubahan disimpan otomatis saat dialog ditutup.
              </p>

            </div>
            );
          })()}

          {activeKey === "perhatian" && (() => {
            const perbaikanAktifDlg = !!(pesertaId && perbaikanAktifIds.has(pesertaId));
            const VAR_TRIGGER_IDX = PERHATIAN_VAR_TRIGGER_IDX;
            const adaTandaDlg = perhatianAdaTanda;
            return (
            <div className="grid gap-3 py-2 flex-1 min-h-0 overflow-y-auto pr-2">
              {perbaikanAktifDlg && (
                <div className="rounded-lg border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="size-4" /> Mode Perbaikan Perhatian
                  </div>
                  <div className="text-amber-800 dark:text-amber-200/90 mt-1">
                    Anda dapat memperbaiki jawaban <b>Clear Text</b> beserta penandaan ayat pada empat pertanyaan di bawah.
                  </div>
                </div>
              )}
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Penandaan ayat hanya <b>informasi lokasi kesalahan</b> dan <b>tidak mengurangi nilai</b>. Bila ada minimal satu ayat ditandai, status <b>Clear Text otomatis menjadi &quot;Tidak&quot;</b>. Potensi VAR hanya muncul bila jawaban Clear Text antar juri berbeda.
              </div>
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
                      {i === 0 ? (
                        <span className="text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground px-2 py-0.5">
                          ⚠ Pemicu VAR
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          Informasi saja
                        </span>
                      )}
                      {locked && (
                        <span className="text-[10px] font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          Terkunci
                        </span>
                      )}
                    </div>
                    {i === 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Ya", val: true },
                            { label: "Tidak", val: false },
                          ].map(opt => {
                            const active = adaTandaDlg ? opt.val === false : row[0] === opt.val;
                            const optDisabled = locked || (adaTandaDlg && opt.val === true);
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                disabled={optDisabled}
                                onClick={() => {
                                  if (optDisabled) return;
                                  setPerhatianChecks(prev => prev.map((r, idx) => idx === 0 ? [opt.val] : r));
                                }}
                                className={[
                                  "rounded-md border-2 py-2 text-sm font-semibold transition",
                                  active
                                    ? (opt.val
                                        ? "border-accent bg-accent text-accent-foreground"
                                        : "border-destructive bg-destructive text-destructive-foreground")
                                    : "border-primary/20 bg-background hover:border-accent/60",
                                  optDisabled ? "cursor-not-allowed opacity-70 hover:border-primary/20" : "",
                                ].join(" ")}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        {adaTandaDlg && (
                          <p className="text-xs text-destructive mt-2">
                            Otomatis <b>Tidak clear</b> karena ada penandaan kesalahan pada ayat. Hapus semua penandaan untuk memilih kembali.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className={["grid grid-cols-5 sm:grid-cols-8 gap-2", locked ? "pointer-events-none" : ""].join(" ")}>
                        {row.map((checked, ayatIdx) => (
                          <button
                            key={ayatIdx}
                            type="button"
                            disabled={locked}
                            onClick={(e) => {
                              e.preventDefault();
                              (e.currentTarget as HTMLButtonElement).blur();
                              if (locked) return;
                              setPerhatianChecks(prev =>
                                prev.map((r, idx) =>
                                  idx === i ? r.map((c, ai) => (ai === ayatIdx ? !c : c)) : r
                                )
                              );
                            }}
                            className={[
                              "select-none rounded-md border-2 px-2 py-1.5 text-xs font-semibold text-center leading-tight transition",
                              checked
                                ? "border-destructive bg-destructive text-destructive-foreground"
                                : "border-primary/20 bg-background",
                              locked ? "cursor-not-allowed" : "cursor-pointer hover:border-accent/60",
                            ].join(" ")}
                          >
                            Ayat {ayatIdx + 1}
                          </button>
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
              Kriteria ini belum memiliki panduan grade khusus. Tutup dialog dan gunakan kriteria standar (Interpretasi, Penghayatan, Artikulasi, Penampilan, atau Catatan Juri).
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Persetujuan VAR Manual dari Inspektur */}
      <Dialog open={varManualPending.some((v) => !v.sudah_vote)} onOpenChange={() => { /* modal — tidak bisa ditutup manual */ }}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="size-5 text-rose-600" /> Permintaan Persetujuan VAR
            </DialogTitle>
            <DialogDescription>
              Inspektur mengajukan VAR. Persetujuan Anda dibutuhkan sebelum penilaian dibuka kembali.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {varManualPending.filter((v) => !v.sudah_vote).map((v) => (
              <div key={v.session_id} className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Peserta No. {v.nomor_urut}</div>
                  <div className="text-base font-semibold text-foreground">{v.peserta_nama}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Alasan Inspektur</div>
                  <div className="text-sm bg-background rounded p-2 border">{v.alasan || <span className="italic text-muted-foreground">—</span>}</div>
                </div>
                {v.sudah_vote ? (
                  <div className="text-xs text-emerald-700 italic">✓ Suara Anda sudah tercatat — menunggu juri lain.</div>
                ) : (
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={varManualLoading === v.session_id}
                      onClick={() => voteVarManual(v.session_id, false)}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                      disabled={varManualLoading === v.session_id}
                      onClick={() => voteVarManual(v.session_id, true)}
                    >
                      {varManualLoading === v.session_id ? "Mengirim…" : "Setujui VAR"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
  const [sesi, setSesi] = useState<string>(RANKING_ALL);

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

  const sesiOf = (nomor: number) => Math.floor((Number(nomor) - 1) / 10) + 1;

  const sesiList = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((r) => set.add(sesiOf(r.nomor_urut)));
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    let list = kategori === RANKING_ALL ? rows : rows.filter((r) => (kategoriMap[r.peserta_id] ?? "") === kategori);
    if (sesi !== RANKING_ALL) list = list.filter((r) => String(sesiOf(r.nomor_urut)) === sesi);
    return [...list].sort((a, b) => {
      const av = Number(a.nilai_akhir ?? 0), bv = Number(b.nilai_akhir ?? 0);
      const ar = Math.round(av * 1000), br = Math.round(bv * 1000);
      if (br !== ar) return br - ar;
      const at = Number(a.juri_total_sum ?? a.total_skor ?? 0), bt = Number(b.juri_total_sum ?? b.total_skor ?? 0);
      if (bt !== at) return bt - at;
      const as = Number(a.juri_spread ?? 0), bs = Number(b.juri_spread ?? 0);
      if (bs !== as) return bs - as;
      return a.nomor_urut - b.nomor_urut;
    });
  }, [rows, kategori, sesi, kategoriMap]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <SectionCard
      title="Daftar Nilai Peserta"
      description="Filter berdasarkan kategori dan sesi peserta (1 sesi = 10 peserta) untuk melihat perolehan nilai per sesi."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sesi} onValueChange={setSesi}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Sesi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={RANKING_ALL}>Semua Sesi</SelectItem>
              {sesiList.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Sesi {s} (No. {(s - 1) * 10 + 1}–{s * 10})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <TableHead className="text-right w-36">Nilai Akhir</TableHead>
              <TableHead className="text-right w-32">Total Juri</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Memuat…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Belum ada penilaian.</TableCell></TableRow>}
            {filtered.map((r, i) => {
              const belum = r.nilai_akhir == null || Number(r.jumlah_juri) === 0;
              const kat = kategoriMap[r.peserta_id];
              return (
              <TableRow key={r.peserta_id} className={!belum && i < 3 ? "bg-accent/10" : ""}>
                <TableCell className="text-center text-2xl">{belum ? "—" : (medals[i] ?? i + 1)}</TableCell>
                <TableCell className="font-mono">{r.nomor_urut}</TableCell>
                <TableCell className="font-semibold">{r.nama}</TableCell>
                <TableCell className="text-muted-foreground">{r.asal || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{kat || "—"}</TableCell>
                <TableCell className="text-center">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : r.jumlah_juri}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">{belum ? <span className="text-muted-foreground italic font-normal">belum tampil</span> : Number(r.nilai_akhir).toFixed(3)}</TableCell>
                <TableCell className="text-right font-mono">{belum ? <span className="text-muted-foreground italic">belum tampil</span> : Number(r.juri_total_sum ?? r.total_skor).toFixed(3)}</TableCell>
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
      const nilai = r?.nilai_akhir != null ? Number(r.nilai_akhir) : null;
      return { ...p, nilai, total: Number(r?.juri_total_sum ?? r?.total_skor ?? 0), spread: Number(r?.juri_spread ?? 0), juri: Number(r?.jumlah_juri ?? 0), scored: nilai != null && Number(r?.jumlah_juri ?? 0) > 0 };
    });
    const scoredSorted = enrichedAll
      .filter((r) => r.scored)
      .sort((a, b) => a.nomor_urut - b.nomor_urut);
    const chunks: { key: string; label: string; range: string; list: typeof scoredSorted }[] = [];
    for (let i = 0; i < scoredSorted.length; i += 10) {
      const slice = scoredSorted.slice(i, i + 10);
      const ranked = [...slice].sort((a, b) => {
        const ar = Math.round(Number(a.nilai ?? 0) * 1000), br = Math.round(Number(b.nilai ?? 0) * 1000);
        if (br !== ar) return br - ar;
        if (b.total !== a.total) return b.total - a.total;
        if (b.spread !== a.spread) return b.spread - a.spread;
        return a.nomor_urut - b.nomor_urut;
      });
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
                    <TableHead className="text-right w-36">Nilai Akhir</TableHead>
                    <TableHead className="text-right w-32">Total Juri</TableHead>
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
                        <TableCell className="text-right font-mono font-bold text-primary">{r.scored && r.nilai != null ? r.nilai.toFixed(3) : <span className="text-muted-foreground italic font-normal">belum tampil</span>}</TableCell>
                        <TableCell className="text-right font-mono">{r.scored ? r.total.toFixed(3) : <span className="text-muted-foreground italic">belum tampil</span>}</TableCell>
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
  const [nilaiMap, setNilaiMap] = useState<Record<string, number | null>>({});
  const [submissionRows, setSubmissionRows] = useState<Array<{ peserta_id: string; juri_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [ringkasan, setRingkasan] = useState<{
    total_peserta: number; sudah_tampil: number; belum_tampil: number;
    sedang_tampil: number; sesi_aktif: number; sesi_selesai: number; total_var: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    const [j, p, n, k, s, rk] = await Promise.all([
      supabase.from("juri_public" as any).select("*").eq("approved", true).eq("role", "juri").neq("aktif_menilai", false).order("nama"),
      supabase.from("peserta").select("*"),
      supabase.rpc("admin_list_penilaian" as any),
      supabase.from("kriteria").select("*"),
      supabase.from("penilaian_submission" as any).select("peserta_id, juri_id, nilai_cache"),
      supabase.rpc("inspektur_ringkasan" as any),
    ]);
    const juriList = (j.data as unknown as Juri[]) || [];
    const pesertaList = (p.data as Peserta[]) || [];
    const penilaianList = (n.data as unknown as Penilaian[]) || [];
    const submitted = ((s.data ?? []) as unknown as Array<{ peserta_id: string; juri_id: string; nilai_cache: number | null }>);
    setJuri(juriList);
    setPeserta(pesertaList);
    setPenilaian(penilaianList);
    setKriteria((k.data as Kriteria[]) || []);
    setSubmissionRows(submitted);
    setRingkasan((rk.data as any) ?? null);

    // Nilai per (juri, peserta) dibaca dari cache yang sudah dihitung server
    // saat juri mengirim penilaian — tidak perlu menghitung ulang satu per satu.
    const map: Record<string, number | null> = {};
    submitted.forEach((r) => {
      map[`${r.juri_id}|${r.peserta_id}`] = r.nilai_cache == null ? null : Number(r.nilai_cache);
    });
    setNilaiMap(map);
    setLoading(false);
  }

  usePolling(load, 30000);


  const totalPeserta = peserta.length;

  function computeNilai(juriId: string, pesertaId: string): number | null {
    const v = nilaiMap[`${juriId}|${pesertaId}`];
    return v == null ? null : v;
  }


  const rows = useMemo(() => {
    return juri.map((j) => {
      const mine = submissionRows.filter((p) => p.juri_id === j.id);
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
  }, [juri, peserta, submissionRows, totalPeserta]);

  const totalSudahKirim = rows.filter((r) => r.sudah > 0).length;
  const totalBelumKirim = rows.filter((r) => r.sudah === 0).length;
  const totalSelesai = rows.filter((r) => r.status === "selesai").length;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Ringkasan Lomba"
        description="Statistik peserta, sesi penilaian, dan potensi VAR secara real-time."
        action={<Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>}
      >
        {ringkasan ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Peserta" value={Number(ringkasan.total_peserta ?? 0)} />
            <StatCard label="Sudah Tampil" value={Number(ringkasan.sudah_tampil ?? 0)} tone="ok" />
            <StatCard label="Belum Tampil" value={Number(ringkasan.belum_tampil ?? 0)} tone="warn" />
            <StatCard label="Sedang Tampil" value={Number(ringkasan.sedang_tampil ?? 0)} />
            <StatCard label="Sesi Aktif" value={Number(ringkasan.sesi_aktif ?? 0)} tone="warn" />
            <StatCard label="Sesi Selesai" value={Number(ringkasan.sesi_selesai ?? 0)} tone="ok" />
            <StatCard label="Jumlah Potensi VAR" value={Number(ringkasan.total_var ?? 0)} tone="warn" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Peserta" value={totalPeserta} />
            <StatCard label="Total Juri" value={juri.length} />
            <StatCard label="Sudah Mengirim" value={totalSudahKirim} tone="ok" />
            <StatCard label="Selesai Semua" value={totalSelesai} tone="ok" />
          </div>
        )}
      </SectionCard>

    </div>
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
const LOOKUP_VALS = [0.05, 0.12, 0.22, 0.36, 0.52, 0.68, 0.81, 0.91, 1.0];
function lookupNilaiClient(g: number | null | undefined): number {
  if (g == null || Number.isNaN(g)) return 0;
  const gg = Math.max(1, Math.min(5, g));
  const idx = Math.floor((gg - 1) / 0.5);
  const frac = (gg - 1) / 0.5 - idx;
  if (idx >= 8) return LOOKUP_VALS[8];
  return LOOKUP_VALS[idx] + (LOOKUP_VALS[idx + 1] - LOOKUP_VALS[idx]) * frac;
}
function bobotFor(namaLower: string, kriteria: Kriteria[], fallback: number): number {
  const found = kriteria.find((k) => k.nama.toLowerCase().includes(namaLower));
  return found ? Number(found.bobot || 0) : fallback;
}
function findKategoriRow(rows: Kategori[], namaPeserta: string | null): Kategori | undefined {
  const key = (namaPeserta || "").trim().toLowerCase();
  if (!key) return undefined;
  return rows.find((r) => {
    const a = (r.kriteria_peserta || r.kategori || "").trim().toLowerCase();
    return a === key;
  });
}

function LihatPenilaianTab() {
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [juri, setJuri] = useState<Juri[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [penilaian, setPenilaian] = useState<Penilaian[]>([]);
  const [kategoriRows, setKategoriRows] = useState<Kategori[]>([]);
  const [nilaiMap, setNilaiMap] = useState<Record<string, number | null>>({});
  const [rankMap, setRankMap] = useState<Record<string, Ranking>>({});
  const [loading, setLoading] = useState(true);
  const [kategori, setKategori] = useState<string>(LIHAT_ALL);
  const [pesertaPilih, setPesertaPilih] = useState<string>("");
  const [juriPilih, setJuriPilih] = useState<string[] | null>(null); // null = semua juri

  async function load() {
    setLoading(true);
    const [p, j, k, n, s, rank, kat] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
      supabase.from("penilaian_submission" as any).select("peserta_id, juri_id, nilai_cache"),
      supabase.rpc("get_ranking" as any),
      supabase.from("kategori").select("*"),
    ]);
    if (p.error || j.error || k.error || n.error || s.error || rank.error || kat.error) {
      setLoading(false);
      return toast.error(p.error?.message || j.error?.message || k.error?.message || n.error?.message || s.error?.message || rank.error?.message || kat.error?.message || "Gagal memuat data");
    }
    setPeserta((p.data ?? []) as Peserta[]);
    setJuri(((j.data ?? []) as unknown as Juri[]).filter((x) => x.approved && x.role !== "viewer" && !(x.role === "juri" && x.aktif_menilai === false)));
    setKriteria((k.data ?? []) as Kriteria[]);
    setPenilaian((n.data ?? []) as Penilaian[]);
    setKategoriRows((kat.data ?? []) as Kategori[]);
    // Nilai per (juri, peserta) diambil dari cache server — tidak menghitung ulang satu per satu.
    const submitted = ((s.data ?? []) as unknown as Array<Submission & { nilai_cache: number | null }>);
    const nilaiEntries = submitted.map((row) =>
      [`${row.juri_id}|${row.peserta_id}`, row.nilai_cache == null ? null : Number(row.nilai_cache)] as const,
    );
    setNilaiMap(Object.fromEntries(nilaiEntries));
    const nextRankMap: Record<string, Ranking> = {};
    ((rank.data ?? []) as unknown as Ranking[]).forEach((r) => { nextRankMap[r.peserta_id] = r; });
    setRankMap(nextRankMap);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);


  function nilaiJuri(juriId: string, pesertaId: string): number | undefined {
    const value = nilaiMap[`${juriId}|${pesertaId}`];
    return value == null ? undefined : value;
  }

  // Juri yang nilainya ditampilkan (null = semua)
  const juriTampil = useMemo(
    () => (juriPilih === null ? juri : juri.filter((j) => juriPilih.includes(j.id))),
    [juri, juriPilih],
  );
  function toggleJuri(id: string) {
    setJuriPilih((prev) => {
      const cur = prev === null ? juri.map((j) => j.id) : prev;
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === juri.length ? null : next;
    });
  }

  const kategoriList = useMemo(() => {
    const s = new Set<string>();
    peserta.forEach((p) => { if (p.kategori && p.kategori.trim()) s.add(p.kategori.trim()); });
    return Array.from(s).sort();
  }, [peserta]);

  // Hanya peserta yang sudah memiliki nilai yang ditampilkan.
  const pesertaBernilai = useMemo(() => {
    const ids = new Set(penilaian.map((n) => n.peserta_id));
    Object.keys(nilaiMap).forEach((k) => { if (nilaiMap[k] != null) ids.add(k.split("|")[1]); });
    return peserta.filter((p) => ids.has(p.id));
  }, [peserta, penilaian, nilaiMap]);

  const pesertaFiltered = useMemo(
    () => (kategori === LIHAT_ALL ? pesertaBernilai : pesertaBernilai.filter((p) => (p.kategori ?? "") === kategori)),
    [pesertaBernilai, kategori]
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
    const dHead = [["Juri", ...kriteria.map((k) => `${k.nama} (b:${k.bobot})`), "Nilai Juri"]];
    const dBody = juriTampil.map((j) => {
      const rec = scoreMap[p.id]?.[j.id];
      const nilai = nilaiJuri(j.id, p.id);
      return [
        j.nama,
        ...kriteria.map((k) => {
          const v = rec?.per[k.id];
          return v === undefined ? "—" : Number(v).toFixed(2);
        }),
        nilai === undefined ? "—" : nilai.toFixed(3),
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
      ...juriTampil.map((j) => j.nama),
      "Nilai Akhir", "Total Juri"
    ]];
    const body = pesertaFiltered.map((p) => {
      const scores = juriTampil.map((j) => nilaiJuri(j.id, p.id));
      const valid = scores.filter((s): s is number => typeof s === "number" && s > 0);
      const nilaiAkhir = rankMap[p.id]?.nilai_akhir;
      const total = rankMap[p.id]?.juri_total_sum ?? valid.reduce((a, b) => a + b, 0);
      return [
        String(p.nomor_urut),
        p.nama,
        p.kategori || "—",
        ...scores.map((s) => (s === undefined ? "—" : s.toFixed(3))),
        nilaiAkhir == null ? "—" : Number(nilaiAkhir).toFixed(3),
        valid.length ? Number(total).toFixed(3) : "—",
      ];
    });

    autoTable(doc, {
      head, body, startY: 76, styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [120, 30, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 244, 240] },
      columnStyles: { 0: { halign: "center", cellWidth: 32 } },
    });

    pesertaFiltered.forEach((p) => {
      const hasAny = juriTampil.some((j) => scoreMap[p.id]?.[j.id]);
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
    const hasAny = juriTampil.some((j) => scoreMap[p.id]?.[j.id]);
    if (!hasAny) return toast.error("Peserta ini belum memiliki penilaian");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16); doc.text("Laporan Nilai Peserta", 40, 40);
    buildPesertaDetail(doc, p, 76);
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = p.nama.replace(/\s+/g, "_");
    doc.save(`nilai-${p.nomor_urut}-${safe}-${stamp}.pdf`);
  }

  function downloadPerhitunganPDF() {
    const p = peserta.find((x) => x.id === pesertaPilih);
    if (!p) return toast.error("Pilih peserta terlebih dahulu");
    const hasAny = juriTampil.some((j) => scoreMap[p.id]?.[j.id]);
    if (!hasAny) return toast.error("Peserta ini belum memiliki penilaian");

    const bV = bobotFor("interpretasi", kriteria, 0) || bobotFor("vokal", kriteria, 25) || bobotFor("vocal", kriteria, 25);
    const bPn = bobotFor("penghayatan", kriteria, 20);
    const bIt = bobotFor("artikulasi", kriteria, 0) || bobotFor("intonasi", kriteria, 30);
    const bPl = bobotFor("penampilan", kriteria, 25);
    const bCat = bobotFor("catatan", kriteria, 10);
    const bPer = bobotFor("perhatian", kriteria, -10);
    const rawMax = bV + bPn + bIt + bPl + bCat;
    const rawMin = bPer;

    const kat = findKategoriRow(kategoriRows, p.kategori);
    let BB = 0, BA = 100, TG = 50;
    if (kat) {
      BB = Number(kat.batas_bawah || 0);
      BA = Number(kat.batas_atas || 100);
      TG = Number(kat.nilai_tengah || 0);
      if (!TG || TG <= BB || TG >= BA) TG = (BB + BA) / 2;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.text("Perhitungan Nilai Peserta", 40, 40);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`${p.nomor_urut}. ${p.nama}${p.asal ? "  •  " + p.asal : ""}`, 40, 58);
    doc.text(`Kategori: ${p.kategori || "—"}   |   Rentang: [${BB}, TG ${TG}, ${BA}]`, 40, 74);
    doc.setTextColor(0);

    // Skema
    doc.setFontSize(12); doc.text("Skema Perhitungan", 40, 100);
    autoTable(doc, {
      startY: 108,
      head: [["Langkah", "Rumus / Nilai"]],
      body: [
        ["1. Lookup non-linear (grade → bobot)", "1.0=0.050  1.5=0.120  2.0=0.220  2.5=0.360  3.0=0.520  3.5=0.680  4.0=0.810  4.5=0.910  5.0=1.000"],
        ["2. Skor mentah (raw)", "Σ lookup(grade)×bobot untuk V/Pn/It/Pl  +  Σ [lookup(aspek Catatan) × lookup(grade kriteria induk) × bobot aspek]  +  min(1, marks/15)×bobotPer\nbobot aspek = (bobot induk ÷ bobot Catatan) ÷ jumlah aspek dalam induk"],
        ["3. Bobot dipakai", `Interpretasi ${bV} · Penghayatan ${bPn} · Artikulasi ${bIt} · Penampilan ${bPl} · Catatan ${bCat} · Perhatian ${bPer}`],
        ["4. Normalisasi n∈[0,1]", `n = (raw − ${rawMin}) / (${rawMax} − ${rawMin})`],
        ["5. Pemetaan kurva 2-segmen", `n≤0.5 → out = BB + (TG−BB)·(2n)^1.15\nn>0.5 → out = TG + (BA−TG)·(1 − (2(1−n))^1.15)`],
        ["6. Jitter deterministik", "hash(peserta|juri) → ±0.0009 (mencegah kembar)"],
        ["7. Nilai Akhir Peserta", "rata-rata nilai semua juri, di-clamp [BB, BA], 3 desimal"],
      ],
      styles: { fontSize: 8, cellPadding: 4, valign: "top" },
      headStyles: { fillColor: [120, 30, 45], textColor: 255 },
      columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" } },
      margin: { left: 40, right: 40 },
    });

    // Per-juri
    const juriValid = juriTampil.filter((j) => scoreMap[p.id]?.[j.id]);
    juriValid.forEach((j, idx) => {
      const rec = scoreMap[p.id][j.id];
      const detailByKrit: Record<string, PenilaianDetail> = {};
      penilaian.filter((n) => n.peserta_id === p.id && n.juri_id === j.id).forEach((n) => {
        detailByKrit[n.kriteria_id] = (n.detail ?? null) as PenilaianDetail;
      });
      const gradeOf = (kritId: string): number | null => {
        const d = detailByKrit[kritId];
        if (d && (d as any).type === "grade") return Number((d as any).grade);
        const v = rec.per[kritId];
        return v == null ? null : v / 20;
      };

      let rawSum = 0;
      const rows: (string | number)[][] = [];
      kriteria.forEach((k) => {
        const nm = k.nama.toLowerCase();
        if (nm.includes("catatan")) {
          const d = detailByKrit[k.id] as any;
          const asp = d?.aspek ?? [];
          const rasioInduk = (key: string): number => {
            const kk = kriteria.find((x) => kriteriaKey(x.nama) === key);
            if (!kk) return 1;
            const g = gradeOf(kk.id);
            return g == null ? 1 : lookupNilaiClient(g);
          };
          const bobotCatK = Number(k.bobot || 0) || 10;
          const bobotIndukKey = (key: string): number => {
            const kk = kriteria.find((x) => kriteriaKey(x.nama) === key);
            return Number(kk?.bobot ?? 0) || 0;
          };
          let sum = 0;
          let keptN = 0;
          asp.forEach((a: any, i: number) => {
            if (a?.skipped || a?.nilai == null) return;
            const idx = CATATAN_ASPEK.findIndex((nmA) => nmA.toLowerCase() === String(a?.nama ?? "").toLowerCase());
            const indukKey = CATATAN_INDUK[idx >= 0 ? idx : i] ?? null;
            const bAspek = bobotAspekCatatan(indukKey, indukKey ? bobotIndukKey(indukKey) : 0, bobotCatK);
            sum += lookupNilaiClient(Number(a.nilai)) * (indukKey ? rasioInduk(indukKey) : 1) * bAspek;
            keptN += 1;
          });
          const kontrib = sum;
          const ratio = bobotCatK ? sum / bobotCatK : 0;
          rawSum += kontrib;
          rows.push([k.nama, `${keptN}/${asp.length} aspek (bobot induk)`, ratio.toFixed(6), String(k.bobot), kontrib.toFixed(6)]);

        } else if (nm.includes("perhatian")) {
          const d = detailByKrit[k.id] as any;
          let marks = 0;
          const ctVal = d?.clearText ?? d?.membacaPerikop;
          if (ctVal === false) marks += 1;
          (d?.aspek ?? []).forEach((a: any) => (a?.ayat ?? []).forEach((b: any) => { if (b) marks += 1; }));
          const factor = Math.min(1, marks / 15);
          const kontrib = factor * Number(k.bobot || 0);
          rawSum += kontrib;
          rows.push([k.nama, `${marks} penanda`, `min(1, ${marks}/15) = ${factor.toFixed(6)}`, String(k.bobot), kontrib.toFixed(6)]);
        } else {
          const g = gradeOf(k.id);
          const lv = lookupNilaiClient(g);
          const kontrib = lv * Number(k.bobot || 0);
          rawSum += kontrib;
          rows.push([k.nama, g == null ? "—" : g.toFixed(2), lv.toFixed(6), String(k.bobot), kontrib.toFixed(6)]);
        }
      });

      const n = rawMax === rawMin ? 0 : Math.max(0, Math.min(1, (rawSum - rawMin) / (rawMax - rawMin)));
      let out: number;
      let mapExpr: string;
      if (n <= 0.5) {
        const t = Math.pow(n * 2, 1.15);
        out = BB + (TG - BB) * t;
        mapExpr = `n≤0.5 → t=(2·${n.toFixed(6)})^1.15=${t.toFixed(6)}  →  ${BB} + (${TG}−${BB})·t = ${out.toFixed(6)}`;
      } else {
        const t = 1 - Math.pow((1 - n) * 2, 1.15);
        out = TG + (BA - TG) * t;
        mapExpr = `n>0.5 → t=1−(2·(1−${n.toFixed(6)}))^1.15=${t.toFixed(6)}  →  ${TG} + (${BA}−${TG})·t = ${out.toFixed(6)}`;
      }
      const dbFinal = nilaiJuri(j.id, p.id);

      const startY = (doc as any).lastAutoTable?.finalY ?? 200;
      if (startY > 680) doc.addPage();
      const y0 = (doc as any).lastAutoTable?.finalY && !(startY > 680) ? startY + 24 : 40;
      doc.setFontSize(12); doc.setTextColor(0);
      doc.text(`Juri ${idx + 1}: ${j.nama}`, 40, y0);

      autoTable(doc, {
        startY: y0 + 8,
        head: [["Kriteria", "Grade / Detail", "lookup / faktor", "Bobot", "Kontribusi"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [70, 70, 90], textColor: 255 },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" } },
        margin: { left: 40, right: 40 },
      });

      const y1 = (doc as any).lastAutoTable.finalY + 6;
      autoTable(doc, {
        startY: y1,
        body: [
          ["raw", `Σ kontribusi = ${rawSum.toFixed(6)}`],
          ["n (normalisasi)", `(${rawSum.toFixed(6)} − ${rawMin}) / (${rawMax} − ${rawMin}) = ${n.toFixed(6)}`],
          ["Pemetaan → out", mapExpr],
          ["Clamp [BB,BA] + jitter ±0.0009", `pra-jitter ≈ ${Math.max(BB, Math.min(BA, out)).toFixed(6)}`],
          ["Nilai Juri (final, dari basis data)", dbFinal == null ? "—" : dbFinal.toFixed(3)],
        ],
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" }, 1: { halign: "left" } },
        margin: { left: 40, right: 40 },
      });
    });

    // Total peserta
    const startY = (doc as any).lastAutoTable?.finalY ?? 40;
    if (startY > 680) doc.addPage();
    const yT = startY > 680 ? 40 : startY + 24;
    doc.setFontSize(12); doc.text("Nilai Akhir Peserta", 40, yT);
    const juriValues = juriValid.map((j) => ({ nama: j.nama, v: nilaiJuri(j.id, p.id) }));
    const avg = juriValues.filter((x) => x.v != null).reduce((s, x) => s + (x.v as number), 0) / Math.max(1, juriValues.filter((x) => x.v != null).length);
    const nilaiAkhir = rankMap[p.id]?.nilai_akhir;
    autoTable(doc, {
      startY: yT + 8,
      head: [["Juri", "Nilai"]],
      body: [
        ...juriValues.map((x) => [x.nama, x.v == null ? "—" : x.v.toFixed(3)]),
        ["Rata-rata", isFinite(avg) ? avg.toFixed(6) : "—"],
        ["Nilai Akhir (clamp [BB,BA], 3 desimal)", nilaiAkhir == null ? "—" : Number(nilaiAkhir).toFixed(3)],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [120, 30, 45], textColor: 255 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 40, right: 40 },
    });

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(
      "Catatan: jitter deterministik ±0.0009 dari hash(peserta|juri) dihitung di basis data (hashtext PostgreSQL) dan tidak dapat direplikasi persis di sisi klien; nilai final pada baris 'Nilai Juri' diambil langsung dari basis data.",
      40, doc.internal.pageSize.getHeight() - 30, { maxWidth: pageW - 80 }
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const safe = p.nama.replace(/\s+/g, "_");
    doc.save(`perhitungan-${p.nomor_urut}-${safe}-${stamp}.pdf`);
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between gap-2">
                <span className="truncate">
                  {juriPilih === null ? "Semua Juri" : `${juriTampil.length} dari ${juri.length} juri`}
                </span>
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-medium text-muted-foreground">Tampilkan Nilai Juri</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setJuriPilih(null)}>
                  Semua
                </Button>
              </div>
              <div className="max-h-64 space-y-1 overflow-auto">
                {juri.length === 0 && <p className="px-1 text-xs text-muted-foreground">Belum ada juri.</p>}
                {juri.map((j) => {
                  const checked = juriPilih === null || juriPilih.includes(j.id);
                  return (
                    <label key={j.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted">
                      <Checkbox checked={checked} onCheckedChange={() => toggleJuri(j.id)} />
                      <span className="truncate text-sm">{j.nama}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
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
          <Button variant="outline" onClick={downloadPerhitunganPDF} disabled={loading || !pesertaPilih} className="gap-2">
            <FileText className="size-4" /> Unduh Perhitungan
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
              {juriTampil.map((j) => (
                <TableHead key={j.id} className="text-right whitespace-nowrap">{j.nama}</TableHead>
              ))}
              <TableHead className="text-right w-32">Nilai Akhir</TableHead>
              <TableHead className="text-right w-28">Total Juri</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5 + juriTampil.length} className="text-center py-10 text-muted-foreground">Memuat…</TableCell></TableRow>}
            {!loading && pesertaFiltered.length === 0 && <TableRow><TableCell colSpan={5 + juriTampil.length} className="text-center py-10 text-muted-foreground">Belum ada peserta.</TableCell></TableRow>}
            {pesertaFiltered.map((p) => {
              const scores = juriTampil.map((j) => nilaiJuri(j.id, p.id));
              const valid = scores.filter((s): s is number => typeof s === "number" && s > 0);
              const nilaiAkhir = rankMap[p.id]?.nilai_akhir;
              const total = rankMap[p.id]?.juri_total_sum ?? valid.reduce((a, b) => a + b, 0);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.nomor_urut}</TableCell>
                  <TableCell className="font-medium">{p.nama}</TableCell>
                  <TableCell className="text-muted-foreground">{p.kategori || "—"}</TableCell>
                  {scores.map((s, i) => (
                    <TableCell key={juriTampil[i].id} className="text-right font-mono">
                      {s === undefined ? <span className="text-muted-foreground italic">—</span> : s.toFixed(3)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono font-bold text-primary">{nilaiAkhir == null ? "—" : Number(nilaiAkhir).toFixed(3)}</TableCell>
                  <TableCell className="text-right font-mono">{valid.length ? Number(total).toFixed(3) : "—"}</TableCell>
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
  const [nilaiAkhirMap, setNilaiAkhirMap] = useState<Record<string, number | null>>({});
  const [nilaiJuriMap, setNilaiJuriMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [kategoriFilter, setKategoriFilter] = useState<string>(LIHAT_ALL);
  const [pesertaFilter, setPesertaFilter] = useState<string>(LIHAT_ALL);
  type MasukanRow = { peserta_id: string; juri_id: string; mazmur_id: string | null; catatan: { ayat: number; teks: string }[] };
  const [masukanRows, setMasukanRows] = useState<MasukanRow[]>([]);

  async function load() {
    setLoading(true);
    const [p, j, k, n, kt, m, rank, s, mk] = await Promise.all([
      supabase.from("peserta").select("*").order("nomor_urut"),
      supabase.from("juri_public" as any).select("*").order("created_at"),
      supabase.from("kriteria").select("*").order("created_at"),
      supabase.from("penilaian").select("*"),
      supabase.from("kategori").select("*").order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("mazmur").select("*"),
      supabase.rpc("get_ranking" as any),
      supabase.from("penilaian_submission" as any).select("peserta_id, juri_id, nilai_cache"),
      supabase.from("masukan_juri" as any).select("peserta_id, juri_id, mazmur_id, catatan"),
    ]);
    for (const r of [p, j, k, n, kt, m, rank, s]) {
      if ((r as any).error) {
        setLoading(false);
        return toast.error((r as any).error.message);
      }
    }
    setPeserta((p.data ?? []) as Peserta[]);
    setJuri(((j.data ?? []) as unknown as Juri[]).filter((x) => x.approved && x.role !== "viewer" && !(x.role === "juri" && x.aktif_menilai === false)));
    setKriteria((k.data ?? []) as Kriteria[]);
    setPenilaian((n.data ?? []) as Penilaian[]);
    setKategoriRows((kt.data ?? []) as Kategori[]);
    setMazmur((m.data ?? []) as Mazmur[]);
    setMasukanRows(((mk as any)?.data ?? []) as MasukanRow[]);
    const map: Record<string, number | null> = {};
    ((rank.data ?? []) as any[]).forEach((r) => { map[r.peserta_id] = r.nilai_akhir != null ? Number(r.nilai_akhir) : null; });
    setNilaiAkhirMap(map);
    // Nilai per (juri, peserta) diambil dari cache server — tidak menghitung ulang satu per satu.
    const submitted = ((s.data ?? []) as unknown as Array<Submission & { nilai_cache: number | null }>);
    const nilaiEntries = submitted.map((row) =>
      [`${row.juri_id}|${row.peserta_id}`, row.nilai_cache == null ? null : Number(row.nilai_cache)] as const,
    );
    setNilaiJuriMap(Object.fromEntries(nilaiEntries));
    setLoading(false);
  }

  function masukanFor(pesertaId: string, juriId: string): { ayat: number; teks: string }[] {
    const row = masukanRows.find((r) => r.peserta_id === pesertaId && r.juri_id === juriId);
    return (row?.catatan ?? []).filter((c) => c && c.teks && c.teks.trim().length > 0);
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

  function kategoriForPeserta(pesertaKategori: string | null) {
    const target = (pesertaKategori ?? "").toLowerCase().trim();
    return kategoriRows.find(
      (k) => (k.kriteria_peserta ?? k.kategori ?? "").toLowerCase().trim() === target
    );
  }

  function nilaiJuriRentang(juriId: string, pesertaId: string): number | null {
    const value = nilaiJuriMap[`${juriId}|${pesertaId}`];
    return value == null ? null : value;
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

    const nilaiAkhir = nilaiAkhirMap[p.id];
    if (nilaiAkhir != null) {
      doc.setFontSize(12); doc.setTextColor(120, 30, 45);
      doc.text(`Nilai Akhir: ${Number(nilaiAkhir).toFixed(3)}`, 40, y);
      doc.setTextColor(0);
      y += 18;
    }

    const juriDenganNilai = juri.filter((j) => penilaian.some((n) => n.peserta_id === p.id && n.juri_id === j.id));
    if (juriDenganNilai.length === 0) {
      doc.setFontSize(11); doc.setTextColor(120);
      doc.text("Belum ada penilaian untuk peserta ini.", 40, y);
      return;
    }

    juriDenganNilai.forEach((j) => {
      const rows = kriteria.map((k) => {
        const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
        const kat = kategoriForPeserta(p.kategori);
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
      const nilaiJuri = nilaiJuriRentang(j.id, p.id);

      const mzId = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id)?.mazmur_id;
      const mz = mazmur.find((x) => x.id === mzId);

      doc.setFontSize(11); doc.setTextColor(0);
      doc.text(`Juri: ${j.nama}${j.jabatan ? " — " + j.jabatan : ""}`, 40, y);
      if (mz) { doc.setFontSize(9); doc.setTextColor(110); doc.text(`Mazmur: ${mz.bacaan} (${mz.jumlah_ayat} ayat)`, 40, y + 12); doc.setTextColor(0); }
      autoTable(doc, {
        startY: y + (mz ? 18 : 6),
        head: [["Kriteria (Kategori)", "Kriteria Peserta", "Bobot", "Batas", "Tengah", "Standar", "Nilai", "Berbobot"]],
        body: rows,
        foot: [["", "", "", "", "", "Total Mentah", totalNilai.toFixed(2), totalBerbobot.toFixed(2)],
               ["", "", "", "", "", "Nilai Juri", "", nilaiJuri == null ? "—" : nilaiJuri.toFixed(3)]],
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
          head = [["#", "Aspek", "Nilai (1–5)"]];
          body = d.aspek.map((a, i) => [
            i + 1, a.nama,
            a.skipped ? "— (dilewati)" : String(a.nilai),
          ]);
        } else if (d.type === "perhatian") {
          const ctVal = (d as any).clearText ?? (d as any).membacaPerikop;
          head = [["#", "Aspek", "Penanda"]];
          body = [
            ["1", "Clear Text", ctVal === null || ctVal === undefined ? "—" : ctVal ? "Ya" : "Tidak"],
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

    // Lampiran: Masukan Juri per ayat (di luar penilaian)
    const juriDenganMasukan = juri.filter((j) => masukanFor(p.id, j.id).length > 0);
    if (juriDenganMasukan.length > 0) {
      doc.addPage();
      doc.setFontSize(14); doc.text("Lampiran — Masukan Juri per Ayat", 40, 40);
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`${p.nomor_urut}. ${p.nama}${p.kategori ? " • " + p.kategori : ""}`, 40, 58);
      doc.setTextColor(0);
      let y2 = 78;
      juriDenganMasukan.forEach((j) => {
        const rows = masukanFor(p.id, j.id).map((c) => [c.ayat === 0 ? "Umum" : String(c.ayat), c.teks]);
        doc.setFontSize(11); doc.text(`Juri: ${j.nama}${j.jabatan ? " — " + j.jabatan : ""}`, 40, y2);
        autoTable(doc, {
          startY: y2 + 6,
          head: [["Ayat", "Masukan"]],
          body: rows,
          styles: { fontSize: 9, cellPadding: 4, valign: "top" },
          headStyles: { fillColor: [60, 90, 140], textColor: 255 },
          columnStyles: { 0: { halign: "center", cellWidth: 50 } },
        });
        // @ts-ignore
        y2 = (doc as any).lastAutoTable.finalY + 14;
        if (y2 > 520) { doc.addPage(); y2 = 40; }
      });
    }
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

  function downloadMasukan(p: Peserta) {
    const juriDenganMasukan = juri.filter((j) => masukanFor(p.id, j.id).length > 0);
    if (juriDenganMasukan.length === 0) return toast.info("Belum ada masukan juri untuk peserta ini.");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(16); doc.text("Masukan Juri per Ayat", 40, 40);
    doc.setFontSize(12); doc.setTextColor(60);
    doc.text(`${p.nomor_urut}. ${p.nama}`, 40, 62);
    doc.setFontSize(10); doc.setTextColor(100);
    const meta = [p.kategori && `Kategori: ${p.kategori}`, p.asal && `Asal: ${p.asal}`].filter(Boolean).join("  •  ");
    if (meta) doc.text(meta, 40, 78);
    doc.setTextColor(0);
    let y = meta ? 96 : 82;
    juriDenganMasukan.forEach((j) => {
      const rows = masukanFor(p.id, j.id).map((c) => [c.ayat === 0 ? "Umum" : String(c.ayat), c.teks]);
      doc.setFontSize(11); doc.text(`Juri: ${j.nama}${j.jabatan ? " — " + j.jabatan : ""}`, 40, y);
      autoTable(doc, {
        startY: y + 6,
        head: [["Ayat", "Masukan"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 4, valign: "top" },
        headStyles: { fillColor: [60, 90, 140], textColor: 255 },
        columnStyles: { 0: { halign: "center", cellWidth: 50 } },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 14;
      if (y > 760) { doc.addPage(); y = 40; }
    });
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`masukan-juri-${p.nomor_urut}-${p.nama.replace(/\s+/g, "_")}-${stamp}.pdf`);
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
                <div className="flex items-center gap-3">
                  {nilaiAkhirMap[p.id] != null && (
                    <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nilai Akhir</div>
                      <div className="font-serif font-semibold text-primary text-lg leading-none">{Number(nilaiAkhirMap[p.id]).toFixed(3)}</div>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => downloadSatu(p)} className="gap-2">
                    <Download className="size-4" /> Unduh PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadMasukan(p)}
                    disabled={!juri.some((j) => masukanFor(p.id, j.id).length > 0)}
                    className="gap-2"
                  >
                    <FileText className="size-4" /> Unduh Masukan Juri
                  </Button>

                </div>
              </div>
              {juriDenganNilai.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">Belum ada penilaian.</div>
              ) : (
                <div className="space-y-4">
                  {juriDenganNilai.map((j) => {
                    let totalNilai = 0, totalBerbobot = 0;
                    const nilaiJuri = nilaiJuriRentang(j.id, p.id);
                    const rows = kriteria.map((k) => {
                      const rec = penilaian.find((n) => n.peserta_id === p.id && n.juri_id === j.id && n.kriteria_id === k.id);
                      const kat = kategoriForPeserta(p.kategori);
                      const nilai = rec ? Number(rec.nilai) : null;
                      const bobot = Number(k.bobot || 0);
                      const berbobot = nilai !== null ? nilai * bobot : null;
                      if (nilai !== null) { totalNilai += nilai; totalBerbobot += berbobot!; }
                      return { k, kat, nilai, bobot, berbobot };
                    });
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
                              <TableCell colSpan={6} className="text-right">Total Mentah</TableCell>
                              <TableCell className="text-right font-mono">{totalNilai.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono">{totalBerbobot.toFixed(2)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-primary/10 font-semibold">
                              <TableCell colSpan={7} className="text-right">Nilai Juri</TableCell>
                              <TableCell className="text-right font-mono text-primary">{nilaiJuri == null ? "—" : nilaiJuri.toFixed(3)}</TableCell>
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
                                        <span>{i + 1}. {a.nama}</span>
                                        <span className="font-mono">{a.skipped ? "—" : a.nilai}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {d.type === "perhatian" && (() => {
                                  const ctVal = (d as any).clearText ?? (d as any).membacaPerikop;
                                  return (
                                  <div className="grid gap-1 text-xs">
                                    <div className="flex justify-between gap-3 border-b py-1">
                                      <span>1. Clear Text</span>
                                      <span className="font-mono">{ctVal === null || ctVal === undefined ? "—" : ctVal ? "Ya" : "Tidak"}</span>
                                    </div>
                                    {d.aspek.map((a, i) => (
                                      <div key={i} className="flex justify-between gap-3 border-b last:border-0 py-1">
                                        <span>{i + 2}. {a.nama}</span>
                                        <span className="font-mono text-right">{a.ditandai.length ? `Ayat: ${a.ditandai.join(", ")}` : "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                          {(() => {
                            const list = masukanFor(p.id, j.id);
                            if (list.length === 0) return null;
                            return (
                              <div className="rounded border-2 border-accent/30 bg-accent/5 p-3">
                                <div className="text-xs font-semibold text-accent mb-2">Masukan Juri per Ayat</div>
                                <div className="grid gap-1 text-xs">
                                  {list.map((c, i) => (
                                    <div key={i} className="flex gap-3 border-b last:border-0 py-1">
                                      <span className="font-mono w-14 shrink-0">{c.ayat === 0 ? "Umum" : `Ayat ${c.ayat}`}</span>
                                      <span className="flex-1 whitespace-pre-wrap">{c.teks}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
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


/* RESET DATA — pusat semua tombol reset */
function ResetTab() {
  const [busyPeserta, setBusyPeserta] = useState(false);

  async function resetSemuaPeserta() {
    if (!window.confirm("Hapus SEMUA daftar peserta beserta seluruh nilainya?\n\nTindakan ini tidak dapat dibatalkan.")) return;
    if (!window.confirm("Konfirmasi sekali lagi: hapus semua peserta sekarang?")) return;
    setBusyPeserta(true);
    await supabase.from("penilaian_submission" as any).delete().not("id", "is", null);
    const { error: pe } = await supabase.from("penilaian").delete().not("id", "is", null);
    if (pe) { setBusyPeserta(false); return toast.error("Gagal menghapus penilaian: " + pe.message); }
    const { error } = await supabase.from("peserta").delete().not("id", "is", null);
    setBusyPeserta(false);
    if (error) return toast.error(error.message);
    toast.success("Semua peserta dihapus");
  }

  return (
    <SectionCard
      title="Reset Data"
      description="Semua tindakan reset terkumpul di sini. Perhatikan: data yang dihapus tidak dapat dikembalikan."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="min-w-0">
            <div className="font-medium">Reset Semua Nilai</div>
            <p className="text-sm text-muted-foreground">Hapus seluruh penilaian dari semua juri untuk semua peserta. Daftar peserta tetap ada.</p>
          </div>
          <ResetAllPenilaianButton />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="min-w-0">
            <div className="font-medium">Reset Daftar Peserta</div>
            <p className="text-sm text-muted-foreground">Hapus seluruh peserta beserta semua nilainya.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={resetSemuaPeserta} disabled={busyPeserta} className="gap-2">
            <Trash2 className="size-4" />{busyPeserta ? "Menghapus..." : "Hapus Semua Peserta"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
