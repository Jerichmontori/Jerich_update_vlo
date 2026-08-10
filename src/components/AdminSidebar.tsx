import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Trophy,
  Radio,
  ClipboardCheck,
  Users,
  Gavel,
  ListChecks,
  BookOpenText,
  AlertTriangle,
} from "lucide-react";

export type AdminSection =
  | "dashboard"
  | "hasil"
  | "live"
  | "penilaian"
  | "var"
  | "peserta"
  | "juri"
  | "pengaturan-nilai"
  | "mazmur";

type Item = { value: AdminSection; label: string; icon: typeof LayoutDashboard };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Utama",
    items: [
      { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { value: "hasil", label: "Hasil Nilai", icon: Trophy },
      { value: "live", label: "Live Ranking", icon: Radio },
      { value: "penilaian", label: "Penilaian", icon: ClipboardCheck },
      { value: "var", label: "Potensi VAR", icon: AlertTriangle },
    ],
  },

  {
    label: "Data Master",
    items: [
      { value: "peserta", label: "Peserta", icon: Users },
      { value: "juri", label: "User", icon: Gavel },
      { value: "pengaturan-nilai", label: "Kriteria & Kategori", icon: ListChecks },
      { value: "mazmur", label: "Mazmur", icon: BookOpenText },
    ],
  },
];

export const ADMIN_SECTION_LABEL: Record<AdminSection, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label])),
) as Record<AdminSection, string>;

export default function AdminSidebar({
  value,
  onChange,
}: {
  value: AdminSection;
  onChange: (v: AdminSection) => void;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      isActive={value === item.value}
                      tooltip={item.label}
                      onClick={() => {
                        onChange(item.value);
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
