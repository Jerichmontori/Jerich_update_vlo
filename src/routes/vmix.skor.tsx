import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type Search = { bg?: string };

export const Route = createFileRoute("/vmix/skor")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    bg: typeof s.bg === "string" ? s.bg : "transparent",
  }),
  head: () => ({ meta: [{ title: "vMix Pengumuman Nilai" }, { name: "robots", content: "noindex" }] }),
  component: VmixSkor,
});

type JuriItem = { juri_nama: string; nilai_juri: number | null };
type State = {
  running?: boolean;
  updated_at?: string;
  peserta?: { nomor_urut: number; nama: string; asal: string | null } | null;
  juri?: JuriItem[];
  nilai_akhir?: number | null;
};

function RollingNumber({ value, running, delay = 0 }: { value: number | null; running: boolean; delay?: number }) {
  const [display, setDisplay] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const timers = useRef<any[]>([]);

  useEffect(() => {
    timers.current.forEach(clearInterval);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSettled(false);
    if (!running || value == null) {
      setDisplay(running ? null : value);
      return;
    }
    const start = setTimeout(() => {
      const spin = setInterval(() => setDisplay(Math.random() * 100), 55);
      timers.current.push(spin);
      const stop = setTimeout(() => {
        clearInterval(spin);
        setDisplay(value);
        setSettled(true);
      }, 2200);
      timers.current.push(stop);
    }, delay);
    timers.current.push(start);
    return () => {
      timers.current.forEach(clearInterval);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [value, running, delay]);

  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        color: settled ? "#f2c94c" : "#fff",
        transition: "color .3s",
      }}
    >
      {display == null ? "—" : display.toFixed(3)}
    </span>
  );
}

function VmixSkor() {
  const { bg } = useSearch({ from: "/vmix/skor" });
  const [state, setState] = useState<State | null>(null);
  const [runToken, setRunToken] = useState(0);
  const lastRun = useRef<string>("");

  useEffect(() => {
    let alive = true;
    let timer: any;
    async function tick() {
      try {
        const res = await fetch("/api/public/skor.json", { cache: "no-store" });
        const data = (await res.json()) as State;
        if (!alive) return;
        setState(data);
        const key = `${data?.peserta?.nomor_urut ?? ""}|${data?.updated_at ?? ""}|${data?.running ? 1 : 0}`;
        if (data?.running && key !== lastRun.current) {
          lastRun.current = key;
          setRunToken((t) => t + 1);
        }
        if (!data?.running) lastRun.current = "";
      } catch {
        /* ignore */
      } finally {
        if (alive) timer = setTimeout(tick, 2000);
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const bgStyle = bg === "transparent" ? "transparent" : `#${bg?.replace(/^#/, "")}`;
  const p = state?.peserta;
  const juri = state?.juri ?? [];
  const juriDelay = 200;
  const finalDelay = juriDelay + juri.length * 500 + 1800;
  const running = !!state?.running;

  return (
    <>
      <style>{`html,body,#root{background:${bgStyle} !important;margin:0;padding:0;}`}</style>
      <div
        className="w-full min-h-screen flex items-end justify-center p-8 text-white font-sans"
        style={{ background: bgStyle, textShadow: "0 2px 10px rgba(0,0,0,.7)" }}
      >
        {!p ? null : (
          <div
            key={runToken}
            className="w-full max-w-[1000px] rounded-2xl px-8 py-6"
            style={{
              background: "linear-gradient(135deg, rgba(123,45,38,.92), rgba(40,14,12,.88))",
              boxShadow: "0 24px 48px rgba(0,0,0,.45)",
              borderLeft: "5px solid #C9A227",
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: "#C9A227" }}>
              Nomor Urut {p.nomor_urut} · Pengumuman Nilai
            </div>
            <div className="mt-1 text-4xl font-serif font-semibold leading-tight">{p.nama}</div>
            {p.asal && <div className="text-white/80 mt-0.5">{p.asal}</div>}

            <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(juri.length, 1), 5)}, minmax(0,1fr))` }}>
              {juri.map((j, i) => (
                <div key={`${j.juri_nama}-${i}`} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,.08)" }}>
                  <div className="text-[10px] uppercase tracking-widest text-white/70 truncate">{j.juri_nama}</div>
                  <div className="text-2xl font-mono mt-1">
                    <RollingNumber value={j.nilai_juri == null ? null : Number(j.nilai_juri)} running={running} delay={juriDelay + i * 500} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-baseline justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#C9A227" }}>
                Nilai Akhir
              </div>
              <div className="text-6xl font-serif font-semibold font-mono">
                <RollingNumber
                  value={state?.nilai_akhir == null ? null : Number(state.nilai_akhir)}
                  running={running}
                  delay={finalDelay}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
