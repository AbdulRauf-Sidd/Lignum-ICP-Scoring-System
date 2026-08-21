import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  UploadCloud,
  ListChecks,
  Target,
  Users,
  Activity,
  BarChart3,
  Settings2,
  Building2,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: "Prospects" | "Oversight" | "Accounts" | "Admin";
  badgeKey?: "triage";
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Sparkles },
  { href: "/import", label: "Import & queue", icon: UploadCloud },
  { href: "/triage", label: "Triage", icon: ListChecks, group: "Prospects", badgeKey: "triage" },
  { href: "/target-list", label: "Target list", icon: Target, group: "Prospects" },
  { href: "/contacts", label: "Contacts", icon: Users, group: "Prospects" },
  { href: "/usage", label: "Usage & audit", icon: Activity, group: "Oversight" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "Oversight" },
  { href: "/accounts", label: "Accounts", icon: Building2, group: "Accounts", adminOnly: true },
  { href: "/admin/config", label: "Model config", icon: Settings2, group: "Admin", adminOnly: true },
];
