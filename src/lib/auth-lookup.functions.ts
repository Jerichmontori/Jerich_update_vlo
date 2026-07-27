import { createServerFn } from "@tanstack/react-start";

type SignInInput = { identifier: string; password: string };

/**
 * Server-side sign-in that supports either an email or an exact judge name
 * as the identifier. The email is never returned to the client — we do the
 * password check on the server and return only the resulting session tokens
 * (or a generic error) so that an anonymous caller cannot enumerate users
 * or harvest email addresses.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data: SignInInput) => {
    const identifier = String(data?.identifier ?? "").trim();
    const password = String(data?.password ?? "");
    if (!identifier || identifier.length > 200) {
      throw new Error("Identitas tidak valid");
    }
    if (!password || password.length < 6 || password.length > 200) {
      throw new Error("Kata sandi tidak valid");
    }
    return { identifier, password };
  })
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

    let email: string | null = null;

    if (data.identifier.includes("@")) {
      email = data.identifier;
    } else {
      // Exact-match lookup only. No wildcard/ilike; no email returned to client.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: juri } = await supabaseAdmin
        .from("juri")
        .select("email")
        .eq("nama", data.identifier)
        .not("email", "is", null)
        .limit(1)
        .maybeSingle();
      if (juri?.email) {
        email = juri.email as string;
      } else {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("nama", data.identifier)
          .limit(1)
          .maybeSingle();
        if (profile?.id) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          if (u?.user?.email) email = u.user.email;
        }
      }
    }

    // Generic error so callers cannot distinguish "unknown name" from "wrong password"
    if (!email) {
      throw new Error("Email atau kata sandi salah");
    }

    // Perform the sign-in with the publishable key — never with the service role.
    const { createClient } = await import("@supabase/supabase-js");
    const isNewKey =
      SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") ||
      SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_");
    const supabasePublic = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers as HeadersInit | undefined);
          if (isNewKey && headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
          return fetch(input as any, { ...init, headers });
        },
      },
    });

    const { data: signIn, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !signIn?.session) {
      throw new Error("Email atau kata sandi salah");
    }

    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      user_id: signIn.user?.id ?? null,
    };
  });
