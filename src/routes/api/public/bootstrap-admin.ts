import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bootstrap-token");
        const expected = process.env.BOOTSTRAP_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: { email?: string; password?: string; nama?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const email = body.email?.trim().toLowerCase();
        const password = body.password;
        const nama = body.nama?.trim() || email?.split("@")[0] || "Admin";
        if (!email || !password || password.length < 6) {
          return new Response("Missing email/password (min 6 chars)", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find or create auth user
        let userId: string | null = null;
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });
        const existing = list.users.find((u) => u.email?.toLowerCase() === email);
        if (existing) {
          userId = existing.id;
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
          if (updErr) return Response.json({ error: updErr.message }, { status: 500 });
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nama },
          });
          if (createErr || !created.user) {
            return Response.json({ error: createErr?.message ?? "create failed" }, { status: 500 });
          }
          userId = created.user.id;
        }

        // Ensure profile exists
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: userId, nama }, { onConflict: "id" });

        // Grant admin role
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 });

        return Response.json({ ok: true, userId, email });
      },
    },
  },
});
