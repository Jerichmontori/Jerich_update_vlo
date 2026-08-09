import { useBranding } from "@/hooks/useBranding";

export default function BrandLogo({ className }: { className?: string }) {
  const { logoUrl, judul } = useBranding();
  return <img src={logoUrl} alt={`Logo ${judul}`} className={className} width={480} height={130} />;
}
