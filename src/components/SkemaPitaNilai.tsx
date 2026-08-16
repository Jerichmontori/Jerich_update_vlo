import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PitaRow } from "@/components/PitaNilaiTab";

const GRADE_LABEL: Record<string, string> = {
  "1": "Kurang",
  "2": "Cukup",
  "3": "Biasa",
  "4": "Baik",
  "5": "Sangat baik",
};

// Sama dengan public.lookup_nilai (langkah 0,5)
const VALS = [0.05, 0.12, 0.22, 0.36, 0.52, 0.68, 0.81, 0.91, 1.0];
function lookupNilai(grade: number) {
  const g = Math.max(1, Math.min(5, grade));
  const idx = Math.floor((g - 1) / 0.5);
  const frac = (g - 1) / 0.5 - idx;
  if (idx >= 8) return VALS[8];
  return VALS[idx] + (VALS[idx + 1] - VALS[idx]) * frac;
}

const fmt3 = (v: number) => v.toFixed(3).replace(".", ",");

type Band = { label: string; lo: number; hi: number };

export default function SkemaPitaNilai({
  kategori,
  rows,
  gunakan,
}: {
  kategori: string;
  rows: PitaRow[];
  gunakan: boolean;
}) {
  const [bobot, setBobot] = useState({ induk: 100, catatan: 10 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("kriteria").select("nama, bobot");
      if (!data?.length) return;
      let induk = 0;
      let catatan = 0;
      data.forEach((k: any) => {
        const n = String(k.nama || "").toLowerCase();
        const b = Number(k.bobot) || 0;
        if (n.includes("catatan")) catatan = b;
        else if (n.includes("perhatian")) return;
        else induk += b;
      });
      if (induk > 0) setBobot({ induk, catatan });
    })();
  }, []);

  const bands = useMemo(() => {
    const build = (ct: boolean): Band[] =>
      rows
        .filter((r) => r.clear_text === ct && r.aktif)
        .sort((a, b) => a.urutan - b.urutan || Number(a.batas_bawah) - Number(b.batas_bawah))
        .map((r) => ({ label: r.label, lo: Number(r.batas_bawah), hi: Number(r.batas_atas) }));
    return { clear: build(true), tidak: build(false) };
  }, [rows]);

  // n untuk skenario "semua kriteria & catatan diberi grade sama"
  function hitungN(grade: number) {
    const r = lookupNilai(grade);
    const raw = r * bobot.induk + r * r * bobot.catatan;
    return raw / (bobot.induk + bobot.catatan);
  }

  function petakan(n: number, list: Band[]) {
    if (!list.length) return null;
    const idx = Math.min(list.length - 1, Math.max(0, Math.floor(n * list.length)));
    const frac = Math.max(0, Math.min(1, n * list.length - idx));
    const b = list[idx];
    return { band: b, nilai: b.lo + (b.hi - b.lo) * frac };
  }

  const grades = [1, 2, 3, 4, 5];

  function renderTabel(ct: boolean) {
    const list = ct ? bands.clear : bands.tidak;
    if (!list.length) return null;
    return (
      <div className="space-y-2">
        <h4 className="font-semibold">{ct ? "Jika Clear Text" : "Jika Tidak Clear Text"}</h4>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-center">Grade</TableHead>
                <TableHead className="w-28">Kriteria</TableHead>
                <TableHead className="w-24 text-center">Rasio</TableHead>
                <TableHead className="w-24 text-center">n</TableHead>
                <TableHead>Pita yang dituju</TableHead>
                <TableHead className="w-28 text-center">Nilai akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => {
                const n = hitungN(g);
                const hasil = petakan(n, list);
                const sorot = g === 3 || g === 4;
                return (
                  <TableRow key={g} className={sorot ? "bg-primary/5" : undefined}>
                    <TableCell className="text-center font-mono font-semibold">{g}</TableCell>
                    <TableCell>
                      {sorot ? (
                        <Badge variant="default">{GRADE_LABEL[String(g)]}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{GRADE_LABEL[String(g)]}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">{lookupNilai(g).toFixed(3)}</TableCell>
                    <TableCell className="text-center font-mono">{n.toFixed(3)}</TableCell>
                    <TableCell className="text-sm">{hasil?.band.label ?? "—"}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      {hasil ? fmt3(hasil.nilai) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skema Perhitungan Pita Nilai</CardTitle>
        <CardDescription>
          Simulasi bila seluruh kriteria induk dan catatan juri diberi grade yang sama. Baris <b>Biasa (3)</b> dan{" "}
          <b>Baik (4)</b> disorot sebagai acuan utama pemetaan pita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {!gunakan && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
            Kategori ini sedang memakai rumus lama, jadi skema di bawah hanya gambaran bila pita diaktifkan.
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 font-mono text-xs">
          <div>rasio = lookup_nilai(grade) — 1:0,050 · 2:0,220 · 3:0,520 · 4:0,810 · 5:1,000</div>
          <div>
            n = (rasio × {bobot.induk} + rasio² × {bobot.catatan}) ÷ {bobot.induk + bobot.catatan}
          </div>
          <div>indeks pita = floor(n × jumlah pita) · posisi dalam pita = sisa pecahannya</div>
          <div>nilai akhir = batas_bawah + (batas_atas − batas_bawah) × posisi</div>
        </div>

        {renderTabel(false)}
        {renderTabel(true)}

        <p className="text-muted-foreground">
          Kategori {kategori}: grade <b>Biasa</b> mengarah ke pita menengah, sedangkan grade <b>Baik</b> menaikkan
          peserta ke pita atas. Catatan juri menggeser posisi di dalam pita sehingga nilai tidak mudah sama persis.
        </p>
      </CardContent>
    </Card>
  );
}
