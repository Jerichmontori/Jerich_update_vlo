import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Radio, RefreshCw, CheckCircle2, XCircle, Clock, Eye, EyeOff } from "lucide-react";

type JuriStatus = { juri_id: string; nama: string; sudah_vote: boolean; setuju: boolean | null };
export type SesiRow = {
  sesi_no: number;
  total: number;
  final_count: number;
  peserta: { nomor_urut: number; nama: string; final: boolean }[];
  status: "draft" | "menunggu_persetujuan" | "disetujui" | "ditolak" | string;
  hidden?: boolean;
  requested_at: string | null;
  approved_at: string | null;
  juri_total: number;
  setuju_count: number;
  tolak_count: number;
  juri_status: JuriStatus[];
};

function statusBadge(s: string) {
  switch (s) {
    case "disetujui": return { label: "Tayang di Live", className: "bg-emerald-600 text-white" };
    case "menunggu_persetujuan": return { label: "Menunggu Persetujuan Juri", className: "bg-amber-500 text-white" };
    case "ditolak": return { label: "Ditolak Juri", className: "bg-rose-600 text-white" };
    default: return { label: "Belum Diajukan", className: "bg-muted text-foreground" };
  }
}

export default function SesiLiveRanking() {
  const [rows, setRows] = useState<SesiRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = (rows ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("live_ranking_sesi_list" as any);
    if (error) return;
    setRows((data as unknown as SesiRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  async function ajukan(sesi: number) {
    setBusy(sesi);
    const { error } = await supabase.rpc("inspektur_ajukan_live_ranking" as any, { _sesi: sesi });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Sesi ${sesi} sekarang tayang di Live Ranking.`);
    load();
  }

  async function batalkan(sesi: number) {
    setBusy(sesi);
    const { error } = await supabase.rpc("inspektur_batalkan_live_ranking" as any, { _sesi: sesi });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Sesi ${sesi} ditarik dari Live Ranking.`);
    load();
  }

  async function setHidden(sesi: number, hidden: boolean) {
    setBusy(sesi);
    const { error } = await supabase.rpc("inspektur_set_hide_live_ranking" as any, { _sesi: sesi, _hidden: hidden });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(hidden ? `Sesi ${sesi} disembunyikan dari Live Ranking.` : `Sesi ${sesi} ditampilkan kembali.`);
    load();
  }

  async function bulk(action: "tayang" | "tarik") {
    if (!rows?.length || bulkBusy) return;
    setBulkBusy(true);
    let ok = 0;
    for (const r of rows) {
      if (action === "tarik" && r.status === "draft") continue;
      const rpc = action === "tayang" ? "inspektur_ajukan_live_ranking" : "inspektur_batalkan_live_ranking";
      const { error } = await supabase.rpc(rpc as any, { _sesi: r.sesi_no });
      if (!error) ok++;
    }
    setBulkBusy(false);
    toast.success(action === "tayang" ? `${ok} sesi ditayangkan di Live Ranking.` : `${ok} sesi ditarik dari Live Ranking.`);
    load();
  }


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Radio className="size-5 text-accent" /> Sesi Live Ranking</CardTitle>
          <CardDescription>
            Satu sesi = 10 peserta. Inspektur dan Admin dapat langsung menayangkan sesi tertentu
            atau seluruh sesi di Live Ranking tanpa menunggu persetujuan juri, dan bisa menarik
            atau menyembunyikannya kapan saja.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={bulkBusy || !rows?.length} onClick={() => bulk("tayang")}>
            <Eye className="size-4 mr-1" />Tayangkan Semua Sesi
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkBusy || !rows?.length} onClick={() => bulk("tarik")}>
            <EyeOff className="size-4 mr-1" />Tarik Semua
          </Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4 mr-1" />Muat Ulang</Button>
        </div>
      </CardHeader>

      <CardContent>
        {rows === null ? (
          <div className="text-sm text-muted-foreground">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada peserta terdaftar.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sesi</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Final</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Masukan Juri</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => {
                const sb = statusBadge(r.status);
                const lengkap = r.final_count >= r.total;
                const belum = r.juri_status.filter((j) => !j.sudah_vote);
                const tolak = r.juri_status.filter((j) => j.sudah_vote && j.setuju === false);
                return (
                  <Fragment key={r.sesi_no}>
                    <TableRow>
                      <TableCell className="font-semibold">Sesi {r.sesi_no}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        No. {r.peserta[0]?.nomor_urut}–{r.peserta[r.peserta.length - 1]?.nomor_urut} ({r.total} peserta)
                      </TableCell>
                      <TableCell>
                        <span className={lengkap ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                          {r.final_count}/{r.total}
                        </span>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Badge className={sb.className}>{sb.label}</Badge>
                        {r.status === "disetujui" && r.hidden && (
                          <div><Badge className="bg-slate-500 text-white">Disembunyikan</Badge></div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.status === "draft" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-3" />{r.setuju_count}</span>
                              <span className="inline-flex items-center gap-1 text-rose-700"><XCircle className="size-3" />{r.tolak_count}</span>
                              <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="size-3" />{belum.length} belum</span>
                            </div>
                            {belum.length > 0 && (
                              <div className="text-[11px] text-amber-700">
                                Belum menyetujui: {belum.map((j) => j.nama).join(", ")}
                              </div>
                            )}
                            {tolak.length > 0 && (
                              <div className="text-[11px] text-rose-700">
                                Menolak: {tolak.map((j) => j.nama).join(", ")}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === r.sesi_no ? null : r.sesi_no)}>
                          {expanded === r.sesi_no ? "Tutup" : "Detail"}
                        </Button>
                        {r.status === "disetujui" && (
                          <Button
                            size="sm"
                            variant={r.hidden ? "default" : "secondary"}
                            disabled={busy === r.sesi_no}
                            onClick={() => setHidden(r.sesi_no, !r.hidden)}
                          >
                            {r.hidden ? <><Eye className="size-4 mr-1" />Tampilkan</> : <><EyeOff className="size-4 mr-1" />Sembunyikan</>}
                          </Button>
                        )}
                        {r.status === "disetujui" || r.status === "menunggu_persetujuan" ? (
                          <Button size="sm" variant="outline" disabled={busy === r.sesi_no} onClick={() => batalkan(r.sesi_no)}>
                            Tarik
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy === r.sesi_no} onClick={() => ajukan(r.sesi_no)}>
                            Tampilkan di Live
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded === r.sesi_no && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-secondary/40">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold mb-1">Peserta Sesi {r.sesi_no}</div>
                              <ul className="text-xs space-y-0.5">
                                {r.peserta.map((p) => (
                                  <li key={p.nomor_urut} className="flex items-center gap-2">
                                    <span className="w-8 text-muted-foreground">{p.nomor_urut}.</span>
                                    <span className="flex-1">{p.nama}</span>
                                    <Badge className={p.final ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}>
                                      {p.final ? "Final" : "Belum"}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-xs font-semibold mb-1">Status Persetujuan Juri</div>
                              <ul className="text-xs space-y-0.5">
                                {r.juri_status.map((j) => (
                                  <li key={j.juri_id} className="flex items-center gap-2">
                                    <span className="flex-1">{j.nama}</span>
                                    {!j.sudah_vote ? (
                                      <Badge className="bg-amber-500 text-white">Belum menyetujui</Badge>
                                    ) : j.setuju ? (
                                      <Badge className="bg-emerald-600 text-white">Setuju</Badge>
                                    ) : (
                                      <Badge className="bg-rose-600 text-white">Menolak</Badge>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
        {rows && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-3 text-sm">
            <span className="text-muted-foreground">
              Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} dari {rows.length} sesi
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
              <span className="text-muted-foreground">Hal. {page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
