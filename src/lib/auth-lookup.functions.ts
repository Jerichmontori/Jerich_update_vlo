import { createServerFn } from "@tanstack/react-start";

export const getEmailByNama = createServerFn({ method: "POST" })
  .inputValidator((data: { nama: string }) => {
    if (!data?.nama) throw new Error("Nama wajib diisi");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cari di tabel juri terlebih dahulu (case-insensitive exact match).
    const { data: juri } = await supabaseAdmin
      .from("juri")
      .select("email")
      .ilike("nama", data.nama)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();
    if (juri?.email) return { email: juri.email as string };

    // Fallback: cari di profiles → auth users.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("nama", data.nama)
      .limit(1)
      .maybeSingle();
    if (profile?.id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (u?.user?.email) return { email: u.user.email };
    }
    return { email: null as string | null };
  });
