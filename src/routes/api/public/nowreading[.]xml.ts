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

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export const Route = createFileRoute("/api/public/nowreading.xml")({
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

        const { data, error } = await sb.rpc("public_live_state" as any);
        const active: any[] = (!error && (data as any)?.active) || [];

        const rows =
          active.length > 0
            ? active
            : [{ nomor_urut: "", nama: "", asal: "", kategori: "", bacaan: "", jumlah_ayat: "", started_at: "" }];

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<nowreading>\n` +
          rows
            .map(
              (a) =>
                `  <peserta>\n` +
                `    <nomor_urut>${esc(a.nomor_urut)}</nomor_urut>\n` +
                `    <nama>${esc(a.nama)}</nama>\n` +
                `    <asal>${esc(a.asal)}</asal>\n` +
                `    <kategori>${esc(a.kategori)}</kategori>\n` +
                `    <bacaan>${esc(a.bacaan)}</bacaan>\n` +
                `    <jumlah_ayat>${esc(a.jumlah_ayat)}</jumlah_ayat>\n` +
                `    <bacaan_lengkap>${esc(
                  a.bacaan ? `${a.bacaan}${a.jumlah_ayat ? ` (${a.jumlah_ayat} ayat)` : ""}` : "",
                )}</bacaan_lengkap>\n` +
                `    <status>${esc(active.length > 0 ? "Sedang Tampil" : "")}</status>\n` +
                `  </peserta>\n`,
            )
            .join("") +
          `</nowreading>\n`;

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
