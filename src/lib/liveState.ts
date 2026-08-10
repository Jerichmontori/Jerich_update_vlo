import { useEffect, useState } from "react";

export type ActiveSession = {
  session_id: string;
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  asal: string | null;
  kategori: string | null;
  bacaan: string | null;
  jumlah_ayat: number | null;
  started_at: string;
  var_status?: string | null;
};

export type RankingRow = {
  peserta_id: string;
  nomor_urut: number;
  nama: string;
  asal: string | null;
  kategori: string | null;
  nilai_akhir: number | null;
  jumlah_juri: number | null;
  juri_total_sum: number | null;
  juri_spread: number | null;
  sesi_no?: number | null;
};

export type LiveState = {
  now: string;
  active: ActiveSession[];
  ranking: RankingRow[];
  sesi_tayang?: number[];
  vmix_var_badge?: boolean;
};


export function useLiveState(intervalMs = 4000) {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: any;
    async function tick() {
      try {
        const res = await fetch("/api/public/live.json", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (data?.error) setError(data.error);
        else {
          setError(null);
          setState(data);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Network error");
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return { state, error };
}

export function sortRanking(rows: RankingRow[]) {
  return [...rows].sort((a, b) => {
    const ar = Math.round(Number(a.nilai_akhir ?? 0) * 1000);
    const br = Math.round(Number(b.nilai_akhir ?? 0) * 1000);
    if (br !== ar) return br - ar;
    const at = Number(a.juri_total_sum ?? 0), bt = Number(b.juri_total_sum ?? 0);
    if (bt !== at) return bt - at;
    const as = Number(a.juri_spread ?? 0), bs = Number(b.juri_spread ?? 0);
    if (bs !== as) return bs - as;
    return a.nomor_urut - b.nomor_urut;
  });
}
