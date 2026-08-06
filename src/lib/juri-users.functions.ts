import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "juri" | "panitia" | "inspektur" | "ketua_juri" | "viewer" | "operator_vmix";
const ALL_ROLES: Role[] = ["admin", "juri", "panitia", "inspektur", "ketua_juri", "viewer", "operator_vmix"];

type CreateInput = {
  nama: string;
  jabatan?: string | null;
  email: string;
  password: string;
  role: Role;
};


async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: hanya admin");
}

export const createJuriUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateInput) => {
    if (!data?.nama || !data?.email || !data?.password || !data?.role) {
      throw new Error("nama, email, password, role wajib diisi");
    }
    if (data.password.length < 8) throw new Error("Password minimal 8 karakter");
    if (!ALL_ROLES.includes(data.role)) throw new Error("Role tidak valid");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create auth user (confirmed) — belum diberi role sampai admin approve
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nama: data.nama },
    });
    if (userErr || !userRes?.user) throw new Error(userErr?.message ?? "Gagal membuat akun");
    const userId = userRes.user.id;

    // 2. Insert juri row (approved = false by default)
    const { data: juriRow, error: juriErr } = await supabaseAdmin
      .from("juri")
      .insert({
        nama: data.nama,
        jabatan: data.jabatan || null,
        email: data.email,
        role: data.role,
        approved: false,
        user_id: userId,
      })
      .select()
      .single();
    if (juriErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(juriErr.message);
    }

    // 3. Link profile to juri (profile auto-created via trigger)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nama: data.nama, juri_id: juriRow.id });
    if (profErr) throw new Error(profErr.message);

    // NOTE: role BELUM diberikan. Akan diberikan saat admin approve.
    return { ok: true, juri: juriRow };
  });

export const approveJuri = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { juriId: string }) => {
    if (!data?.juriId) throw new Error("juriId wajib");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: juri, error: getErr } = await supabaseAdmin
      .from("juri")
      .select("id, user_id, role, approved")
      .eq("id", data.juriId)
      .single();
    if (getErr || !juri) throw new Error(getErr?.message ?? "Juri tidak ditemukan");
    if (!juri.user_id || !juri.role) throw new Error("Juri tidak memiliki akun login");
    if (juri.approved) return { ok: true };

    // Insert role (idempotent via unique constraint)
    const { error: rolErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: juri.user_id, role: juri.role }, { onConflict: "user_id,role" });
    if (rolErr) throw new Error(rolErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("juri")
      .update({ approved: true })
      .eq("id", juri.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

export const deleteJuriUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { juriId: string }) => {
    if (!data?.juriId) throw new Error("juriId wajib");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: juri } = await supabaseAdmin
      .from("juri")
      .select("id, user_id")
      .eq("id", data.juriId)
      .single();

    await supabaseAdmin.from("juri").delete().eq("id", data.juriId);
    if (juri?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(juri.user_id).catch(() => {});
    }
    return { ok: true };
  });

export const setJuriRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { juriId: string; role: Role }) => {
    if (!data?.juriId) throw new Error("juriId wajib");
    if (!ALL_ROLES.includes(data?.role)) throw new Error("Role tidak valid");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: juri, error: getErr } = await supabaseAdmin
      .from("juri")
      .select("id, user_id, role, approved")
      .eq("id", data.juriId)
      .single();
    if (getErr || !juri) throw new Error(getErr?.message ?? "Juri tidak ditemukan");

    const { error: updErr } = await supabaseAdmin
      .from("juri")
      .update({ role: data.role })
      .eq("id", juri.id);
    if (updErr) throw new Error(updErr.message);

    // Sync user_roles when the account is already approved
    if (juri.user_id && juri.approved) {
      const allRoles: Role[] = ALL_ROLES;
      const others = allRoles.filter((r) => r !== data.role);
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", juri.user_id)
        .in("role", others);
      const { error: rolErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: juri.user_id, role: data.role }, { onConflict: "user_id,role" });
      if (rolErr) throw new Error(rolErr.message);
    }

    return { ok: true };
  });


export const resetJuriPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { juriId: string; password: string }) => {
    if (!data?.juriId) throw new Error("juriId wajib");
    if (!data?.password || data.password.length < 8)
      throw new Error("Password minimal 8 karakter");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: juri, error: getErr } = await supabaseAdmin
      .from("juri")
      .select("id, user_id")
      .eq("id", data.juriId)
      .single();
    if (getErr || !juri) throw new Error(getErr?.message ?? "Juri tidak ditemukan");
    if (!juri.user_id) throw new Error("Juri belum memiliki akun login");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(juri.user_id, {
      password: data.password,
    });
    if (updErr) throw new Error(updErr.message);

    // Invalidate any active session on other devices by clearing active_session_id.
    await supabaseAdmin
      .from("profiles")
      .update({ active_session_id: null })
      .eq("id", juri.user_id);

    return { ok: true };
  });
