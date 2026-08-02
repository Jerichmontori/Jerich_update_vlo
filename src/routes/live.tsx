import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpenText, Trophy, Radio, Mic } from "lucide-react";
import { useLiveState, sortRanking } from "@/lib/liveState";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Ranking — Lomba Baca Mazmur" },
      { name: "description", content: "Papan peringkat langsung dan peserta yang sedang tampil pada Lomba Baca Mazmur." },
      { property: "og:title", content: "Live Ranking Lomba Baca Mazmur" },
      { property: "og:description", content: "Papan peringkat & peserta yang sedang tampil, diperbarui secara langsung." },
    ],
  }),
  component: LivePublic,
});

const ALL = "__all__";

function LivePublic() {
  const { state, error } = useLiveState(4000);
  const [kategori, setKategori] = useState<string>(ALL);
  const [sesi, setSesi] = useState<string>(ALL);

  const kategoriList = useMemo(() => {
    const set = new Set<string>();
    (state?.ranking ?? []).forEach((r) => r.kategori && set.add(r.kategori));
    return Array.from(set).sort();
  }, [state]);

  const sesiList = useMemo(() => {
    const set = new Set<number>();
    (state?.sesi_tayang ?? []).forEach((s) => set.add(Number(s)));
    (state?.ranking ?? []).forEach((r) => r.sesi_no != null && set.add(Number(r.sesi_no)));
    return Array.from(set).sort((a, b) => a - b);
  }, [state]);

  const ranking = useMemo(() => {
    const rows = (state?.ranking ?? []).filter(
      (r) =>
        (kategori === ALL || (r.kategori ?? "") === kategori) &&
        (sesi === ALL || String(r.sesi_no ?? "") === sesi),
    );
    return sortRanking(rows);
  }, [state, kategori, sesi]);

  const active = state?.active ?? [];
  const medals = ["🥇", "🥈", "🥉"];


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-background">
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid place-items-center size-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-accent/30">
            <BookOpenText className="size-5" />
          </div>
          <span className="font-serif text-lg font-semibold">Lomba Baca Mazmur</span>
        </Link>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-semibold">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-accent" />
          </span>
          Live
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
            Gagal memuat data: {error}
          </div>
        )}

        {/* Now Reading */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Mic className="size-5 text-accent" />
            <h2 className="font-serif text-2xl font-semibold">Sedang Tampil</h2>
          </div>
          {active.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur px-6 py-10 text-center text-muted-foreground">
              Belum ada peserta yang sedang tampil.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {active.map((a) => (
                <div key={a.session_id} className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground shadow-xl">
                  <div className="absolute -right-8 -top-8 size-32 rounded-full bg-accent/30 blur-2xl" />
                  <div className="relative p-6">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent-foreground/90">
                      <Radio className="size-3.5" /> Nomor Urut {a.nomor_urut}
                    </div>
                    <div className="mt-2 font-serif text-3xl font-semibold leading-tight">{a.nama}</div>
                    {a.asal && <div className="mt-1 text-primary-foreground/80">{a.asal}</div>}
                    <div className="mt-4 rounded-lg bg-background/10 border border-white/10 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Bacaan Mazmur</div>
                      <div className="mt-1 text-lg font-medium">{a.bacaan ?? "-"}</div>
                      {a.jumlah_ayat ? <div className="text-xs text-primary-foreground/70">{a.jumlah_ayat} ayat</div> : null}
                    </div>
                    {a.kategori && <div className="mt-3 inline-flex text-[11px] uppercase tracking-widest bg-accent text-accent-foreground rounded-full px-2 py-0.5">{a.kategori}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ranking */}
        <section>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-accent" />
                <h2 className="font-serif text-2xl font-semibold">Live Ranking</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Peringkat sementara seluruh peserta yang sudah tampil &amp; disetujui juri
                {sesi === ALL ? " (semua sesi tayang)" : ` — Sesi ${sesi}`}
                {kategori === ALL ? "" : ` · ${kategori}`}.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sesiList.length > 0 && (
                <select
                  value={sesi}
                  onChange={(e) => setSesi(e.target.value)}
                  className="text-sm rounded-md border border-border bg-background px-3 py-1.5"
                >
                  <option value={ALL}>Semua Sesi</option>
                  {sesiList.map((s) => (
                    <option key={s} value={String(s)}>Sesi {s}</option>
                  ))}
                </select>
              )}
              {kategoriList.length > 0 && (
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="text-sm rounded-md border border-border bg-background px-3 py-1.5"
                >
                  <option value={ALL}>Semua Kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              )}
            </div>
          </div>


          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur overflow-hidden">
            <div className="grid grid-cols-[56px_60px_1fr_120px_140px] items-center px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
              <div>#</div>
              <div>No</div>
              <div>Peserta</div>
              <div className="text-right">Juri</div>
              <div className="text-right">Nilai Akhir</div>
            </div>
            {ranking.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">Belum ada nilai yang masuk.</div>
            ) : (
              ranking.map((r, i) => (
                <div
                  key={r.peserta_id}
                  className={`grid grid-cols-[56px_60px_1fr_120px_140px] items-center px-4 py-3 border-t border-border/40 ${i < 3 ? "bg-accent/5" : ""}`}
                >
                  <div className="font-serif text-lg">
                    {i < 3 ? <span className="text-2xl">{medals[i]}</span> : <span className="text-muted-foreground">{i + 1}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">{r.nomor_urut}</div>
                  <div>
                    <div className="font-medium">{r.nama}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.asal ?? ""}{r.kategori ? ` · ${r.kategori}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">{r.jumlah_juri ?? 0}</div>
                  <div className="text-right font-serif text-2xl font-semibold text-accent">
                    {r.nilai_akhir != null ? Number(r.nilai_akhir).toFixed(3) : "—"}
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Data diperbarui otomatis setiap beberapa detik. Untuk overlay siaran vMix, gunakan{" "}
            <Link to="/vmix/leaderboard" className="underline">/vmix/leaderboard</Link>,{" "}
            <Link to="/vmix/nowreading" className="underline">/vmix/nowreading</Link>, atau data source{" "}
            <code className="text-[11px]">/api/public/live.json</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
