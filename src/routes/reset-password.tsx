import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";
import { BookOpenText, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Ulang Kata Sandi — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Halaman untuk mengatur ulang kata sandi akun." },
      { property: "og:title", content: "Atur Ulang Kata Sandi" },
      { property: "og:description", content: "Halaman untuk mengatur ulang kata sandi akun." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase menaruh token pemulihan di URL hash; SDK akan otomatis
    // memroses hash dan menerbitkan event PASSWORD_RECOVERY / SIGNED_IN.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // Cek sesi yang sudah ada (mis. hash sudah diproses sebelum listener terpasang)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      toast.error("Kata sandi minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Kata sandi berhasil diperbarui. Silakan masuk kembali.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-gradient-to-br from-background via-secondary/30 to-background">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="grid place-items-center size-16 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30 mb-4">
            <BookOpenText className="size-8" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Lomba Rohani</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold mt-1">Atur Ulang Kata Sandi</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kata Sandi Baru</CardTitle>
            <CardDescription>
              {ready
                ? "Masukkan kata sandi baru untuk akun Anda."
                : "Memeriksa tautan pemulihan… buka halaman ini dari tautan pada email pemulihan Anda."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Kata Sandi Baru</Label>
                <div className="relative">
                  <Input id="new-password" type={show ? "text" : "password"} required autoComplete="new-password"
                    className="pr-10"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
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
                <Label htmlFor="confirm-password">Konfirmasi Kata Sandi</Label>
                <Input id="confirm-password" type={show ? "text" : "password"} required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading ? "Memproses…" : "Simpan Kata Sandi"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">Kembali ke halaman masuk</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
