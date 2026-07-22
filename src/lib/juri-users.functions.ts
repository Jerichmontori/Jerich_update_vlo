import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  nama: string;
  jabatan?: string | null;
  email: string;
  password: string;
  role: "admin" | "juri";
};

export const createJuriUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    if (!data?.nama || !data?.email || !data?.password || !data?.role) {
      throw new Error("nama, email, password, role wajib diisi");
    }
    if (data.password.length < 8) throw new Error("Password minimal 8 karakter");
    if (!["admin", "juri"].includes(data.role)) throw new Error("Role tidak valid");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: hanya admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Insert juri row
    const { data: juriRow, error: juriErr } = await supabaseAdmin
      .from("juri")
      .insert({ nama: data.nama, jabatan: data.jabatan || null })
      .select()
      .single();
    if (juriErr) throw new Error(juriErr.message);

    // 2. Create auth user (confirmed)
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nama: data.nama },
    });
    if (userErr || !userRes?.user) {
      await supabaseAdmin.from("juri").delete().eq("id", juriRow.id);
      throw new Error(userErr?.message ?? "Gagal membuat akun");
    }
    const userId = userRes.user.id;

    // 3. Link profile to juri (profile auto-created via trigger)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nama: data.nama, juri_id: juriRow.id });
    if (profErr) throw new Error(profErr.message);

    // 4. Assign role
    const { error: rolErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (rolErr) throw new Error(rolErr.message);

    return { ok: true, juri: juriRow };
  });
