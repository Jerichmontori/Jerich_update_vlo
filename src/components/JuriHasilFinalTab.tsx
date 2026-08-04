import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, FileText, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Hasil = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  asal: string | null;
  kategori: string | null;
  sesi_no: number;
  nilai_juri: number | null;
  penilaian: { kriteria: string | null; nilai: number; detail: any }[];
  masukan: any;
};

export function catatanToRows(masukan: any): [string, string][] {
  if (!masukan) return [];
  if (Array.isArray(masukan)) {
    return masukan.map((m: any, i: number) => [
      m?.ayat === 0 ? "Umum" : String(m?.ayat ?? m?.label ?? i + 1),
      String(m?.catatan ?? m?.teks ?? ""),
    ]);
  }
  if (typeof masukan === "object") {
    return Object.entries(masukan).map(([k, v]) => [k, String(v ?? "")]);
  }
  return [["Catatan", String(masukan)]];
}

export default function JuriHasilFinalTab() {
  const [rows, setRows] = useState<Hasil[] | null>(null);
  const [detail, setDetail] = useState<Hasil | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("juri_hasil_final" as any);
    setRows((data as unknown as Hasil[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function downloadPDF(h: Hasil) {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Hasil Penilaian Saya (Final)", 14, 16);
    doc.setFontSize(10);
    doc.text(`Peserta: ${h.nomor_urut}. ${h.nama}${h.asal ? ` — ${h.asal}` : ""}`, 14, 24);
    doc.text(`Kategori: ${h.kategori ?? "—"}   |   Sesi: ${h.sesi_no}`, 14, 30);
    doc.text(`Nilai Anda: ${h.nilai_juri != null ? Number(h.nilai_juri).toFixed(3) : "—"}`, 14, 36);

    autoTable(doc, {
      startY: 42,
      head: [["Kriteria", "Nilai"]],
      body: h.penilaian.map((p) => [p.kriteria ?? "—", String(p.nilai)]),
    });

    const cat = catatanToRows(h.masukan);
    if (cat.length > 0) {
      autoTable(doc, {
        startY: ((doc as any).lastAutoTable?.finalY ?? 60) + 8,
        head: [["Ayat / Bagian", "Masukan Juri"]],
        body: cat,
      });
    }
    doc.save(`hasil-saya-${h.nomor_urut}-${h.nama}.pdf`);
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><FileText className="size-5" /> Hasil Penilaian Saya</CardTitle>
          <CardDescription>
            Hanya peserta berstatus <b>Final</b> yang Anda nilai. Nilai juri lain tidak ditampilkan.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4 mr-1" />Muat Ulang</Button>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <div className="text-sm text-muted-foreground">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada peserta final yang Anda nilai.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Sesi</TableHead>
                <TableHead className="text-right">Nilai Anda</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.peserta_id}>
                  <TableCell>{h.nomor_urut}</TableCell>
                  <TableCell>
                    <div className="font-medium">{h.nama}</div>
                    <div className="text-xs text-muted-foreground">{h.asal ?? ""}{h.kategori ? ` · ${h.kategori}` : ""}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">Sesi {h.sesi_no}</Badge></TableCell>
                  <TableCell className="text-right font-mono">
                    {h.nilai_juri != null ? Number(h.nilai_juri).toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setDetail(h)}><Eye className="size-4 mr-1" />Detail</Button>
                    <Button size="sm" onClick={() => downloadPDF(h)}><FileText className="size-4 mr-1" />PDF</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.nomor_urut}. ${detail.nama}` : ""}</DialogTitle>
            <DialogDescription>Rincian penilaian Anda sendiri (final).</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="text-sm">
                Nilai Anda:{" "}
                <b className="font-mono">{detail.nilai_juri != null ? Number(detail.nilai_juri).toFixed(3) : "—"}</b>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Kriteria</TableHead><TableHead className="text-right">Nilai</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {detail.penilaian.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.kriteria ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{p.nilai}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {catatanToRows(detail.masukan).length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-1">Masukan Juri per Ayat</div>
                  <ul className="text-sm space-y-1">
                    {catatanToRows(detail.masukan).map(([k, v], i) => (
                      <li key={i}><span className="text-muted-foreground">{k}:</span> {v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
