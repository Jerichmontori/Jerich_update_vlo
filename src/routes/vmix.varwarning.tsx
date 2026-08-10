import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useLiveState } from "@/lib/liveState";
import { varStatusLabel, varStatusDetail } from "@/lib/varStatus";

type Search = { bg?: string; pos?: "top" | "center" | "bottom"; force?: boolean };

export const Route = createFileRoute("/vmix/varwarning")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    bg: typeof s.bg === "string" ? s.bg : "transparent",
    pos: s.pos === "top" || s.pos === "center" || s.pos === "bottom" ? s.pos : "top",
    force: String(s.force) === "true" || String(s.force) === "1",
  }),
  head: () => ({
    meta: [
      { title: "Warning Potensi VAR — vMix / OBS" },
      { name: "description", content: "Overlay peringatan potensi VAR untuk Browser Input vMix dan Browser Source OBS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VmixVarWarning,
});

function VmixVarWarning() {
  const { bg, pos, force } = useSearch({ from: "/vmix/varwarning" });
  const { state } = useLiveState(2500);
  const a = (state?.active ?? [])[0];
  const label = force ? "Potensi VAR" : varStatusLabel(a?.var_status);
  const detail = force ? "Simulasi pratinjau overlay." : varStatusDetail(a?.var_status);
  const badgeOn = state?.vmix_var_badge !== false;
  const show = !!label && (force || badgeOn);

  const bgStyle = bg === "transparent" ? "transparent" : `#${bg?.replace(/^#/, "")}`;
  const align = pos === "center" ? "items-center" : pos === "bottom" ? "items-end" : "items-start";

  return (
    <>
      <style>{`html,body,#root{background:${bgStyle} !important;margin:0;padding:0;}
@keyframes varpulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes varglow{0%,100%{box-shadow:0 0 0 0 rgba(176,0,32,.55)}50%{box-shadow:0 0 42px 10px rgba(176,0,32,.35)}}`}</style>
      <div
        className={`w-full min-h-screen flex justify-center ${align} p-8`}
        style={{ background: bgStyle }}
      >
        {show && (
          <div
            className="flex items-center gap-4 rounded-2xl px-7 py-4 text-white"
            style={{
              background: "linear-gradient(135deg, rgba(176,0,32,.95), rgba(90,0,16,.92))",
              borderLeft: "6px solid #C9A227",
              animation: "varglow 1.8s ease-in-out infinite",
              textShadow: "0 2px 10px rgba(0,0,0,.7)",
            }}
          >
            <div
              className="text-4xl leading-none"
              style={{ animation: "varpulse 1.2s ease-in-out infinite" }}
              aria-hidden
            >
              &#9888;
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: "#F0D27A" }}>
                Peringatan
              </div>
              <div className="text-3xl font-serif font-semibold leading-tight">{label}</div>
              {a && (
                <div className="text-sm text-white/85 mt-0.5">
                  No. {a.nomor_urut} — {a.nama}
                  {a.asal ? ` · ${a.asal}` : ""}
                </div>
              )}
              {detail && <div className="text-xs text-white/70 mt-1">{detail}</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
