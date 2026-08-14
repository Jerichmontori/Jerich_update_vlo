import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import IpVarKoreksi from "@/components/IpVarKoreksi";
import KeberatanTab from "@/components/KeberatanTab";
import PerbaikanNotifikasi from "@/components/PerbaikanNotifikasi";

import PeninjauanTab from "@/components/PeninjauanTab";
import BrandLogo from "@/components/BrandLogo";
import { LogOut, Gavel, FileWarning, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inspektur-var")({
  component: InspekturVarPage,
  head: () => ({
    meta: [
      { title: "Inspektur VAR | Lomba Bumotik Bermazmur" },
      { name: "description", content: "Panel Inspektur VAR untuk koreksi VAR, keberatan peserta, dan peninjauan kembali." },
      { property: "og:title", content: "Panel Inspektur VAR" },
      { property: "og:description", content: "Penyelesaian VAR dan keberatan Lomba Bumotik Bermazmur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function InspekturVarPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setAllowed(false); return; }
      const [{ data: isIp2 }, { data: isAdm }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "inspektur_var" as never }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" as never }),
      ]);
      setAllowed(!!isIp2 || !!isAdm);
    })();
  }, []);

  if (allowed === null) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;
  if (!allowed) return <div className="p-8 text-center text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</div>;

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <BrandLogo className="size-10" />
          <div>
            <h1 className="text-lg font-semibold">Inspektur VAR</h1>
            <p className="text-xs text-muted-foreground">Penyelesaian VAR, keberatan, dan peninjauan kembali</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
          >
            <LogOut className="size-4" />Keluar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="var">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="var" className="gap-2"><Gavel className="size-4" />VAR</TabsTrigger>
            <TabsTrigger value="keberatan" className="gap-2"><FileWarning className="size-4" />Keberatan</TabsTrigger>
            <TabsTrigger value="pk" className="gap-2"><Undo2 className="size-4" />Peninjauan</TabsTrigger>
          </TabsList>
          <TabsContent value="var" className="mt-4 space-y-4">
            <PerbaikanNotifikasi canOpen />
            <IpVarKoreksi />
          </TabsContent>

          <TabsContent value="keberatan" className="mt-4"><KeberatanTab /></TabsContent>
          <TabsContent value="pk" className="mt-4"><PeninjauanTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
