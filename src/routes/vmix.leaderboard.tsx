import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { useLiveState, sortRanking } from "@/lib/liveState";

type Search = { kategori?: string; top?: number; bg?: string };

export const Route = createFileRoute("/vmix/leaderboard")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    kategori: typeof s.kategori === "string" ? s.kategori : undefined,
    top: s.top ? Math.max(1, Math.min(20, Number(s.top))) : 10,
    bg: typeof s.bg === "string" ? s.bg : "transparent",
  }),
  head: () => ({ meta: [{ title: "vMix Leaderboard" }, { name: "robots", content: "noindex" }] }),
  component: VmixLeaderboard,
});

function VmixLeaderboard() {
  const { kategori, top, bg } = useSearch({ from: "/vmix/leaderboard" });
  const { state } = useLiveState(3000);

  const rows = useMemo(() => {
    const list = (state?.ranking ?? []).filter((r) => !kategori || (r.kategori ?? "") === kategori);
    return sortRanking(list).slice(0, top ?? 10);
  }, [state, kategori, top]);

  const bgStyle = bg === "transparent" ? "transparent" : `#${bg?.replace(/^#/, "")}`;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <style>{`html,body,#root{background:${bgStyle} !important;margin:0;padding:0;}`}</style>
      <div
        className="p-6 text-white font-sans w-full min-h-screen"
        style={{ background: bgStyle, textShadow: "0 2px 8px rgba(0,0,0,.65)" }}
      >
        <div className="max-w-[900px] mx-auto">
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-3xl font-serif font-semibold tracking-tight">Live Ranking</div>
            {kategori && <div className="text-sm uppercase tracking-[0.25em] opacity-80">{kategori}</div>}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: "rgba(15,15,20,.55)", backdropFilter: "blur(6px)" }}>
            {rows.length === 0 ? (
              <div className="p-6 text-center opacity-80">Belum ada data</div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.peserta_id}
                  className="grid grid-cols-[64px_1fr_140px] items-center px-5 py-3 border-b border-white/10 last:border-b-0"
                  style={i < 3 ? { background: "linear-gradient(90deg, rgba(201,162,39,.25), transparent)" } : undefined}
                >
                  <div className="text-2xl font-serif">
                    {i < 3 ? medals[i] : <span className="opacity-70">{i + 1}</span>}
                  </div>
                  <div>
                    <div className="text-xl font-medium leading-tight">{r.nama}</div>
                    <div className="text-xs opacity-75">
                      No {r.nomor_urut}{r.asal ? ` · ${r.asal}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-3xl font-serif font-semibold" style={{ color: "#f2c94c" }}>
                    {r.nilai_akhir != null ? Number(r.nilai_akhir).toFixed(3) : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
