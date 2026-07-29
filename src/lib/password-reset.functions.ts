import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: hanya admin");
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: { identifier: string }) => {
    if (!data?.identifier?.trim()) throw new Error("Email atau nama wajib diisi");
    return { identifier: data.identifier.trim() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve user_id via juri (email or nama). Not blocking — permintaan tetap dibuat
    // meskipun tidak ketemu, agar tidak membocorkan siapa yang terdaftar.
    let userId: string | null = null;
    const isEmail = data.identifier.includes("@");
    const { data: juri } = await supabaseAdmin
      .from("juri")
      .select("user_id")
      .ilike(isEmail ? "email" : "nama", data.identifier)
      .maybeSingle();
    userId = (juri as any)?.user_id ?? null;

    const { error } = await supabaseAdmin.from("password_reset_request").insert({
      user_id: userId,
      identifier: data.identifier,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });


export const listPasswordResets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("password_reset_request")
      .select("id, user_id, identifier, new_password, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const approvePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id wajib");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("password_reset_request")
      .select("id, user_id, identifier, new_password")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error(reqErr?.message ?? "Permintaan tidak ditemukan");

    let userId = (req as any).user_id as string | null;
    if (!userId) {
      // Re-lookup in case juri was linked after request creation.
      const ident = (req as any).identifier as string;
      const isEmail = ident.includes("@");
      const { data: juri } = await supabaseAdmin
        .from("juri")
        .select("user_id")
        .ilike(isEmail ? "email" : "nama", ident)
        .maybeSingle();
      userId = (juri as any)?.user_id ?? null;
    }
    if (!userId) throw new Error("Akun untuk permintaan ini tidak ditemukan");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: (req as any).new_password,
    });
    if (updErr) throw new Error(updErr.message);

    // Force logout on other devices.
    await supabaseAdmin.from("profiles").update({ active_session_id: null }).eq("id", userId);

    await supabaseAdmin.from("password_reset_request").delete().eq("id", data.id);

    return { ok: true };
  });

export const rejectPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id wajib");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("password_reset_request")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
