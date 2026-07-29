import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { BookOpenText, Eye, EyeOff } from "lucide-react";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Halaman masuk untuk admin dan juri Sistem Penjurian Baca Mazmur." },
      { property: "og:title", content: "Masuk — Sistem Penjurian Baca Mazmur" },
      { property: "og:description", content: "Halaman masuk untuk admin dan juri." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Selalu bersihkan sesi lama saat membuka halaman /auth agar tidak
    // ada "login instan" akibat sesi tertinggal dari percobaan sebelumnya.
    supabase.auth.signOut().catch(() => {});
  }, []);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!identifier.trim() || password.length < 6) {
      toast.error("Isi email/nama dan kata sandi (min. 6 karakter) sebelum masuk.");
      return;
    }
    setLoading(true);
    try {
      const { signInWithIdentifier } = await import("@/lib/auth-lookup.functions");
      const res = await signInWithIdentifier({
        data: { identifier: identifier.trim(), password },
      });
      const { error: setErr, data: setData } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (setErr || !setData.user) {
        setLoading(false);
        toast.error(setErr?.message ?? "Gagal masuk");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", setData.user.id);
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error("Akun Anda belum disetujui admin. Silakan hubungi panitia.");
        return;
      }
      // Single-device enforcement: mint a device session id and mark it as the
      // currently-active session on this user's profile. Any older device will
      // detect the mismatch on its next poll and be signed out automatically.
      try {
        const deviceSessionId =
          (globalThis.crypto?.randomUUID?.() as string | undefined) ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("device_session_id", deviceSessionId);
        await supabase
          .from("profiles")
          .update({ active_session_id: deviceSessionId })
          .eq("id", setData.user.id);
      } catch {
        // non-fatal — enforcement will still work on the next successful login
      }
      setLoading(false);
      toast.success("Selamat datang kembali");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Gagal masuk");
    }
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
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold mt-1">Sistem Penjurian Baca Mazmur</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>
              Masukkan email atau nama Anda. Belum punya akun? Daftar melalui halaman beranda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Email atau Nama</Label>
                <Input id="identifier" type="text" required autoComplete="username"
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="email@contoh.com atau nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Kata Sandi</Label>
                <Input id="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Memproses…" : "Masuk"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/" className="underline underline-offset-4 hover:text-foreground">Kembali ke beranda</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
