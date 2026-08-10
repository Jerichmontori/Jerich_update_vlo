import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Loader2, Plus, X } from "lucide-react";

type AnyRow = Record<string, any>;

export default function LaporanPertanggungjawabanButton() {
  const branding = useBranding();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [pilihKategori, setPilihKategori] = useState<string[]>([]);
  const [lingkup, setLingkup] = useState<"top10" | "semua">("top10");
  const [rincian, setRincian] = useState(true);
  const [pengesahan, setPengesahan] = useState(true);
  const [jemaat, setJemaat] = useState("");
  const [juriNama, setJuriNama] = useState<string[]>([""]);
  const [inspektur, setInspektur] = useState("");
  const [ketuaPelaksana, setKetuaPelaksana] = useState("");
  const [ketuaBpmj, setKetuaBpmj] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: ps }, { data: jr }] = await Promise.all([
        supabase.from("peserta").select("kategori"),
        supabase.from("juri_public" as any).select("nama, jabatan, aktif_menilai, is_dummy").order("nama"),
      ]);
      const kats = Array.from(new Set(((ps ?? []) as AnyRow[]).map((x) => x.kategori).filter(Boolean))) as string[];
      kats.sort();
      setKategoriList(kats);
      setPilihKategori((prev) => (prev.length ? prev : kats));
      const juri = ((jr ?? []) as AnyRow[]).filter((j) => !j.is_dummy && j.aktif_menilai !== false).map((j) => j.nama);
      if (juri.length) setJuriNama((prev) => (prev.filter(Boolean).length ? prev : juri));
    })();
  }, [open]);

  function toggleKategori(k: string) {
    setPilihKategori((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function buatLaporan() {
    if (pilihKategori.length === 0) { toast.error("Pilih minimal satu kategori"); return; }
    setLoading(true);
    try {
      const [pRes, rRes, jRes, kRes, nRes] = await Promise.all([
        supabase.from("peserta").select("*").order("nomor_urut"),
        supabase.rpc("get_ranking" as any),
        supabase.from("juri_public" as any).select("*"),
        supabase.from("kriteria").select("*"),
        rincian ? supabase.rpc("admin_list_penilaian" as any) : Promise.resolve({ data: [] } as any),
      ]);

      const peserta = (pRes.data ?? []) as AnyRow[];
      const ranking = (rRes.data ?? []) as AnyRow[];
      const juri = (jRes.data ?? []) as AnyRow[];
      const kriteria = (kRes.data ?? []) as AnyRow[];
      const penilaian = (nRes.data ?? []) as AnyRow[];

      const pMap = new Map(peserta.map((x) => [x.id, x]));
      const jMap = new Map(juri.map((x) => [x.id, x]));
      const kMap = new Map(kriteria.map((x) => [x.id, x]));

      const dinilai = ranking.filter((r) => r.nilai_akhir != null && Number(r.nilai_akhir) > 0);
      const perKategori = new Map<string, AnyRow[]>();
      dinilai.forEach((r) => {
        const kat = pMap.get(r.peserta_id)?.kategori ?? "Tanpa Kategori";
        if (!pilihKategori.includes(kat)) return;
        if (!perKategori.has(kat)) perKategori.set(kat, []);
        perKategori.get(kat)!.push(r);
      });

      if (perKategori.size === 0) { toast.error("Tidak ada peserta bernilai pada kategori terpilih"); setLoading(false); return; }

      const doc = new jsPDF();
      const W = doc.internal.pageSize.getWidth();
      const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      // Sampul
      doc.setFontSize(11);
      doc.text("LAPORAN PERTANGGUNGJAWABAN", W / 2, 60, { align: "center" });
      doc.setFontSize(17);
      doc.text("PENILAIAN " + (branding.judul || "LOMBA BERMAZMUR").toUpperCase(), W / 2, 72, { align: "center", maxWidth: W - 40 });
      doc.setFontSize(11);
      if (jemaat) doc.text(`Jemaat ${jemaat}`, W / 2, 86, { align: "center" });
      doc.setFontSize(10);
      doc.text(
        lingkup === "top10" ? "Rekapitulasi 10 Besar Setiap Kategori" : "Rekapitulasi Seluruh Peserta Setiap Kategori",
        W / 2, 100, { align: "center" },
      );
      doc.text(`Kategori: ${pilihKategori.join(", ")}`, W / 2, 108, { align: "center", maxWidth: W - 40 });
      doc.text(tanggal, W / 2, 124, { align: "center" });

      // Rekap ringkas
      doc.addPage();
      doc.setFontSize(12);
      doc.text("A. REKAPITULASI PENILAIAN", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Kategori", "Peserta Dinilai", "Nilai Tertinggi", "Nilai Terendah"]],
        body: Array.from(perKategori.entries()).map(([kat, rows]) => {
          const nilai = rows.map((r) => Number(r.nilai_akhir));
          return [kat, String(rows.length), Math.max(...nilai).toFixed(3), Math.min(...nilai).toFixed(3)];
        }),
        styles: { fontSize: 9 },
      });

      // Daftar nilai & peringkat
      let firstSec = true;
      Array.from(perKategori.entries()).forEach(([kat, rowsAll]) => {
        const sorted = [...rowsAll].sort((a, b) => Number(b.nilai_akhir) - Number(a.nilai_akhir) || Number(b.juri_spread ?? 0) - Number(a.juri_spread ?? 0));
        const rows = lingkup === "top10" ? sorted.slice(0, 10) : sorted;
        doc.addPage();
        if (firstSec) { doc.setFontSize(12); doc.text("B. DAFTAR NILAI DAN PERINGKAT", 14, 18); firstSec = false; }
        doc.setFontSize(11);
        doc.text(`Kategori: ${kat}`, 14, firstSec ? 18 : 28);
        autoTable(doc, {
          startY: 34,
          head: [["Peringkat", "No", "Nama Peserta", "Asal", "Jumlah Juri", "Nilai Akhir"]],
          body: rows.map((r, i) => [
            String(i + 1), String(r.nomor_urut), String(r.nama), String(r.asal ?? "—"),
            String(r.jumlah_juri ?? "—"), Number(r.nilai_akhir).toFixed(3),
          ]),
          styles: { fontSize: 9 },
        });

        if (rincian) {
          const kriteriaNama = kriteria.map((k) => k.nama);
          rows.forEach((r) => {
            const rows2 = penilaian.filter((n) => n.peserta_id === r.peserta_id);
            if (!rows2.length) return;
            const byJuri = new Map<string, AnyRow[]>();
            rows2.forEach((n) => {
              if (!byJuri.has(n.juri_id)) byJuri.set(n.juri_id, []);
              byJuri.get(n.juri_id)!.push(n);
            });
            const y = ((doc as any).lastAutoTable?.finalY ?? 40) + 8;
            autoTable(doc, {
              startY: y > 250 ? 20 : y,
              head: [[`${r.nomor_urut}. ${r.nama}`, ...kriteriaNama]],
              body: Array.from(byJuri.entries()).map(([jid, list]) => [
                jMap.get(jid)?.nama ?? "Juri",
                ...kriteria.map((k) => {
                  const v = list.find((n) => n.kriteria_id === k.id);
                  return v ? String(v.nilai) : "—";
                }),
              ]),
              styles: { fontSize: 8 },
              headStyles: { fontSize: 8 },
            });
            void kMap;
          });
        }
      });

      // Lembar pengesahan
      if (pengesahan) {
        doc.addPage();
        doc.setFontSize(12);
        doc.text("LEMBAR PENGESAHAN", W / 2, 24, { align: "center" });
        doc.setFontSize(10);
        doc.text(
          `Hasil penilaian ${branding.judul || "Lomba Bermazmur"}${jemaat ? ` Jemaat ${jemaat}` : ""} sebagaimana tercantum dalam laporan ini telah diperiksa dan disahkan oleh:`,
          14, 36, { maxWidth: W - 28 },
        );

        const namaJuri = juriNama.map((s) => s.trim()).filter(Boolean);
        let y = 52;
        doc.setFontSize(11);
        doc.text("DEWAN JURI", 14, y);
        y += 6;
        namaJuri.forEach((n, i) => {
          const col = i % 2;
          const x = col === 0 ? 20 : W / 2 + 6;
          if (col === 0 && i > 0) y += 34;
          doc.setFontSize(9);
          doc.text(`Juri ${i + 1}`, x, y);
          doc.setFontSize(10);
          doc.text("(............................................)", x, y + 22);
          doc.text(n, x, y + 28);
        });
        y += 44;

        const blok: [string, string][] = [
          ["Inspektur Pertandingan", inspektur],
          ["Ketua Tim Pelaksana", ketuaPelaksana],
          [`Ketua BPMJ${jemaat ? ` Jemaat ${jemaat}` : ""}`, ketuaBpmj],
        ];
        blok.forEach(([jab, nm], i) => {
          if (y > 240) { doc.addPage(); y = 24; }
          const x = i % 2 === 0 ? 20 : W / 2 + 6;
          if (i % 2 === 0 && i > 0) y += 40;
          doc.setFontSize(9);
          doc.text(jab, x, y, { maxWidth: W / 2 - 26 });
          doc.setFontSize(10);
          doc.text("(............................................)", x, y + 24);
          doc.text(nm || "………………………………", x, y + 30);
        });
      }

      doc.save(`laporan-pertanggungjawaban-${lingkup === "top10" ? "10besar" : "semua"}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Laporan berhasil dibuat");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat laporan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="size-4" /> Laporan LPJ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Laporan Pertanggungjawaban</DialogTitle>
          <DialogDescription>Pilih data yang akan dilaporkan dan isi lembar pengesahan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lingkup data</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant={lingkup === "top10" ? "default" : "outline"} size="sm" onClick={() => setLingkup("top10")}>
                10 Besar setiap kategori
              </Button>
              <Button type="button" variant={lingkup === "semua" ? "default" : "outline"} size="sm" onClick={() => setLingkup("semua")}>
                Seluruh peserta setiap kategori
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {kategoriList.length === 0 && <span className="text-sm text-muted-foreground">Memuat kategori…</span>}
              {kategoriList.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pilihKategori.includes(k)} onCheckedChange={() => toggleKategori(k)} />
                  {k}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="lpj-rincian" className="text-sm font-normal">Sertakan rincian nilai per juri</Label>
            <Switch id="lpj-rincian" checked={rincian} onCheckedChange={setRincian} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="lpj-sah" className="text-sm font-normal">Sertakan lembar pengesahan</Label>
            <Switch id="lpj-sah" checked={pengesahan} onCheckedChange={setPengesahan} />
          </div>

          {pengesahan && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1">
                <Label>Nama Jemaat</Label>
                <Input value={jemaat} onChange={(e) => setJemaat(e.target.value)} placeholder="cth. Imanuel Winangun" />
              </div>
              <div className="space-y-2">
                <Label>Nama Juri</Label>
                {juriNama.map((n, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={n}
                      onChange={(e) => setJuriNama((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                      placeholder={`Juri ${i + 1}`}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setJuriNama((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setJuriNama((prev) => [...prev, ""])}>
                  <Plus className="size-4 mr-1" /> Tambah Juri
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Inspektur Pertandingan</Label>
                <Input value={inspektur} onChange={(e) => setInspektur(e.target.value)} placeholder="Nama inspektur" />
              </div>
              <div className="space-y-1">
                <Label>Ketua Tim Pelaksana</Label>
                <Input value={ketuaPelaksana} onChange={(e) => setKetuaPelaksana(e.target.value)} placeholder="Nama ketua pelaksana" />
              </div>
              <div className="space-y-1">
                <Label>Ketua Badan Pekerja (BPMJ)</Label>
                <Input value={ketuaBpmj} onChange={(e) => setKetuaBpmj(e.target.value)} placeholder="Nama ketua BPMJ" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={buatLaporan} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            Buat Laporan PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
