import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type PitaItem = {
  clear_text: boolean;
  index: number;
  total: number;
  label: string;
  deskripsi: string | null;
  batas_bawah: number;
  batas_atas: number;
};

type Preview = {
  ready: boolean;
  gunakan: boolean;
  kategori?: string | null;
  clear_text_status?: "clear" | "tidak" | "belum";
  pita?: PitaItem[];
};

const fmt = (v: number) => Number(v).toFixed(3).replace(".", ",");

export default function PratinjauPita({
  pesertaId,
  juriId,
  refreshKey,
}: {
  pesertaId?: string | null;
  juriId?: string | null;
  refreshKey?: string | number;
}) {
  const [data, setData] = useState<Preview | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!pesertaId || !juriId) {
        setData(null);
        return;
      }
      const { data: res, error } = await supabase.rpc("preview_pita_juri" as any, {
        _peserta: pesertaId,
        _juri: juriId,
      });
      if (cancel || error) return;
      setData((res as any) ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [pesertaId, juriId, refreshKey]);

  if (!data?.ready || !data.gunakan) return null;
  const items = data.pita ?? [];
  if (!items.length) return null;

  const status = data.clear_text_status ?? "belum";
  const utama =
    status === "clear"
      ? items.find((p) => p.clear_text)
      : status === "tidak"
        ? items.find((p) => !p.clear_text)
        : null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Perkiraan Pita Nilai
          </span>
          <Badge variant="outline">Dari 4 kriteria utama</Badge>
        </div>

        {utama ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {fmt(utama.batas_bawah)} – {fmt(utama.batas_atas)}
              </Badge>
              <span className="font-medium">{utama.label}</span>
              <span className="text-xs text-muted-foreground">
                (pita {utama.index} dari {utama.total} · {utama.clear_text ? "clear text" : "tidak clear text"})
              </span>
            </div>
            {utama.deskripsi && (
              <div className="text-xs text-muted-foreground">{utama.deskripsi}</div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Status Clear Text belum diisi. Berikut perkiraan untuk kedua kemungkinan:
            </div>
            {items.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Badge variant={p.clear_text ? "default" : "outline"}>
                  {p.clear_text ? "Clear text" : "Tidak clear text"}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  {fmt(p.batas_bawah)} – {fmt(p.batas_atas)}
                </Badge>
                <span className="text-xs">{p.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          Pita ditentukan hanya oleh 4 kriteria utama. Catatan Juri hanya menggeser nilai
          <span className="font-medium"> di dalam pita ini</span> — hasil akhir tidak akan keluar dari
          rentang di atas.
        </div>
      </CardContent>
    </Card>
  );
}
