import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  component: () => <Outlet />,
});
