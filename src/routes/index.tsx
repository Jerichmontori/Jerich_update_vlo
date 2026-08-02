import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Gavel, Trophy } from "lucide-react";
import bumotikLogo from "@/assets/bumotik-logo.png.asset.json";
import multimediaLogo from "@/assets/multimedia-bumotik.webp.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://bumotik.live/" }],
    meta: [{ property: "og:url", content: "https://bumotik.live/" }],
  }),
  component: Landing,
});


function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-background">
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={bumotikLogo.url}
            alt="Logo BUMOTIK"
            className="h-10 sm:h-12 w-auto object-contain"
            width={480}
            height={130}
          />
        </Link>
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
              <Link to="/auth">Masuk</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/daftar">Daftar</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/live">Live Ranking</Link>
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

      <footer className="mx-auto max-w-6xl px-4 py-10 flex flex-col items-center gap-3 border-t">
        <img
          src={multimediaLogo.url}
          alt="Logo Multimedia BUMOTIK — Blessed to be Blessing"
          className="h-14 sm:h-16 w-auto object-contain opacity-90"
          loading="lazy"
          width={480}
          height={340}
        />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Multimedia BUMOTIK</p>
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
