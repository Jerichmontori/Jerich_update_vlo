import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Timer } from "lucide-react";

type Cfg = { mode: "off" | "relative" | "absolute"; minutes: number; until: string | null };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pengaturan batas waktu pengajuan keberatan (khusus admin). */
export default function KeberatanDeadlineSetting() {
  const [mode, setMode] = useState<Cfg["mode"]>("off");
  const [minutes, setMinutes] = useState(30);
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_keberatan_deadline" as never);
    if (error) return;
    const cfg = (data ?? {}) as Partial<Cfg>;
    setMode((cfg.mode as Cfg["mode"]) ?? "off");
    setMinutes(Number(cfg.minutes ?? 30));
    setUntil(toLocalInput(cfg.until ?? null));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function simpan() {
    if (mode === "absolute" && !until) {
      toast.error("Tentukan tanggal & jam batas akhir");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("set_keberatan_deadline" as never, {
      _value: {
        mode,
        minutes,
        until: mode === "absolute" && until ? new Date(until).toISOString() : null,
      },
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Batas waktu keberatan tersimpan");
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Timer className="size-5" />Batas Waktu Pengajuan Keberatan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Cfg["mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Tanpa batas waktu</SelectItem>
                <SelectItem value="relative">Sekian menit setelah peserta selesai dinilai</SelectItem>
                <SelectItem value="absolute">Sampai tanggal &amp; jam tertentu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "relative" && (
            <div className="space-y-2">
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={1}
                max={10080}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </div>
          )}

          {mode === "absolute" && (
            <div className="space-y-2">
              <Label>Batas akhir</Label>
              <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Setelah batas waktu lewat, form publik <code>/keberatan</code> menolak pengajuan baru untuk peserta terkait.
          Pengajuan yang sudah masuk tetap dapat diputuskan.
        </p>

        <Button onClick={simpan} disabled={busy}>Simpan pengaturan</Button>
      </CardContent>
    </Card>
  );
}
