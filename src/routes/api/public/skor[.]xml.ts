import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(v: unknown) {
  return v == null || v === "" ? "" : Number(v).toFixed(3);
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export const Route = createFileRoute("/api/public/skor.xml")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const sb = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await sb.rpc("public_pengumuman_state" as any);
        const st: any = (!error && data) || {};
        const p: any = st.peserta ?? {};
        const juri: any[] = Array.isArray(st.juri) ? st.juri : [];

        // 5 slot juri tetap agar mapping di vMix tidak berubah
        const slots = Array.from({ length: 5 }, (_, i) => juri[i] ?? null);

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<pengumuman>\n` +
          `  <status>${esc(st.peserta ? (st.running ? "Menampilkan" : "Siap") : "")}</status>\n` +
          `  <nomor_urut>${esc(p.nomor_urut ?? "")}</nomor_urut>\n` +
          `  <nama>${esc(p.nama ?? "")}</nama>\n` +
          `  <asal>${esc(p.asal ?? "")}</asal>\n` +
          `  <jumlah_juri>${esc(juri.length || "")}</jumlah_juri>\n` +
          slots
            .map(
              (j, i) =>
                `  <juri${i + 1}_nama>${esc(j?.juri_nama ?? "")}</juri${i + 1}_nama>\n` +
                `  <juri${i + 1}_nilai>${esc(num(j?.nilai_juri))}</juri${i + 1}_nilai>\n`,
            )
            .join("") +
          `  <nilai_akhir>${esc(num(st.nilai_akhir))}</nilai_akhir>\n` +
          `</pengumuman>\n`;

        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate",
            ...CORS,
          },
        });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
