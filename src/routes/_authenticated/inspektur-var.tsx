import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import IpVarKoreksi from "@/components/IpVarKoreksi";
import KeberatanTab from "@/components/KeberatanTab";
import PerbaikanNotifikasi from "@/components/PerbaikanNotifikasi";
import PerbaikanAktifPanel from "@/components/PerbaikanAktifPanel";

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
  const [modeInsp, setModeInsp] = useState<number>(2);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setAllowed(false); return; }
      const [{ data: isVar }, { data: modeData }] = await Promise.all([
        supabase.rpc("is_inspektur_var", { _uid: uid } as never),
        supabase.rpc("get_mode_inspektur" as never),
      ]);
      setAllowed(!!isVar);
      setModeInsp(Number(modeData) || 2);
    })();
  }, []);

  if (allowed === null) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;
  if (!allowed) return <div className="p-8 text-center text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</div>;

  const keberatanLocked = modeInsp === 1;

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
          <TabsList className={keberatanLocked ? "grid w-full grid-cols-2" : "grid w-full grid-cols-3"}>
            <TabsTrigger value="var" className="gap-2"><Gavel className="size-4" />VAR</TabsTrigger>
            {!keberatanLocked && (
              <TabsTrigger value="keberatan" className="gap-2"><FileWarning className="size-4" />Keberatan</TabsTrigger>
            )}
            <TabsTrigger value="pk" className="gap-2"><Undo2 className="size-4" />Peninjauan</TabsTrigger>
          </TabsList>
          <TabsContent value="var" className="mt-4 space-y-4">
            <PerbaikanNotifikasi canOpen />
            <PerbaikanAktifPanel mode="inspektur" />
            <IpVarKoreksi />
          </TabsContent>

          {!keberatanLocked && (
            <TabsContent value="keberatan" className="mt-4"><KeberatanTab /></TabsContent>
          )}
          {keberatanLocked && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800">
              <b>Mode 1 aktif.</b> Pengajuan keberatan peserta dinonaktifkan. Inspektur Pertandingan menangani langsung.
            </div>
          )}
          <TabsContent value="pk" className="mt-4"><PeninjauanTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
