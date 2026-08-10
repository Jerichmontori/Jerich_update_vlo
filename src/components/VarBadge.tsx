import { Badge } from "@/components/ui/badge";
import { varStatusLabel, isVarAktif, type VarStatus } from "@/lib/varStatus";
import { AlertTriangle } from "lucide-react";

/**
 * Badge status VAR yang seragam untuk semua role
 * (Operator Lomba, Inspektur, Inspektur VAR, Operator vMix, Sekretariat, Admin).
 */
export default function VarBadge({
  status,
  className = "",
  compact = false,
}: {
  status: VarStatus;
  className?: string;
  compact?: boolean;
}) {
  if (!isVarAktif(status)) return null;
  const label = varStatusLabel(status);
  if (!label) return null;
  return (
    <Badge
      className={`gap-1 whitespace-nowrap bg-rose-600 text-white hover:bg-rose-600 ${className}`}
    >
      <AlertTriangle className="size-3 shrink-0 animate-pulse" />
      {compact ? "VAR" : label}
    </Badge>
  );
}
