import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { Shield, ShieldCheck, Users, User } from "lucide-react";

export default function ModeInspekturSetting() {
  const [mode, setMode] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc("get_mode_inspektur" as never).then(({ data, error }: any) => {
      if (error) {
        toast.error("Gagal memuat mode inspektur");
        return;
      }
      setMode(Number(data) || 2);
    });
  }, []);

  async function setModeInsp(newMode: number) {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_mode_inspektur" as never, { _jumlah: newMode } as any);
      if (error) throw error;
      setMode(newMode);
      toast.success(
        newMode === 1
          ? "Mode 1 Inspektur aktif — Inspektur Pertandingan menangani VAR. Pengajuan keberatan dikunci."
          : "Mode 2 Inspektur aktif — Inspektur dan Inspektur VAR berfungsi terpisah. Keberatan dibuka kembali."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah mode");
    } finally {
      setSaving(false);
    }
  }

  if (mode === null) {
    return <div className="text-sm text-muted-foreground py-4">Memuat…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" /> Mode Inspektur
        </CardTitle>
        <CardDescription>
          Atur jumlah inspektur yang bertugas. Mode 1: Inspektur Pertandingan menangani semua tugas VAR (menu keberatan dikunci). Mode 2: Inspektur Pertandingan dan Inspektur VAR berfungsi terpisah.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Mode 1 */}
          <button
            onClick={() => setModeInsp(1)}
            disabled={saving || mode === 1}
            className={`text-left rounded-lg border-2 p-4 transition-all ${
              mode === 1
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <User className="size-5 text-primary" />
              <span className="font-semibold">Mode 1 — Satu Inspektur</span>
              {mode === 1 && <Badge className="bg-primary text-primary-foreground ml-auto">Aktif</Badge>}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inspektur Pertandingan (IP) menangani seluruh tugas: monitoring, keputusan VAR, koreksi per juri, dan pemulihan nilai. Menu keberatan peserta dikunci — IP menyelesaikan langsung.
            </p>
          </button>

          {/* Mode 2 */}
          <button
            onClick={() => setModeInsp(2)}
            disabled={saving || mode === 2}
            className={`text-left rounded-lg border-2 p-4 transition-all ${
              mode === 2
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="size-5 text-primary" />
              <span className="font-semibold">Mode 2 — Dua Inspektur</span>
              {mode === 2 && <Badge className="bg-primary text-primary-foreground ml-auto">Aktif</Badge>}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inspektur Pertandingan fokus pada monitoring & pengakhiran sesi. Inspektur VAR menangani keputusan VAR, koreksi per juri, dan pemulihan nilai. Menu keberatan peserta aktif.
            </p>
          </button>
        </div>

        {mode === 1 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="size-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <b>Mode 1 aktif.</b> Inspektur Pertandingan kini dapat mengakses tool VAR (koreksi per juri, keputusan VAR, pemulihan nilai) langsung dari halaman Inspektur. Pengajuan keberatan peserta dinonaktifkan.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
