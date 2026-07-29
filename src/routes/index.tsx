import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpenText, ShieldCheck, Gavel, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Aplikasi penilaian dan pemeringkatan lomba baca Mazmur — objektif, transparan, dan mudah digunakan oleh juri." },
      { property: "og:title", content: "Sistem Penjurian Baca Mazmur" },
      { property: "og:description", content: "Aplikasi penilaian dan pemeringkatan lomba baca Mazmur — objektif, transparan, dan mudah digunakan oleh juri." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-background">
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center size-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30">
            <BookOpenText className="size-5" />
          </div>
          <span className="font-serif text-lg font-semibold">Sistem Penjurian Baca Mazmur</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Masuk</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <section className="text-center max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Lomba Rohani</p>
          <h1 className="mt-3 text-4xl sm:text-6xl font-serif font-semibold leading-tight text-foreground">
            Penilaian lomba baca Mazmur, <span className="text-accent">objektif & transparan</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Membantu panitia mengelola lomba baca Mazmur dengan sistem penilaian digital yang mudah, adil, dan profesional.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Masuk sebagai Juri / Admin</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/daftar">Daftar</Link>
            </Button>
          </div>

        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard icon={<ShieldCheck className="size-6" />} title="Admin / Panitia"
            desc="Kelola peserta, juri, kriteria, dan hasil akhir dari satu panel terpusat." />
          <FeatureCard icon={<Gavel className="size-6" />} title="Juri"
            desc="Form penilaian yang fokus dan bersih — juri hanya melihat tugasnya sendiri." />
          <FeatureCard icon={<Trophy className="size-6" />} title="Viewer"
            desc="Lihat pemeringkatan setelah hasil diumumkan panitia." />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Sistem Penjurian Baca Mazmur
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card/70 backdrop-blur p-6 shadow-sm">
      <div className="grid place-items-center size-11 rounded-xl bg-accent/15 text-accent mb-4">{icon}</div>
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
