import { createFileRoute } from "@tanstack/react-router";

/**
 * Membuat / menyegarkan akun juri UJI COBA (is_dummy = true).
 * Dilindungi header x-bootstrap-token. Tidak menyentuh juri asli.
 */
export const Route = createFileRoute("/api/public/bootstrap-juri-dummy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bootstrap-token");
        const expected = process.env.BOOTSTRAP_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { password?: string; count?: number };
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const password = body.password ?? "UjiCoba123!";
        const count = Math.min(Math.max(body.count ?? 3, 1), 6);
        if (password.length < 6) {
          return new Response("Password minimal 6 karakter", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });

        const hasil: Array<{ email: string; nama: string; userId: string; juriId: string }> = [];

        for (let i = 1; i <= count; i++) {
          const email = `juri.uji${i}@bumotik.xyz`;
          const nama = `UJI COBA - Juri ${i}`;

          // 1) akun auth
          let userId: string;
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

          // 2) baris juri dummy
          const { data: juriRow } = await supabaseAdmin
            .from("juri")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          let juriId: string;
          if (juriRow?.id) {
            juriId = juriRow.id;
            const { error } = await supabaseAdmin
              .from("juri")
              .update({
                nama,
                jabatan: "JURI (UJI COBA)",
                role: "juri",
                approved: true,
                is_dummy: true,
                user_id: userId,
              })
              .eq("id", juriId);
            if (error) return Response.json({ error: error.message }, { status: 500 });
          } else {
            const { data: inserted, error } = await supabaseAdmin
              .from("juri")
              .insert({
                nama,
                jabatan: "JURI (UJI COBA)",
                email,
                role: "juri",
                approved: true,
                is_dummy: true,
                user_id: userId,
              })
              .select("id")
              .single();
            if (error || !inserted) {
              return Response.json({ error: error?.message ?? "insert juri failed" }, { status: 500 });
            }
            juriId = inserted.id;
          }

          // 3) profil tertaut ke juri dummy (insert ulang: update juri_id diblokir trigger)
          await supabaseAdmin.from("profiles").delete().eq("id", userId);
          const { error: profErr } = await supabaseAdmin
            .from("profiles")
            .insert({ id: userId, nama, juri_id: juriId });
          if (profErr) return Response.json({ error: profErr.message }, { status: 500 });

          // 4) role juri
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: "juri" }, { onConflict: "user_id,role" });
          if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 });

          hasil.push({ email, nama, userId, juriId });
        }

        return Response.json({ ok: true, password, juri: hasil });
      },
    },
  },
});
