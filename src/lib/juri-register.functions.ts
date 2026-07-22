import { createServerFn } from "@tanstack/react-start";

type RegisterInput = {
  nama: string;
  jabatan?: string | null;
  email: string;
  password: string;
};

export const registerJuri = createServerFn({ method: "POST" })
  .inputValidator((data: RegisterInput) => {
    if (!data?.nama || !data?.email || !data?.password) {
      throw new Error("Nama, email, dan password wajib diisi");
    }
    if (data.password.length < 8) throw new Error("Password minimal 8 karakter");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nama: data.nama },
    });
    if (userErr || !userRes?.user) throw new Error(userErr?.message ?? "Gagal mendaftar");
    const userId = userRes.user.id;

    const { data: juriRow, error: juriErr } = await supabaseAdmin
      .from("juri")
      .insert({
        nama: data.nama,
        jabatan: data.jabatan || null,
        email: data.email,
        role: "juri",
        approved: false,
        user_id: userId,
      })
      .select()
      .single();
    if (juriErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(juriErr.message);
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nama: data.nama, juri_id: juriRow.id });

    return { ok: true };
  });
