import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Pita = {
  clear_text: boolean;
  label: string;
  batas_bawah: number;
  batas_atas: number;
  urutan: number;
  deskripsi: string | null;
  aktif: boolean;
};

const fmt = (v: number) => Number(v).toFixed(3).replace(".", ",");

export default function PitaNilaiPanduan({ kategori }: { kategori?: string | null }) {
  const [rows, setRows] = useState<Pita[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!kategori) {
        setRows([]);
        return;
      }
      const { data, error } = await supabase.rpc("get_pita_nilai", { _kategori: kategori });
      if (cancel || error) return;
      const obj = (data as any) ?? {};
      // Kategori dengan pita dimatikan tidak menampilkan panduan.
      if (obj.gunakan === false) {
        setRows([]);
        return;
      }
      const arr: any[] = Array.isArray(obj) ? obj : obj.pita ?? [];
      setRows(arr.filter((p) => p.aktif !== false) as Pita[]);
    })();
    return () => {
      cancel = true;
    };
  }, [kategori]);

  if (!rows.length) return null;

  const group = (ct: boolean) =>
    rows.filter((r) => !!r.clear_text === ct).sort((a, b) => a.urutan - b.urutan);

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Panduan Pita Nilai — {kategori}</CardTitle>
        <CardDescription>Acuan rentang nilai akhir berdasarkan status clear text.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {[false, true].map((ct) => {
          const items = group(ct);
          if (!items.length) return null;
          return (
            <div key={String(ct)} className="space-y-2">
              <div className="font-medium">{ct ? "Clear text" : "Tidak clear text"}</div>
              <ul className="space-y-1">
                {items.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {p.batas_bawah === p.batas_atas
                        ? fmt(p.batas_bawah)
                        : `${fmt(p.batas_bawah)} – ${fmt(p.batas_atas)}`}
                    </Badge>
                    <span className="font-medium">{p.label}</span>
                    {p.deskripsi && <span className="text-muted-foreground">— {p.deskripsi}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
