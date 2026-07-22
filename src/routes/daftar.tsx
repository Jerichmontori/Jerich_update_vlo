import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";
import { BookOpenText } from "lucide-react";
import { registerJuri } from "@/lib/juri-register.functions";

export const Route = createFileRoute("/daftar")({
  head: () => ({
    meta: [
      { title: "Daftar sebagai Juri — Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Formulir pendaftaran calon juri lomba baca Mazmur. Akun akan aktif setelah disetujui admin." },
      { property: "og:title", content: "Daftar sebagai Juri" },
      { property: "og:description", content: "Formulir pendaftaran calon juri lomba baca Mazmur." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DaftarPage,
});

function DaftarPage() {
  const navigate = useNavigate();
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password minimal 8 karakter");
    setLoading(true);
    try {
      await registerJuri({ data: { nama, jabatan: jabatan || null, email, password } });
      toast.success("Pendaftaran berhasil. Menunggu persetujuan admin.");
      setTimeout(() => navigate({ to: "/auth" }), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mendaftar");
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold mt-1">Daftar sebagai Juri</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Formulir Pendaftaran</CardTitle>
            <CardDescription>
              Isi data berikut. Akun Anda baru dapat digunakan untuk masuk setelah disetujui admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jabatan">Jabatan (opsional)</Label>
                <Input id="jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Pdt. / Diakon / dll" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Kata Sandi</Label>
                <Input id="password" type="password" required minLength={8} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 karakter" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Mendaftar…" : "Daftar"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">Masuk</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
