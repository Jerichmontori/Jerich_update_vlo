import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { ArrowUp, ArrowDown, Play, Square, RefreshCw, BookOpenText, Users, Gavel, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/operator")({
  component: OperatorPage,
});

type Peserta = { id: string; nomor_urut: number; nama: string; asal: string | null; kategori: string | null };
type Mazmur = { id: string; bacaan: string; jumlah_ayat: number; kategori: string | null };
type Sesi = {
  id: string;
  peserta_id: string;
  mazmur_id: string | null;
  kategori: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
};

function OperatorPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [mazmur, setMazmur] = useState<Mazmur[]>([]);
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [selectedPeserta, setSelectedPeserta] = useState<string>("");
  const [selectedMazmur, setSelectedMazmur] = useState<string>("");
  const [juriTotal, setJuriTotal] = useState<number>(0);
  const [juriDone, setJuriDone] = useState<number>(0);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ nama: string; email: string; role: string } | null>(null);


  // Role gate
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setAllowed(false); return; }
      const [{ data: isPan }, { data: isAdm }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "panitia" as any }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any }),
      ]);
      const ok = !!isPan || !!isAdm;
      setAllowed(ok);
      if (!ok) { window.location.href = "/dashboard"; return; }
      const { data: prof } = await supabase.from("profiles").select("nama").eq("id", uid).maybeSingle();
      setCurrentUser({
        nama: prof?.nama ?? (u.user?.email?.split("@")[0] ?? "Pengguna"),
        email: u.user?.email ?? "",
        role: isAdm ? "Admin" : "Panitia",
      });
    })();
  }, []);

  async function loadPeserta() {
    const { data } = await supabase.from("peserta").select("*").order("nomor_urut");
    setPeserta((data ?? []) as Peserta[]);
  }
  async function loadMazmur() {
    const { data } = await supabase.from("mazmur").select("*").order("bacaan");
    setMazmur((data ?? []) as Mazmur[]);
  }
  async function loadJuriCount() {
    const { data } = await supabase
      .from("juri_public" as any)
      .select("id, approved, role")
      .eq("approved", true)
      .eq("role", "juri");
    setJuriTotal((data ?? []).length);
  }
  async function loadSesi() {
    const { data } = await supabase
      .from("sesi_penilaian" as any)
      .select("*")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);
    const rows = (data as any[] | null) ?? [];
    const row = rows[0] as Sesi | undefined;
    setSesi(row ?? null);
    if (row) {
      setSelectedPeserta(row.peserta_id);
      if (row.mazmur_id) setSelectedMazmur(row.mazmur_id);
      const { data: subs } = await supabase
        .from("penilaian_submission" as any)
        .select("juri_id")
        .eq("peserta_id", row.peserta_id);
      const uniq = new Set((subs as any[] | null ?? []).map((s: any) => s.juri_id));
      setJuriDone(uniq.size);
    } else {
      setJuriDone(0);
    }
    // Hitung submission per peserta untuk status "sudah dinilai"
    const { data: allSubs } = await supabase
      .from("penilaian_submission" as any)
      .select("peserta_id, juri_id");
    const map: Record<string, Set<string>> = {};
    ((allSubs as any[] | null) ?? []).forEach((s: any) => {
      (map[s.peserta_id] ??= new Set()).add(s.juri_id);
    });
    const counts: Record<string, number> = {};
    Object.entries(map).forEach(([pid, set]) => { counts[pid] = set.size; });
    setSubmissionCounts(counts);
  }


  useEffect(() => {
    if (!allowed) return;
    loadPeserta();
    loadMazmur();
    loadJuriCount();
    loadSesi();
    const id = setInterval(loadSesi, 3000);
    return () => clearInterval(id);
  }, [allowed]);

  async function logAudit(action: string, extra: Partial<{ session_id: string; peserta_id: string; mazmur_id: string; metadata: any }> = {}) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("nama").eq("id", uid).maybeSingle();
      await supabase.from("operator_audit_log" as any).insert({
        user_id: uid,
        user_nama: prof?.nama ?? null,
        role: "panitia",
        action,
        session_id: extra.session_id ?? null,
        peserta_id: extra.peserta_id ?? null,
        mazmur_id: extra.mazmur_id ?? null,
        metadata: extra.metadata ?? null,
      });
    } catch {
      // silent
    }
  }

  async function pindahkanUrutan(id: string, arah: "atas" | "bawah") {
    const sorted = [...peserta].sort((a, b) => a.nomor_urut - b.nomor_urut);
    const idx = sorted.findIndex(p => p.id === id);
    if (idx < 0) return;
    const swap = arah === "atas" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    setBusy(true);
    // swap nomor_urut via two updates
    const { error: e1 } = await supabase.from("peserta").update({ nomor_urut: -1 }).eq("id", a.id);
    if (e1) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("peserta").update({ nomor_urut: a.nomor_urut }).eq("id", b.id);
    if (e2) { setBusy(false); return toast.error(e2.message); }
    const { error: e3 } = await supabase.from("peserta").update({ nomor_urut: b.nomor_urut }).eq("id", a.id);
    setBusy(false);
    if (e3) return toast.error(e3.message);
    toast.success("Urutan diperbarui");
    logAudit("ubah_urutan", { peserta_id: a.id, metadata: { from: a.nomor_urut, to: b.nomor_urut } });
    loadPeserta();
  }

  async function mulaiSesi() {
    if (!selectedPeserta) return toast.error("Pilih peserta terlebih dahulu");
    if (!selectedMazmur) return toast.error("Pilih Bacaan Mazmur terlebih dahulu");
    setBusy(true);
    const { data, error } = await supabase.rpc("mulai_sesi" as any, {
      _peserta: selectedPeserta,
      _mazmur: selectedMazmur,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const newId = (data as any) as string;
    toast.success("Sesi penilaian dimulai");
    logAudit("pilih_peserta", { peserta_id: selectedPeserta, session_id: newId });
    logAudit("pilih_mazmur", { mazmur_id: selectedMazmur, session_id: newId });
    loadSesi();
  }

  async function akhiriSesi() {
    if (!sesi) return;
    if (!confirm("Akhiri sesi penilaian saat ini?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("akhiri_sesi" as any, { _id: sesi.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sesi diakhiri");
    setSelectedPeserta("");
    setSelectedMazmur("");
    loadSesi();
  }

  async function ubahMazmur() {
    if (!sesi) return;
    if (!selectedMazmur) return toast.error("Pilih Bacaan Mazmur");
    setBusy(true);
    const { error } = await supabase.rpc("ubah_mazmur_sesi" as any, {
      _id: sesi.id,
      _mazmur: selectedMazmur,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bacaan Mazmur diperbarui");
    loadSesi();
  }

  const pesertaAktif = useMemo(
    () => (sesi ? peserta.find(p => p.id === sesi.peserta_id) : null),
    [sesi, peserta]
  );
  const mazmurAktif = useMemo(
    () => (sesi && sesi.mazmur_id ? mazmur.find(m => m.id === sesi.mazmur_id) : null),
    [sesi, mazmur]
  );
  const pesertaTerpilih = useMemo(
    () => peserta.find(p => p.id === selectedPeserta) ?? null,
    [peserta, selectedPeserta]
  );
  const mazmurFiltered = useMemo(() => {
    const kat = pesertaTerpilih?.kategori?.trim().toLowerCase();
    if (!kat) return mazmur;
    return mazmur.filter(m => (m.kategori ?? "").trim().toLowerCase() === kat);
  }, [mazmur, pesertaTerpilih]);
  // Kosongkan pilihan mazmur bila tak sesuai kategori peserta terpilih
  useEffect(() => {
    if (sesi) return;
    if (!selectedMazmur) return;
    if (!mazmurFiltered.some(m => m.id === selectedMazmur)) setSelectedMazmur("");
  }, [mazmurFiltered, selectedMazmur, sesi]);
  const statusPenilaian: "Belum Dimulai" | "Sedang Berlangsung" | "Selesai" =
    !sesi ? "Belum Dimulai" : juriDone >= juriTotal && juriTotal > 0 ? "Selesai" : "Sedang Berlangsung";

  if (allowed === null) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;
  if (!allowed) return null;

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-card/60 backdrop-blur mb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center gap-4">
          <div className="grid place-items-center size-12 shrink-0 rounded-full bg-primary text-primary-foreground shadow ring-4 ring-accent/30">
            <BookOpenText className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Panitia</p>
            <h1 className="text-2xl font-serif font-semibold">Operator Lomba</h1>
          </div>
          <div className="text-right text-sm mr-2 hidden sm:block">
            {currentUser && (
              <>
                <div className="font-semibold leading-tight">{currentUser.nama}</div>
                <div className="text-xs text-muted-foreground">{currentUser.role}{currentUser.email ? ` · ${currentUser.email}` : ""}</div>
              </>
            )}
          </div>
          <Button variant="secondary" onClick={() => (window.location.href = "/inspektur")}>Inspektur</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Ke Dashboard</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Peserta Aktif</CardDescription></CardHeader>
            <CardContent>
              {pesertaAktif ? (
                <div>
                  <div className="text-xs text-muted-foreground">No. {pesertaAktif.nomor_urut}</div>
                  <div className="text-lg font-semibold">{pesertaAktif.nama}</div>
                  <div className="text-sm text-muted-foreground">{pesertaAktif.kategori || "—"}</div>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Belum ada peserta aktif</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Kategori Aktif</CardDescription></CardHeader>
            <CardContent>
              {pesertaAktif?.kategori ? (
                <div className="text-lg font-semibold">{pesertaAktif.kategori}</div>
              ) : (
                <div className="text-muted-foreground text-sm">—</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Bacaan Mazmur Aktif</CardDescription></CardHeader>
            <CardContent>
              {mazmurAktif ? (
                <div>
                  <div className="text-lg font-semibold">{mazmurAktif.bacaan}</div>
                  <div className="text-sm text-muted-foreground">{mazmurAktif.jumlah_ayat} ayat</div>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">—</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Status Penilaian</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <Badge className={
                statusPenilaian === "Sedang Berlangsung" ? "bg-primary" :
                statusPenilaian === "Selesai" ? "bg-accent text-accent-foreground" :
                "bg-muted text-muted-foreground"
              }>{statusPenilaian}</Badge>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Gavel className="size-4" /> {juriDone} dari {juriTotal} juri telah mengirim
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Play className="size-5 text-primary" />Kontrol Sesi</CardTitle>
            <CardDescription>Pilih peserta yang akan tampil dan tentukan Bacaan Mazmur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm font-medium mb-1">Peserta</div>
                <Select value={selectedPeserta} onValueChange={(v) => { setSelectedPeserta(v); logAudit("pilih_peserta", { peserta_id: v }); }} disabled={!!sesi}>
                  <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
                  <SelectContent>
                    {peserta.map(p => {
                      const done = submissionCounts[p.id] ?? 0;
                      const sudah = juriTotal > 0 && done >= juriTotal;
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={sudah}>
                          {p.nomor_urut}. {p.nama}{p.asal ? ` — ${p.asal}` : ""}{sudah ? "  ✓ sudah dinilai" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>

                </Select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Bacaan Mazmur</div>
                <Select value={selectedMazmur} onValueChange={(v) => { setSelectedMazmur(v); logAudit("pilih_mazmur", { mazmur_id: v }); }} disabled={!selectedPeserta && !sesi}>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedPeserta && !sesi ? "Pilih peserta terlebih dahulu" : "Pilih bacaan mazmur"} />
                  </SelectTrigger>
                  <SelectContent>
                    {mazmurFiltered.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Tidak ada Bacaan Mazmur untuk kategori {pesertaTerpilih?.kategori || "ini"}.
                      </div>
                    )}
                    {mazmurFiltered.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.bacaan}{m.kategori ? ` — ${m.kategori}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pesertaTerpilih?.kategori && (
                  <div className="text-xs text-muted-foreground mt-1">Kategori: {pesertaTerpilih.kategori}</div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!sesi && (
                <Button onClick={mulaiSesi} disabled={busy} className="gap-2">
                  <Play className="size-4" /> Mulai Penilaian
                </Button>
              )}
              {sesi && (
                <>
                  <Button onClick={ubahMazmur} variant="outline" disabled={busy} className="gap-2">
                    <RefreshCw className="size-4" /> Ubah Bacaan Mazmur
                  </Button>
                  <Button onClick={akhiriSesi} variant="destructive" disabled={busy} className="gap-2">
                    <Square className="size-4" /> Akhiri Penilaian
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />Daftar Peserta</CardTitle>
            <CardDescription>Atur urutan tampil peserta.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">No.</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Asal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-56">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peserta.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada peserta.</TableCell></TableRow>
                  )}
                  {peserta.map(p => {
                    const done = submissionCounts[p.id] ?? 0;
                    const sudahDinilai = juriTotal > 0 && done >= juriTotal;
                    return (
                      <TableRow key={p.id} className={sudahDinilai ? "opacity-70" : ""}>
                        <TableCell className="font-medium">{p.nomor_urut}</TableCell>
                        <TableCell>{p.nama}</TableCell>
                        <TableCell className="text-muted-foreground">{p.asal || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.kategori || "—"}</TableCell>
                        <TableCell>
                          {sudahDinilai ? (
                            <Badge className="bg-accent text-accent-foreground">Sudah dinilai</Badge>
                          ) : done > 0 ? (
                            <Badge variant="outline">{done}/{juriTotal} juri</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Belum dinilai</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" disabled={busy} onClick={() => pindahkanUrutan(p.id, "atas")}>
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" disabled={busy} onClick={() => pindahkanUrutan(p.id, "bawah")}>
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!sesi || sudahDinilai}
                            title={sudahDinilai ? "Peserta ini sudah dinilai semua juri" : undefined}
                            onClick={() => { setSelectedPeserta(p.id); logAudit("pilih_peserta", { peserta_id: p.id }); toast.success(`Peserta dipilih: ${p.nama}`); }}
                          >
                            {sudahDinilai ? "Selesai" : "Pilih"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
