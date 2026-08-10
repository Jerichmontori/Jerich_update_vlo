import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY: dihapus segera setelah akun admin dibuat.
const ALLOWED_EMAIL = "jerichmontori9@gmail.com";

export const Route = createFileRoute("/api/public/tmp-create-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { email?: string; password?: string; nama?: string };
        const email = body.email?.trim().toLowerCase();
        const password = body.password;
        const nama = body.nama?.trim() || "Admin";
        if (email !== ALLOWED_EMAIL || !password || password.length < 6) {
          return new Response("Forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let userId: string;
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });
        const existing = list.users.find((u) => u.email?.toLowerCase() === email);
        if (existing) {
          userId = existing.id;
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
          if (error) return Response.json({ error: error.message }, { status: 500 });
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nama },
          });
          if (error || !created.user) {
            return Response.json({ error: error?.message ?? "create failed" }, { status: 500 });
          }
          userId = created.user.id;
        }

        await supabaseAdmin.from("profiles").upsert({ id: userId, nama }, { onConflict: "id" });
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 });

        return Response.json({ ok: true, userId, email });
      },
    },
  },
});
