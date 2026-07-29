import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useLiveState } from "@/lib/liveState";

type Search = { bg?: string };

export const Route = createFileRoute("/vmix/nowreading")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    bg: typeof s.bg === "string" ? s.bg : "transparent",
  }),
  head: () => ({ meta: [{ title: "vMix Now Reading" }, { name: "robots", content: "noindex" }] }),
  component: VmixNowReading,
});

function VmixNowReading() {
  const { bg } = useSearch({ from: "/vmix/nowreading" });
  const { state } = useLiveState(3000);
  const a = (state?.active ?? [])[0];
  const bgStyle = bg === "transparent" ? "transparent" : `#${bg?.replace(/^#/, "")}`;

  return (
    <>
      <style>{`html,body,#root{background:${bgStyle} !important;margin:0;padding:0;}`}</style>
      <div className="w-full min-h-screen flex items-end p-8 text-white" style={{ background: bgStyle, textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>
        {!a ? null : (
          <div className="max-w-[720px] rounded-2xl px-6 py-5" style={{ background: "linear-gradient(135deg, rgba(123,45,38,.9), rgba(60,20,18,.85))", boxShadow: "0 20px 40px rgba(0,0,0,.4)", borderLeft: "4px solid #C9A227" }}>
            <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: "#C9A227" }}>Nomor Urut {a.nomor_urut} · Sedang Tampil</div>
            <div className="mt-1 text-4xl font-serif font-semibold leading-tight">{a.nama}</div>
            {a.asal && <div className="text-white/80 mt-0.5">{a.asal}</div>}
            <div className="mt-3 flex items-baseline gap-3">
              <div className="text-xs uppercase tracking-widest text-white/70">Bacaan</div>
              <div className="text-xl font-medium">{a.bacaan ?? "-"}</div>
              {a.jumlah_ayat ? <div className="text-xs text-white/70">({a.jumlah_ayat} ayat)</div> : null}
            </div>
            {a.kategori && (
              <div className="mt-3 inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "#C9A227", color: "#3a1e12" }}>
                {a.kategori}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
