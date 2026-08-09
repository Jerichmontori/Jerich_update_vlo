import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/bumotik-black.png.asset.json";

export type Branding = {
  logoUrl: string;
  kicker: string;
  judul: string;
  subjudul: string;
};

export const DEFAULT_BRANDING: Branding = {
  logoUrl: defaultLogo.url,
  kicker: "Lomba Rohani",
  judul: "Sistem Penjurian Baca Mazmur",
  subjudul: "Kelola peserta, juri, kriteria, dan lihat ranking secara langsung.",
};

let cache: Branding | null = null;
const listeners = new Set<(b: Branding) => void>();

export function normalizeBranding(raw: any): Branding {
  const v = raw && typeof raw === "object" ? raw : {};
  return {
    logoUrl: typeof v.logoUrl === "string" && v.logoUrl ? v.logoUrl : DEFAULT_BRANDING.logoUrl,
    kicker: typeof v.kicker === "string" && v.kicker ? v.kicker : DEFAULT_BRANDING.kicker,
    judul: typeof v.judul === "string" && v.judul ? v.judul : DEFAULT_BRANDING.judul,
    subjudul: typeof v.subjudul === "string" ? v.subjudul || DEFAULT_BRANDING.subjudul : DEFAULT_BRANDING.subjudul,
  };
}

export function setBrandingCache(b: Branding) {
  cache = b;
  listeners.forEach((fn) => fn(b));
}

export async function fetchBranding(): Promise<Branding> {
  const { data } = await supabase.rpc("get_branding" as any);
  const b = normalizeBranding(data);
  setBrandingCache(b);
  return b;
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cache ?? DEFAULT_BRANDING);

  useEffect(() => {
    listeners.add(setBranding);
    fetchBranding().catch(() => {});
    return () => {
      listeners.delete(setBranding);
    };
  }, []);

  return branding;
}
