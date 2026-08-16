import { useCallback, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import VarPersepsiDetail from "@/components/VarPersepsiDetail";
import { AlertTriangle, Eye, RefreshCw } from "lucide-react";

const KOMP_LABEL: Record<string, string> = {
  clear_text: "Clear Text",
  salah_kata: "Salah kata",
  menambah_kata: "Menambah kata",
  mengurangi_kata: "Mengurangi kata",
  mengulang_kata: "Mengulang kata",
};

type Row = {
  id: string;
  peserta_id: string;
  status: string;
  komponen_berbeda: string[] | null;
  created_at: string;
  nomor_urut: number;
  nama: string;
  kategori: string | null;
};

const PAGE_SIZE = 10;

export default function AdminVarTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("var_clarification_session" as any)
      .select("id, peserta_id, status, komponen_berbeda, created_at, peserta:peserta_id(nomor_urut, nama, kategori)")
      .order("created_at", { ascending: false });
    if (error) return;
    const mapped: Row[] = ((data as any[]) ?? []).map((r: any) => ({
      id: r.id,
      peserta_id: r.peserta_id,
      status: r.status,
      komponen_berbeda: Array.isArray(r.komponen_berbeda) ? r.komponen_berbeda : [],
      created_at: r.created_at,
      nomor_urut: r.peserta?.nomor_urut ?? 0,
      nama: r.peserta?.nama ?? "—",
      kategori: r.peserta?.kategori ?? null,
    }));
    setRows(mapped);
  }, []);

  usePolling(load, 25000);

  const list = rows ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const pageRows = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-rose-500" /> Daftar Potensi VAR
          </CardTitle>
          <CardDescription>
            Peserta dengan perbedaan input Perhatian antar juri. Hanya untuk pemantauan — tidak ada aksi buka perbaikan di sini.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-4 mr-1" /> Muat Ulang
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Komponen Berbeda</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Memuat…</TableCell></TableRow>
            )}
            {rows !== null && list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada Potensi VAR.</TableCell></TableRow>
            )}
            {pageRows.map((r) => {
              const selesai = r.status === "final";
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.nomor_urut}</TableCell>
                  <TableCell className="font-medium">{r.nama}</TableCell>
                  <TableCell className="text-muted-foreground">{r.kategori || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.komponen_berbeda && r.komponen_berbeda.length > 0
                      ? r.komponen_berbeda.map((k) => (
                          <Badge key={k} className="mr-1 bg-rose-600 text-white">{KOMP_LABEL[k] ?? k}</Badge>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={selesai ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}>
                      {selesai ? "Sudah diperbaiki" : "Belum diperbaiki"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                      <Eye className="size-4 mr-1" /> Detail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {list.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-3 text-sm">
            <span className="text-muted-foreground">
              Menampilkan {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, list.length)} dari {list.length} data
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Sebelumnya</Button>
              <span className="text-muted-foreground">Hal. {cur} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>Berikutnya</Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Potensi VAR — {detail ? `${detail.nomor_urut}. ${detail.nama}` : ""}</DialogTitle>
            <DialogDescription>Rincian perbedaan jawaban Perhatian antar juri (hanya lihat).</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={detail.status === "final" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}>
                  {detail.status === "final" ? "Sudah diperbaiki" : "Belum diperbaiki"}
                </Badge>
                {(detail.komponen_berbeda ?? []).map((k) => (
                  <Badge key={k} className="bg-rose-600 text-white">{KOMP_LABEL[k] ?? k}</Badge>
                ))}
              </div>
              <VarPersepsiDetail pesertaId={detail.peserta_id} tone="rose" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
