import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/hooks/usePolling";

/**
 * Status VAR per peserta ({ [peserta_id]: status }) — sumber tunggal yang
 * dipakai bersama oleh semua role agar tampilannya sinkron.
 */
export function useVarStatus(enabled = true, intervalMs = 20000) {
  const [varMap, setVarMap] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc("operator_var_status" as never);
    if (error) return;
    setVarMap(((data as unknown) ?? {}) as Record<string, string>);
  }, []);

  usePolling(() => { void reload(); }, intervalMs, enabled);

  return { varMap, reloadVarStatus: reload };
}
