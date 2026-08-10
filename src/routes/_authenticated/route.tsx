import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Runs on initial load, hard refresh, and every navigation into a route under
  // this layout — so single-device enforcement kicks in without waiting for a
  // background poll.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    try {
      const local = typeof window !== "undefined"
        ? localStorage.getItem("device_session_id")
        : null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_session_id")
        .eq("id", data.user.id)
        .maybeSingle();

      // First visit after login: adopt local session id as the active one.
      if (prof && !prof.active_session_id && local) {
        await supabase
          .from("profiles")
          .update({ active_session_id: local })
          .eq("id", data.user.id);
      } else if (
        prof?.active_session_id &&
        (!local || prof.active_session_id !== local)
      ) {
        // Another device took over — sign this one out.
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
    } catch (err) {
      // Rethrow redirect; swallow transient network errors.
      if (err && typeof err === "object" && "to" in err) throw err;
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  // Single-device enforcement across ALL authenticated pages (dashboard,
  // operator, inspektur, dll). Tanpa polling ini, user yang login di device B
  // tidak menendang keluar device A selama A tidak berpindah halaman.
  useEffect(() => {
    let stopped = false;
    async function check() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("active_session_id")
          .eq("id", uid)
          .maybeSingle();
        const local = localStorage.getItem("device_session_id");
        if (prof && !prof.active_session_id && local) {
          await supabase.from("profiles").update({ active_session_id: local }).eq("id", uid);
          return;
        }
        if (prof?.active_session_id && local && prof.active_session_id !== local) {
          if (stopped) return;
          toast.error("Akun Anda login di perangkat lain. Sesi ini akan dikeluarkan.");
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
        }
      } catch {
        // abaikan — cek berikutnya akan mencoba lagi
      }
    }
    check();
    const id = setInterval(check, 20000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);

  return <Outlet />;
}
