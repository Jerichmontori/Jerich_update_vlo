import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff } from "lucide-react";

type Props = {
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "default" | "sm";
};

export default function GantiPasswordButton({ variant = "outline", size = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const kuat =
    pw1.length >= 8 &&
    /[a-z]/.test(pw1) &&
    /[A-Z]/.test(pw1) &&
    /[0-9]/.test(pw1) &&
    /[^A-Za-z0-9]/.test(pw1);

  function terjemahkanError(msg: string) {
    const m = msg.toLowerCase();
    if (m.includes("weak") || m.includes("easy to guess") || m.includes("pwned") || m.includes("leaked")) {
      return "Kata sandi terlalu mudah ditebak (pernah bocor di internet). Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol — hindari kata umum, nama, atau tanggal lahir.";
    }
    if (m.includes("should be at least") || m.includes("at least 6")) {
      return "Kata sandi terlalu pendek. Gunakan minimal 8 karakter.";
    }
    if (m.includes("same as the old") || m.includes("different from the old")) {
      return "Kata sandi baru harus berbeda dari kata sandi lama.";
    }
    return msg;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (pw1.length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (!kuat) {
      toast.error(
        "Kata sandi kurang kuat. Wajib memuat huruf besar, huruf kecil, angka, dan simbol (contoh pola: Mazmur#2026)."
      );
      return;
    }
    if (pw1 !== pw2) {
      toast.error("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw new Error(terjemahkanError(error.message));
      toast.success("Kata sandi berhasil diganti. Gunakan kata sandi baru saat masuk berikutnya.");
      setOpen(false);
      setPw1("");
      setPw2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengganti kata sandi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <KeyRound className="size-4 mr-2" />
        Ganti Kata Sandi
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti Kata Sandi</DialogTitle>
            <DialogDescription>
              Setelah admin mereset kata sandi Anda, gantilah dengan kata sandi pribadi Anda sendiri.
              Minimal 8 karakter.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-baru">Kata Sandi Baru</Label>
              <div className="relative">
                <Input
                  id="pw-baru"
                  type={show ? "text" : "password"}
                  className="pr-10"
                  autoComplete="new-password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute inset-y-0 right-0 grid place-items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-ulang">Ulangi Kata Sandi Baru</Label>
              <Input
                id="pw-ulang"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Menyimpan…" : "Simpan Kata Sandi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
