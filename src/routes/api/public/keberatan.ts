import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const CORS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const submitSchema = z.object({
  peserta_id: z.string().uuid(),
  jenis: z.enum(["nilai", "teknis", "administrasi", "lainnya"]),
  uraian: z.string().trim().min(20).max(2000),
  nama_pengaju: z.string().trim().min(3).max(120),
  hubungan: z.string().trim().max(80).optional().nullable(),
  kontak: z.string().trim().max(120).optional().nullable(),
});

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
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
}

function tiket() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `KB-${s}`;
}

export const Route = createFileRoute("/api/public/keberatan")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const t = url.searchParams.get("tiket");
        const sb = publicClient();

        if (t) {
          if (t.length > 20) return new Response(JSON.stringify({ error: "Nomor tiket tidak valid" }), { status: 400, headers: CORS });
          const { data, error } = await sb.rpc("keberatan_status" as never, { _tiket: t } as never);
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
          if (!data) return new Response(JSON.stringify({ error: "Tiket tidak ditemukan" }), { status: 404, headers: CORS });
          return new Response(JSON.stringify(data), { status: 200, headers: CORS });
        }

        // daftar peserta ringkas (tanpa data pribadi) untuk pilihan form
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("peserta")
          .select("id, nomor_urut, nama, kategori")
          .order("nomor_urut");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
        return new Response(JSON.stringify({ peserta: data ?? [] }), { status: 200, headers: CORS });
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Body tidak valid" }), { status: 400, headers: CORS });
        }
        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Data tidak lengkap" }),
            { status: 400, headers: CORS },
          );
        }
        const v = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // batasi maksimal 3 pengajuan terbuka per peserta
        const { count } = await supabaseAdmin
          .from("keberatan")
          .select("id", { count: "exact", head: true })
          .eq("peserta_id", v.peserta_id)
          .in("status", ["baru", "ditinjau"]);
        if ((count ?? 0) >= 3) {
          return new Response(
            JSON.stringify({ error: "Sudah ada 3 pengajuan yang belum diputuskan untuk peserta ini." }),
            { status: 429, headers: CORS },
          );
        }

        let nomor = tiket();
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabaseAdmin
            .from("keberatan")
            .insert({
              nomor_tiket: nomor,
              peserta_id: v.peserta_id,
              jenis: v.jenis,
              uraian: v.uraian,
              nama_pengaju: v.nama_pengaju,
              hubungan: v.hubungan ?? null,
              kontak: v.kontak ?? null,
            })
            .select("nomor_tiket")
            .single();
          if (!error && data) {
            return new Response(JSON.stringify({ nomor_tiket: data.nomor_tiket }), { status: 200, headers: CORS });
          }
          if (error && !error.message.includes("duplicate")) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
          }
          nomor = tiket();
        }
        return new Response(JSON.stringify({ error: "Gagal membuat nomor tiket" }), { status: 500, headers: CORS });
      },
    },
  },
});
