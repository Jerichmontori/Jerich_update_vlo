import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy } from "lucide-react";

type AnyRow = Record<string, any>;

export default function Top10PdfButton() {
  const branding = useBranding();
  const [loading, setLoading] = useState(false);

  async function unduh() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        supabase.from("peserta").select("id, nomor_urut, kategori, asal"),
        supabase.rpc("get_ranking" as any),
      ]);
      const peserta = (pRes.data ?? []) as AnyRow[];
      const ranking = (rRes.data ?? []) as AnyRow[];
      const pMap = new Map(peserta.map((x) => [x.id, x]));

      const perKategori = new Map<string, AnyRow[]>();
      ranking
        .filter((r) => r.nilai_akhir != null && Number(r.nilai_akhir) > 0)
        .forEach((r) => {
          const kat = pMap.get(r.peserta_id)?.kategori ?? "Tanpa Kategori";
          if (!perKategori.has(kat)) perKategori.set(kat, []);
          perKategori.get(kat)!.push(r);
        });

      if (perKategori.size === 0) {
        toast.error("Belum ada peserta yang memiliki nilai");
        return;
      }

      const doc = new jsPDF();
      const W = doc.internal.pageSize.getWidth();
      const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      doc.setFontSize(10);
      doc.text("PERINGKAT 10 BESAR SETIAP KATEGORI", W / 2, 20, { align: "center" });
      doc.setFontSize(15);
      doc.text((branding.judul || "Lomba Bermazmur").toUpperCase(), W / 2, 30, { align: "center", maxWidth: W - 30 });
      doc.setFontSize(9);
      doc.text(tanggal, W / 2, 38, { align: "center" });

      let y = 48;
      const kategoriUrut = Array.from(perKategori.keys()).sort();
      kategoriUrut.forEach((kat, idx) => {
        const rows = [...perKategori.get(kat)!]
          .sort((a, b) => Number(b.nilai_akhir) - Number(a.nilai_akhir))
          .slice(0, 10);

        if (idx > 0) {
          y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
          if (y > 240) { doc.addPage(); y = 20; }
        }
        doc.setFontSize(11);
        doc.text(`Kategori: ${kat}`, 14, y);

        autoTable(doc, {
          startY: y + 4,
          head: [["Peringkat", "Nama Peserta", "Asal Jemaat", "Nilai Akhir"]],
          body: rows.map((r, i) => [
            String(i + 1),
            String(r.nama),
            String(r.asal ?? "—"),
            Number(r.nilai_akhir).toFixed(3),
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [123, 45, 38] },
          columnStyles: {
            0: { halign: "center", cellWidth: 22 },
            3: { halign: "right", cellWidth: 26 },
          },
        });
      });

      doc.save(`10-besar-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF 10 besar berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={unduh} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
      Unduh 10 Besar (PDF)
    </Button>
  );
}
