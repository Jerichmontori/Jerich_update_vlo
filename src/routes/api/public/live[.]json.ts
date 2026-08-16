import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cache pendek: banyak penonton dalam rentang 2,5 detik dilayani oleh
// satu query database saja, sehingga beban DB tidak naik seiring jumlah layar.
const CACHE_MS = 2500;
let cached: { at: number; body: string } | null = null;
let inflight: Promise<{ data: unknown; error: { message: string } | null }> | null = null;

async function fetchLiveState() {
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
  return (await sb.rpc("public_live_state" as any)) as { data: unknown; error: { message: string } | null };
}

export const Route = createFileRoute("/api/public/live.json")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        if (cached && now - cached.at < CACHE_MS) {
          return new Response(cached.body, {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store, no-cache, must-revalidate",
              "access-control-allow-origin": "*",
              "x-live-cache": "hit",
            },
          });
        }

        // Gabungkan permintaan bersamaan menjadi satu query.
        if (!inflight) {
          inflight = fetchLiveState().finally(() => {
            inflight = null;
          });
        }
        const { data, error } = await inflight;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          });
        }
        const body = JSON.stringify(data ?? {});
        cached = { at: Date.now(), body };
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate",
            "access-control-allow-origin": "*",
            "x-live-cache": "miss",
          },
        });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        }),
    },
  },
});
