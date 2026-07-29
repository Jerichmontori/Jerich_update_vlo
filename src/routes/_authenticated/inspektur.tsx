import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { Shield, RefreshCw, BookOpenText, AlertTriangle, Eye, Square, Siren, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inspektur")({
  component: InspekturPage,
  head: () => ({
    meta: [
      { title: "Inspektur Pertandingan · Sistem Penjurian" },
      { name: "description", content: "Pengawas independen: monitoring peserta, juri, dan Potensi VAR secara real-time." },
      { property: "og:title", content: "Inspektur Pertandingan · Sistem Penjurian" },
      { property: "og:description", content: "Pengawas independen: monitoring peserta, juri, dan Potensi VAR secara real-time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Ringkasan = {
  total_peserta: number;
  sudah_tampil: number;
  belum_tampil: number;
  sedang_tampil: number;
  sesi_aktif: number;
  sesi_selesai: number;
  total_var: number;
};

type MonitorRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
  bacaan: string | null;
  status: "Menunggu" | "Sedang Dinilai" | "Menunggu Juri" | "Potensi VAR" | "Final" | string;
  juri_done: number;
  juri_total: number;
};

type VarRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
  komponen_berbeda: string[] | null;
  status: string;
  bacaan: string | null;
  juri_berbeda: number;
  detected_at: string;
};

const KOMP_LABEL: Record<string, string> = {
  salah_kata: "Salah kata",
  menambah_kata: "Menambah kata",
  mengurangi_kata: "Mengurangi kata",
};


function statusVariant(s: string): { label: string; className: string } {
  switch (s) {
    case "Final": return { label: "Final", className: "bg-emerald-600 text-white" };
    case "Perbaikan Perhatian": return { label: "Perbaikan Perhatian", className: "bg-amber-600 text-white" };
    case "Sedang Dinilai": return { label: "Sedang Dinilai", className: "bg-amber-500 text-white" };
    case "Menunggu Juri": return { label: "Menunggu Juri", className: "bg-sky-600 text-white" };
    case "Potensi VAR": return { label: "Potensi VAR", className: "bg-rose-600 text-white" };
    default: return { label: "Menunggu", className: "bg-muted text-foreground" };
  }
}

function InspekturPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{ nama: string; email: string; role: string } | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [monitor, setMonitor] = useState<MonitorRow[]>([]);
  const [vars, setVars] = useState<VarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPeserta, setDetailPeserta] = useState<MonitorRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [catatan, setCatatan] = useState("");
  const [savingCatatan, setSavingCatatan] = useState(false);
  const [terapkanLoading, setTerapkanLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ pesertaId: string; nama: string; catatan: string | null; source: "row" | "detail" } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  // Ajukan VAR manual
  const [ajukanVarOpen, setAjukanVarOpen] = useState(false);
  const [ajukanVarTarget, setAjukanVarTarget] = useState<{ pesertaId: string; nama: string } | null>(null);
  const [ajukanVarAlasan, setAjukanVarAlasan] = useState("");
  const [ajukanVarLoading, setAjukanVarLoading] = useState(false);
  // Akhiri sesi
  const [akhiriOpen, setAkhiriOpen] = useState(false);
  const [akhiriTarget, setAkhiriTarget] = useState<{ pesertaId: string; nama: string } | null>(null);
  const [akhiriLoading, setAkhiriLoading] = useState(false);
  // Sesi aktif untuk peserta mana? map peserta_id -> sesi active
  const [activeSesiPesertaIds, setActiveSesiPesertaIds] = useState<Set<string>>(new Set());
  // Progres juri di detail dialog
  const [progresJuri, setProgresJuri] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setAllowed(false); window.location.href = "/auth"; return; }
      const [{ data: isInsp }, { data: isAdm }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "inspektur" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any }),
      ]);
      const ok = !!isInsp || !!isAdm;
      setAllowed(ok);
      if (!ok) { toast.error("Akses ditolak"); window.location.href = "/dashboard"; return; }
      const { data: prof } = await supabase.from("profiles").select("nama").eq("id", uid).maybeSingle();
      setCurrentUser({
        nama: prof?.nama ?? (u.user?.email?.split("@")[0] ?? "Pengguna"),
        email: u.user?.email ?? "",
        role: isAdm ? "Admin" : "Inspektur Pertandingan",
      });
    })();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setAllowed(false);
        window.location.href = "/auth";
        return;
      }
      const [r, m, v, sa] = await Promise.all([
        supabase.rpc("inspektur_ringkasan" as any),
        supabase.rpc("inspektur_monitor" as any),
        supabase.rpc("inspektur_list_var" as any),
        supabase.from("sesi_penilaian" as any).select("peserta_id").eq("status", "active"),
      ]);
      if (r.error) throw r.error;
      if (m.error) throw m.error;
      if (v.error) throw v.error;
      if (r.data && (r.data as any[])[0]) setRingkasan((r.data as any[])[0] as Ringkasan);
      setMonitor(((m.data as any[]) ?? []) as MonitorRow[]);
      setVars(((v.data as any[]) ?? []) as VarRow[]);
      setActiveSesiPesertaIds(new Set(((sa.data as any[] | null) ?? []).map((x: any) => x.peserta_id)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat data";
      if (message.toLowerCase().includes("permission denied") || message.toLowerCase().includes("forbidden")) {
        toast.error("Sesi/role Inspektur belum valid. Silakan masuk ulang.");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadAll();
    const id = setInterval(loadAll, 3000);
    return () => clearInterval(id);
  }, [allowed, loadAll]);

  async function openDetail(row: MonitorRow) {
    setDetailPeserta(row);
    setDetailData(null);
    setCatatan("");
    setProgresJuri(null);
    setDetailOpen(true);
    supabase.rpc("inspektur_progres_juri" as any, { _peserta: row.peserta_id }).then(({ data, error }) => {
      if (!error) setProgresJuri((data as any[]) ?? []);
    });
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error("Sesi login berakhir. Silakan masuk ulang.");
      setDetailOpen(false);
      window.location.href = "/auth";
      return;
    }
    const { data, error } = await supabase.rpc("inspektur_var_detail" as any, { _peserta: row.peserta_id });
    if (error) {
      const message = error.message.toLowerCase().includes("permission denied") || error.message.toLowerCase().includes("forbidden")
        ? "Sesi/role Inspektur belum valid. Silakan masuk ulang."
        : error.message;
      toast.error(message);
      return;
    }
    const detail = (data as any) ?? {};
    const juriIds = Array.from(new Set(((detail.penilaian ?? []) as any[]).map((p) => p.juri_id).filter(Boolean))) as string[];
    const nilaiJuriEntries = await Promise.all(juriIds.map(async (juriId) => {
      const { data: nilaiJuri } = await supabase.rpc("hitung_nilai_juri" as any, { _peserta: row.peserta_id, _juri: juriId });
      return [juriId, nilaiJuri == null ? null : Number(nilaiJuri)] as const;
    }));
    const { data: nilai } = await supabase.rpc("hitung_nilai_akhir" as any, { _peserta: row.peserta_id });
    setDetailData({ ...detail, nilai_akhir: nilai ?? detail.nilai_akhir, nilai_juri_map: Object.fromEntries(nilaiJuriEntries) });
  }

  async function simpanCatatan() {
    if (!detailPeserta) return;
    if (!catatan.trim()) {
      toast.error("Isi catatan terlebih dahulu");
      return;
    }
    setSavingCatatan(true);
    try {
      const { error } = await supabase.rpc("inspektur_catat" as any, {
        _peserta: detailPeserta.peserta_id,
        _catatan: catatan.trim(),
        _keputusan: "catatan_saja",
      });
      if (error) throw error;
      toast.success("Catatan inspektur tersimpan");
      setDetailOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingCatatan(false);
    }
  }

  async function terapkanPerubahan() {
    if (!detailPeserta) return;
    setTerapkanLoading(true);
    try {
      const { error } = await supabase.rpc("inspektur_terapkan_perbaikan" as any, {
        _peserta: detailPeserta.peserta_id,
        _catatan: catatan.trim() || null,
      });
      if (error) throw error;
      toast.success("Pilihan juri diterapkan · nilai peserta ditetapkan Final");
      setDetailOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menerapkan perubahan");
    } finally {
      setTerapkanLoading(false);
    }
  }


  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function openConfirmBukaPerbaikan(pesertaId: string, nama: string, catatan: string | null, source: "row" | "detail") {
    setConfirmTarget({ pesertaId, nama, catatan, source });
    setConfirmOpen(true);
  }

  async function handleConfirmBukaPerbaikan() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const { error } = await supabase.rpc("inspektur_buka_perhatian" as any, {
        _peserta: confirmTarget.pesertaId,
        _catatan: confirmTarget.catatan || null,
      });
      if (error) throw error;
      toast.success("Form Perhatian dibuka kembali untuk semua juri");
      setConfirmOpen(false);
      if (confirmTarget.source === "detail") setDetailOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuka perbaikan");
    } finally {
      setConfirmLoading(false);
    }
  }

  function openAjukanVar(pesertaId: string, nama: string) {
    setAjukanVarTarget({ pesertaId, nama });
    setAjukanVarAlasan("");
    setAjukanVarOpen(true);
  }
  async function handleAjukanVar() {
    if (!ajukanVarTarget) return;
    if (!ajukanVarAlasan.trim()) { toast.error("Alasan wajib diisi"); return; }
    setAjukanVarLoading(true);
    try {
      const { error } = await supabase.rpc("inspektur_ajukan_var" as any, {
        _peserta: ajukanVarTarget.pesertaId,
        _alasan: ajukanVarAlasan.trim(),
      });
      if (error) throw error;
      toast.success("Pengajuan VAR dikirim — menunggu persetujuan semua juri");
      setAjukanVarOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengajukan VAR");
    } finally {
      setAjukanVarLoading(false);
    }
  }

  function openAkhiri(pesertaId: string, nama: string) {
    setAkhiriTarget({ pesertaId, nama });
    setAkhiriOpen(true);
  }
  async function handleAkhiri() {
    if (!akhiriTarget) return;
    setAkhiriLoading(true);
    try {
      const { error } = await supabase.rpc("inspektur_akhiri_sesi" as any, { _peserta: akhiriTarget.pesertaId });
      if (error) throw error;
      toast.success("Sesi diakhiri · status peserta ditetapkan Final");
      setAkhiriOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengakhiri sesi");
    } finally {
      setAkhiriLoading(false);
    }
  }



  if (allowed === null) return null;
  if (!allowed) return null;

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-card/60 backdrop-blur mb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center gap-4 flex-wrap">
          <div className="grid place-items-center size-12 shrink-0 rounded-full bg-primary text-primary-foreground shadow ring-4 ring-accent/30">
            <Shield className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Pengawas Independen</p>
            <h1 className="text-2xl font-serif font-semibold">Inspektur Pertandingan</h1>
          </div>
          {currentUser && (
            <div className="text-right text-sm mr-2 hidden sm:block">
              <div className="font-semibold leading-tight">{currentUser.nama}</div>
              <div className="text-xs text-muted-foreground">{currentUser.role}{currentUser.email ? ` · ${currentUser.email}` : ""}</div>
            </div>
          )}
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={"size-4 mr-2 " + (loading ? "animate-spin" : "")} /> Muat Ulang
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Ke Dashboard</Button>
          <Button variant="ghost" onClick={signOut}>Keluar</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
        {/* Ringkasan */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <Card><CardHeader className="pb-2"><CardDescription>Total Peserta</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.total_peserta ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sudah Tampil</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.sudah_tampil ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sedang Tampil</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.sedang_tampil ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Belum Tampil</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.belum_tampil ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sesi Aktif</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.sesi_aktif ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sesi Selesai</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{ringkasan?.sesi_selesai ?? "—"}</CardContent></Card>
          <Card className={ringkasan && ringkasan.total_var > 0 ? "border-rose-500" : ""}>
            <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><AlertTriangle className="size-3 text-rose-500" />Potensi VAR</CardDescription></CardHeader>
            <CardContent className="text-2xl font-semibold text-rose-600">{ringkasan?.total_var ?? "—"}</CardContent>
          </Card>
        </div>

        {/* Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpenText className="size-5" /> Monitoring Real-time Peserta</CardTitle>
            <CardDescription>Status setiap peserta beserta progres juri. Diperbarui setiap 3 detik.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Bacaan Mazmur</TableHead>
                  
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitor.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                )}
                {monitor.map((r) => {
                  const v = statusVariant(r.status);
                  const hasActiveVar = r.status === "Potensi VAR" || r.status === "Perbaikan Perhatian" || vars.some((vr) => vr.peserta_id === r.peserta_id);
                  return (
                    <TableRow key={r.peserta_id}>
                      <TableCell className="font-medium">{r.nomor_urut}</TableCell>
                      <TableCell className="font-medium">{r.nama}</TableCell>
                      <TableCell className="text-muted-foreground">{r.kategori || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.bacaan || "—"}</TableCell>
                      <TableCell><Badge className={v.className}>{v.label}</Badge></TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {activeSesiPesertaIds.has(r.peserta_id) && (
                          <>
                            <Button
                              size="sm"
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                              onClick={() => openAjukanVar(r.peserta_id, r.nama)}
                            >
                              <Siren className="size-4 mr-1" /> Ajukan VAR
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openAkhiri(r.peserta_id, r.nama)}
                            >
                              <Square className="size-4 mr-1" /> Akhiri & Finalkan
                            </Button>
                          </>
                        )}
                        {hasActiveVar && (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => openConfirmBukaPerbaikan(r.peserta_id, r.nama, null, "row")}
                          >
                            <AlertTriangle className="size-4 mr-1" /> Buka Perbaikan
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                          <Eye className="size-4 mr-1" /> Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Daftar VAR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-rose-500" /> Daftar Potensi VAR</CardTitle>
            <CardDescription>Peserta dengan perbedaan input Perhatian antar juri (Salah/Menambah/Mengurangi kata).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Bacaan</TableHead>
                  <TableHead>Komponen Berbeda</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vars.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada Potensi VAR saat ini.</TableCell></TableRow>
                )}
                {vars.map((r) => (
                  <TableRow key={r.peserta_id}>
                    <TableCell>{r.nomor_urut}</TableCell>
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell className="text-muted-foreground">{r.kategori || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.bacaan || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {Array.isArray(r.komponen_berbeda) && r.komponen_berbeda.length > 0
                        ? r.komponen_berbeda.map((k) => (
                            <Badge key={k} className="mr-1 bg-rose-600 text-white">{KOMP_LABEL[k] ?? k}</Badge>
                          ))
                        : "—"}
                    </TableCell>

                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => openConfirmBukaPerbaikan(r.peserta_id, r.nama, null, "row")}
                      >
                        <AlertTriangle className="size-4 mr-1" /> Buka Perbaikan
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDetail(monitor.find(m => m.peserta_id === r.peserta_id) ?? { peserta_id: r.peserta_id, nomor_urut: r.nomor_urut, nama: r.nama, kategori: r.kategori, bacaan: null, status: "Potensi VAR", juri_done: 0, juri_total: 0 })}>
                        <Eye className="size-4 mr-1" /> Detail
                      </Button>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail — {detailPeserta ? `${detailPeserta.nomor_urut}. ${detailPeserta.nama}` : ""}</DialogTitle>
            <DialogDescription>Rincian penilaian juri dan Potensi VAR (read-only).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {!detailData && <div className="text-sm text-muted-foreground">Memuat…</div>}
            {detailData && (
              <>
                {detailData.var_session && (
                  <div className="rounded-lg border-2 border-rose-500/60 bg-rose-500/10 p-3">
                    <div className="text-sm font-semibold text-rose-700 mb-1 flex items-center gap-1">
                      <AlertTriangle className="size-4" /> Potensi VAR — menunggu keputusan Inspektur
                    </div>
                    <div className="text-xs text-rose-900 mb-2">
                      Bacaan: <b>{detailData.var_session.bacaan ?? "—"}</b>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(detailData.var_session.komponen_berbeda) && detailData.var_session.komponen_berbeda.length > 0
                        ? (detailData.var_session.komponen_berbeda as string[]).map((k) => (
                            <Badge key={k} className="bg-rose-600 text-white">{KOMP_LABEL[k] ?? k}</Badge>
                          ))
                        : <span className="text-xs text-muted-foreground">Tidak ada komponen tercatat.</span>}
                    </div>
                    <p className="text-[11px] text-rose-800/80 mt-2">
                      Tulis catatan/rekomendasi lalu pilih keputusan (Setujui / Tolak / Catatan Saja). Menyimpan akan menutup Potensi VAR.
                    </p>
                  </div>
                )}

                {detailData.var_session && Array.isArray(detailData.penilaian) && (() => {
                  const KOMP_IDX: Record<string, number> = { salah_kata: 0, menambah_kata: 2, mengurangi_kata: 3 };
                  const komps: string[] = Array.isArray(detailData.var_session.komponen_berbeda)
                    ? detailData.var_session.komponen_berbeda : [];
                  const perhatian = (detailData.penilaian as any[]).filter(
                    (p) => typeof p.kriteria === "string" && p.kriteria.toLowerCase().includes("perhatian"),
                  );
                  const juris = Array.from(
                    new Map(perhatian.map((p) => [p.juri_id, p.juri_nama ?? p.juri_id])).entries(),
                  );
                  if (komps.length === 0 || juris.length === 0) return null;
                  const fmt = (marks: any): string => {
                    if (!Array.isArray(marks) || marks.length === 0) return "—";
                    return marks.map((m: any) => (typeof m === "object" ? (m.ayat ?? JSON.stringify(m)) : m)).join(", ");
                  };
                  return (
                    <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 p-3">
                      <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
                        <AlertTriangle className="size-4" /> Pemicu VAR — Perbedaan jawaban antar juri
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Juri</TableHead>
                              {komps.map((k) => (
                                <TableHead key={k}>{KOMP_LABEL[k] ?? k} <span className="text-[10px] text-muted-foreground">(ayat)</span></TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {juris.map(([jid, jnama]) => {
                              const row = perhatian.find((p) => p.juri_id === jid);
                              const aspek = row?.detail?.aspek ?? [];
                              return (
                                <TableRow key={jid as string}>
                                  <TableCell className="font-medium">{jnama as string}</TableCell>
                                  {komps.map((k) => {
                                    const idx = KOMP_IDX[k];
                                    const marks = aspek?.[idx]?.ditandai;
                                    const val = fmt(marks);
                                    return (
                                      <TableCell key={k} className={val === "—" ? "text-muted-foreground" : "font-mono text-rose-700"}>
                                        {val}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-[11px] text-amber-800/80 mt-2">
                        Sel yang berbeda antar juri pada kolom di atas adalah pemicu Potensi VAR untuk komponen bersangkutan.
                      </p>
                    </div>
                  );
                })()}

                {/* Progres Juri */}
                <div>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <CheckCircle2 className="size-4 text-emerald-600" /> Progres Juri
                  </div>
                  {progresJuri === null ? (
                    <div className="text-xs text-muted-foreground">Memuat…</div>
                  ) : progresJuri.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Belum ada juri terdaftar.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Juri</TableHead>
                          <TableHead>Status Kirim</TableHead>
                          <TableHead className="text-right">Nilai Juri</TableHead>
                          <TableHead className="text-right">Kriteria Terisi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {progresJuri.map((row: any) => (
                          <TableRow key={row.juri_id}>
                            <TableCell className="font-medium">{row.juri_nama}</TableCell>
                            <TableCell>
                              {row.sudah_kirim ? (
                                <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="size-3 mr-1" />Sudah Kirim</Badge>
                              ) : (
                                <Badge className="bg-muted text-foreground"><XCircle className="size-3 mr-1" />Belum Kirim</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.nilai_juri == null ? <span className="text-muted-foreground italic">—</span> : Number(row.nilai_juri).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {Array.isArray(row.penilaian) ? row.penilaian.length : 0} kriteria
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>




                {detailData.penilaian && Array.isArray(detailData.penilaian) && (
                  <div>
                    <div className="text-sm font-semibold mb-2">Ringkasan Nilai Juri</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Juri</TableHead>
                          <TableHead className="text-right">Nilai Juri</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from(new Map((detailData.penilaian as any[]).map((p) => [p.juri_id, p.juri_nama ?? p.juri_id])).entries()).map(([juriId, juriNama]) => {
                          const nilaiJuri = detailData.nilai_juri_map?.[juriId as string];
                          return (
                            <TableRow key={juriId as string}>
                              <TableCell>{juriNama as string}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-primary">
                                {nilaiJuri == null ? <span className="text-muted-foreground italic">belum lengkap</span> : Number(nilaiJuri).toFixed(3)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {detailData.penilaian.length === 0 && (
                      <div className="text-sm text-muted-foreground">Nilai belum dapat ditampilkan (menunggu semua juri mengirim).</div>
                    )}
                  </div>
                )}
                {detailData.penilaian && Array.isArray(detailData.penilaian) && detailData.penilaian.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2">Rincian Nilai per Kriteria</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Juri</TableHead>
                          <TableHead>Kriteria</TableHead>
                          <TableHead className="text-right">Nilai Mentah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.penilaian.map((p: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{p.juri_nama ?? p.juri_id}</TableCell>
                            <TableCell>{p.kriteria_nama ?? p.kriteria_id}</TableCell>
                            <TableCell className="text-right font-mono">{Number(p.nilai).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {detailData.nilai_akhir != null && (
                  <div className="rounded-lg border bg-accent/10 p-3">
                    <div className="text-xs text-muted-foreground">Nilai Akhir</div>
                    <div className="text-2xl font-serif font-semibold">{Number(detailData.nilai_akhir).toFixed(3)}</div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2 pt-2 border-t">
              <div className="text-sm font-semibold">Catatan / Rekomendasi Inspektur</div>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Tuliskan catatan pengawasan…" rows={3} />
              {detailData?.var_session && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Klik <b>Terapkan Perubahan Juri</b> untuk mengganti pilihan lama juri pada 3 parameter pemicu VAR
                  (Salah/Menambah/Mengurangi kata) dengan pilihan terbaru yang dikirim juri, memperbarui Rincian Nilai,
                  dan menetapkan status peserta menjadi <b>Final</b>.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {detailPeserta && activeSesiPesertaIds.has(detailPeserta.peserta_id) && (
              <>
                <Button
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => openAjukanVar(detailPeserta.peserta_id, detailPeserta.nama)}
                >
                  <Siren className="size-4 mr-1" /> Ajukan VAR
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openAkhiri(detailPeserta.peserta_id, detailPeserta.nama)}
                >
                  <Square className="size-4 mr-1" /> Akhiri & Finalkan
                </Button>
              </>
            )}
            {detailData?.var_session && (
              <>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    if (!detailPeserta) return;
                    openConfirmBukaPerbaikan(detailPeserta.peserta_id, detailPeserta.nama, catatan.trim() || null, "detail");
                  }}
                >
                  <AlertTriangle className="size-4 mr-1" /> Buka Perbaikan Perhatian
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={terapkanPerubahan}
                  disabled={terapkanLoading}
                >
                  {terapkanLoading ? "Menerapkan…" : "Terapkan Perubahan Juri & Finalkan"}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
            <Button onClick={simpanCatatan} disabled={savingCatatan}>{savingCatatan ? "Menyimpan…" : "Simpan Catatan"}</Button>
          </DialogFooter>


        </DialogContent>
      </Dialog>

      {/* Konfirmasi Buka Perbaikan Perhatian */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="size-5 text-amber-600" /> Konfirmasi Buka Perbaikan
            </DialogTitle>
            <DialogDescription>
              Anda akan membuka kembali form <b>Perhatian</b> untuk peserta berikut.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-amber-50 p-4 text-sm space-y-2">
            <div className="text-base font-semibold text-amber-950">{confirmTarget?.nama ?? "—"}</div>
            <div className="text-amber-900/80 leading-relaxed">
              Semua juri akan diminta menilai ulang komponen <b>Perhatian</b>. Nilai kriteria lain tetap tersimpan. Lanjutkan?
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="sm:w-auto w-full" onClick={() => setConfirmOpen(false)} disabled={confirmLoading}>Batal</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white sm:w-auto w-full"
              onClick={handleConfirmBukaPerbaikan}
              disabled={confirmLoading}
            >
              {confirmLoading ? "Memproses…" : <><AlertTriangle className="size-4 mr-1" /> Ya, Buka Perbaikan</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajukan VAR Manual */}
      <Dialog open={ajukanVarOpen} onOpenChange={setAjukanVarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800">
              <Siren className="size-5 text-rose-600" /> Ajukan VAR
            </DialogTitle>
            <DialogDescription>
              Ajukan VAR manual untuk <b>{ajukanVarTarget?.nama}</b>. Semua juri akan dimintai persetujuan;
              bila disetujui semua, form penilaian dibuka kembali agar juri dapat mengubah nilai dan mengirim ulang.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm font-medium">Alasan pengajuan VAR</div>
            <Textarea
              value={ajukanVarAlasan}
              onChange={(e) => setAjukanVarAlasan(e.target.value)}
              placeholder="Tuliskan alasan pengajuan VAR (wajib)…"
              rows={4}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAjukanVarOpen(false)} disabled={ajukanVarLoading}>Batal</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleAjukanVar}
              disabled={ajukanVarLoading || !ajukanVarAlasan.trim()}
            >
              {ajukanVarLoading ? "Mengirim…" : <><Siren className="size-4 mr-1" /> Kirim Pengajuan VAR</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Akhiri Sesi & Finalkan */}
      <Dialog open={akhiriOpen} onOpenChange={setAkhiriOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 grid place-items-center size-12 rounded-full bg-destructive/10 text-destructive ring-4 ring-destructive/20">
              <Square className="size-6" />
            </div>
            <DialogTitle className="text-center font-serif text-xl">Akhiri Sesi & Finalkan?</DialogTitle>
            <DialogDescription className="text-center">
              Sesi penilaian untuk <b className="text-foreground">{akhiriTarget?.nama}</b> akan diakhiri dan
              status peserta ditetapkan menjadi <b>Final</b>. Semua VAR aktif untuk peserta ini juga akan difinalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setAkhiriOpen(false)} disabled={akhiriLoading}>Batal</Button>
            <Button variant="destructive" onClick={handleAkhiri} disabled={akhiriLoading} className="gap-2">
              <Square className="size-4" /> {akhiriLoading ? "Memproses…" : "Ya, Akhiri & Finalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
