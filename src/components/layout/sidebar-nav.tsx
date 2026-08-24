"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { LinkLoadingIcon } from "@/components/layout/link-loading-icon";

const GROUP_ORDER = ["Prospects", "Oversight", "Accounts", "Admin"] as const;

function NavLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count: number | undefined;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      <LinkLoadingIcon />
      {!!count && (
        <Badge
          variant={active ? "secondary" : "outline"}
          className={cn(
            "h-5 min-w-5 justify-center px-1 text-[11px]",
            !active && "border-sidebar-border text-sidebar-foreground",
          )}
        >
          {count}
        </Badge>
      )}
    </Link>
  );
}

export function SidebarNav({
  counts,
  isAdmin,
  onNavigate,
}: {
  counts: Partial<Record<"triage", number>>;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const topLevelItems = NAV_ITEMS.filter((i) => !i.group && (!i.adminOnly || isAdmin));

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {topLevelItems.length > 0 && (
        <div className="flex flex-col gap-1">
          {topLevelItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              count={item.badgeKey ? counts[item.badgeKey] : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
      {GROUP_ORDER.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group && (!i.adminOnly || isAdmin));
        if (items.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {group}
            </p>
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                count={item.badgeKey ? counts[item.badgeKey] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
