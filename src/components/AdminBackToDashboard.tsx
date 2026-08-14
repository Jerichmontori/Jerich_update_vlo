import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tombol melayang untuk kembali ke Dashboard Admin.
 * Hanya tampil bagi pengguna dengan role admin, dan disembunyikan
 * saat sedang berada di halaman dashboard atau halaman auth.
 */
export default function AdminBackToDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const { data: adm } = await supabase.rpc("has_role", {
          _user_id: uid,
          _role: "admin" as never,
        });
        if (!cancelled) setIsAdmin(Boolean(adm));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const hidden = pathname.startsWith("/dashboard") || pathname.startsWith("/auth") || pathname.startsWith("/vmix");
  if (!isAdmin || hidden) return null;

  return (
    <Link
      to="/dashboard"
      aria-label="Kembali ke Dashboard Admin"
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 print:hidden"
    >
      <LayoutDashboard className="h-4 w-4" />
      <span className="hidden sm:inline">Dashboard Admin</span>
    </Link>
  );
}
