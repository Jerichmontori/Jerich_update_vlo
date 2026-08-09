import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRANDING, fetchBranding, normalizeBranding, useBranding, type Branding } from "@/hooks/useBranding";

async function fileToResizedDataUrl(file: File, maxWidth = 600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Gagal membaca file"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("File gambar tidak valid"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / (img.width || maxWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((img.width || maxWidth) * scale);
  canvas.height = Math.round((img.height || maxWidth) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export default function BrandingSettingsButton() {
  const current = useBranding();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Branding>(current);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setForm(current); }, [open, current]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Ukuran logo maksimal 3MB"); return; }
    try {
      const url = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses gambar");
    }
  }

  async function save() {
    setSaving(true);
    const payload = normalizeBranding(form);
    const { error } = await supabase.rpc("set_branding" as any, { _value: payload as any });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await fetchBranding();
    toast.success("Tampilan lomba diperbarui");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><ImageIcon className="size-4" />Logo & Judul</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah Logo & Judul Lomba</DialogTitle>
          <DialogDescription>Perubahan berlaku untuk semua halaman aplikasi.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <img src={form.logoUrl} alt="Pratinjau logo" className="h-12 w-auto max-w-[180px] object-contain" />
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Pilih Logo</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, logoUrl: DEFAULT_BRANDING.logoUrl }))}>Reset Logo</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-kicker">Teks Atas</Label>
            <Input id="brand-kicker" value={form.kicker} onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-judul">Judul Lomba</Label>
            <Input id="brand-judul" value={form.judul} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-sub">Sub Judul</Label>
            <Input id="brand-sub" value={form.subjudul} onChange={(e) => setForm((f) => ({ ...f, subjudul: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
