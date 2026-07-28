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
import { Shield, RefreshCw, BookOpenText, AlertTriangle, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inspektur")({
  component: InspekturPage,
  head: () => ({
    meta: [
      { title: "Inspektur Pertandingan · Sistem Penjurian" },
      { name: "description", content: "Pengawas independen: monitoring peserta, juri, dan Potensi VAR secara real-time." },
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
  const [keputusan, setKeputusan] = useState<"disetujui" | "ditolak" | "">("");
  const [savingCatatan, setSavingCatatan] = useState(false);

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
      const [r, m, v] = await Promise.all([
        supabase.rpc("inspektur_ringkasan" as any),
        supabase.rpc("inspektur_monitor" as any),
        supabase.rpc("inspektur_list_var" as any),
      ]);
      if (r.error) throw r.error;
      if (m.error) throw m.error;
      if (v.error) throw v.error;
      if (r.data && (r.data as any[])[0]) setRingkasan((r.data as any[])[0] as Ringkasan);
      setMonitor(((m.data as any[]) ?? []) as MonitorRow[]);
      setVars(((v.data as any[]) ?? []) as VarRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data");
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
    setKeputusan("");
    setDetailOpen(true);
    const { data, error } = await supabase.rpc("inspektur_var_detail" as any, { _peserta: row.peserta_id });
    if (error) { toast.error(error.message); return; }
    setDetailData(data);
  }

  async function simpanCatatan() {
    if (!detailPeserta) return;
    if (!catatan.trim() && !keputusan) {
      toast.error("Isi catatan atau pilih keputusan");
      return;
    }
    setSavingCatatan(true);
    try {
      const hasActiveVar = !!(detailData && detailData.var_session);
      const keputusanFinal = keputusan || "catatan_saja";
      if (hasActiveVar) {
        const { error } = await supabase.rpc("inspektur_selesaikan_var" as any, {
          _peserta: detailPeserta.peserta_id,
          _catatan: catatan.trim() || null,
          _keputusan: keputusanFinal,
        });
        if (error) throw error;
        toast.success("Potensi VAR diselesaikan · catatan tersimpan");
      } else {
        const { error } = await supabase.rpc("inspektur_catat" as any, {
          _peserta: detailPeserta.peserta_id,
          _catatan: catatan.trim() || null,
          _keputusan: keputusanFinal,
        });
        if (error) throw error;
        toast.success("Catatan inspektur tersimpan");
      }
      setDetailOpen(false);
      loadAll();

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingCatatan(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function bukaPerbaikanPerhatian(pesertaId: string, nama: string) {
    if (!confirm(`Buka kembali form Perhatian untuk ${nama}? Semua juri akan diminta menilai ulang komponen Perhatian. Nilai kriteria lain tetap tersimpan.`)) return;
    const { error } = await supabase.rpc("inspektur_buka_perhatian" as any, { _peserta: pesertaId, _catatan: null });
    if (error) { toast.error(error.message); return; }
    toast.success("Form Perhatian dibuka kembali untuk semua juri");
    loadAll();
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
                  <TableHead>Progres Juri</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitor.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
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
                      <TableCell>{r.juri_done} / {r.juri_total} juri</TableCell>
                      <TableCell><Badge className={v.className}>{v.label}</Badge></TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {hasActiveVar && (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => bukaPerbaikanPerhatian(r.peserta_id, r.nama)}
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
                        onClick={() => bukaPerbaikanPerhatian(r.peserta_id, r.nama)}
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


                {detailData.penilaian && Array.isArray(detailData.penilaian) && (
                  <div>
                    <div className="text-sm font-semibold mb-2">Nilai per Juri</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Juri</TableHead>
                          <TableHead>Kriteria</TableHead>
                          <TableHead className="text-right">Nilai</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.penilaian.map((p: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{p.juri_nama ?? p.juri_id}</TableCell>
                            <TableCell>{p.kriteria_nama ?? p.kriteria_id}</TableCell>
                            <TableCell className="text-right font-mono">{p.nilai}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {detailData.penilaian.length === 0 && (
                      <div className="text-sm text-muted-foreground">Nilai belum dapat ditampilkan (menunggu semua juri mengirim).</div>
                    )}
                  </div>
                )}
                {detailData.nilai_akhir != null && (
                  <div className="rounded-lg border bg-accent/10 p-3">
                    <div className="text-xs text-muted-foreground">Nilai Akhir</div>
                    <div className="text-2xl font-serif font-semibold">{Number(detailData.nilai_akhir).toFixed(2)}</div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2 pt-2 border-t">
              <div className="text-sm font-semibold">Catatan / Rekomendasi Inspektur</div>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Tuliskan catatan pengawasan…" rows={3} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Keputusan (opsional):</span>
                <Button size="sm" variant={keputusan === "disetujui" ? "default" : "outline"} onClick={() => setKeputusan(keputusan === "disetujui" ? "" : "disetujui")}>Setujui</Button>
                <Button size="sm" variant={keputusan === "ditolak" ? "destructive" : "outline"} onClick={() => setKeputusan(keputusan === "ditolak" ? "" : "ditolak")}>Tolak</Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {detailData?.var_session && (
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={async () => {
                  if (!detailPeserta) return;
                  if (!confirm("Buka kembali form Perhatian bagi semua juri untuk peserta ini? Nilai kriteria lain tetap tersimpan.")) return;
                  const { error } = await supabase.rpc("inspektur_buka_perhatian" as any, {
                    _peserta: detailPeserta.peserta_id,
                    _catatan: catatan.trim() || null,
                  });
                  if (error) { toast.error(error.message); return; }
                  toast.success("Form Perhatian dibuka kembali untuk semua juri");
                  setDetailOpen(false);
                  loadAll();
                }}
              >
                <AlertTriangle className="size-4 mr-1" /> Buka Perbaikan Perhatian
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
            <Button onClick={simpanCatatan} disabled={savingCatatan}>{savingCatatan ? "Menyimpan…" : "Simpan Catatan"}</Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}
