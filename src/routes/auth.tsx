import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";
import { BookOpenText } from "lucide-react";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Selamat datang kembali");
    navigate({ to: "/dashboard" });
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
              Gunakan akun yang telah disediakan admin. Belum punya akun? Hubungi panitia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
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
