"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Bell, Layers } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CURRENT_USER } from "@/lib/constants";
import { COMPANIES, NOTIFICATIONS } from "@/lib/mock/data";
import { formatRelativeTime } from "@/lib/format";
import { NOTIFICATION_ICONS, NOTIFICATION_LABELS } from "@/lib/notification-meta";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const triageCount = COMPANIES.filter((c) => c.status === "triage").length;
  const unreadNotifications = NOTIFICATIONS.filter((n) => !n.read);

  const counts = { triage: triageCount, notifications: unreadNotifications.length };

  return (
    <div className="flex min-h-svh w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarBrand />
        <SidebarNav counts={counts} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBrand />
              <SidebarNav counts={counts} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-destructive" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="text-sm font-medium">Notifications</p>
                <Badge variant="secondary">{unreadNotifications.length} unread</Badge>
              </div>
              <ScrollArea className="h-80">
                <div className="flex flex-col divide-y">
                  {NOTIFICATIONS.slice(0, 15).map((n) => {
                    const Icon = NOTIFICATION_ICONS[n.type];
                    return (
                      <div key={n.id} className="flex gap-2.5 px-3 py-2.5">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {NOTIFICATION_LABELS[n.type]}
                          </p>
                          <p className={n.read ? "text-sm text-muted-foreground" : "text-sm"}>
                            {n.message}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                        {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <ThemeToggle />

          <div className="ml-1 flex items-center gap-2 border-l pl-3">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{CURRENT_USER.initials}</AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium">{CURRENT_USER.name}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{CURRENT_USER.role}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarBrand() {
  return (
    <Link href="/" className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
      <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Layers className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">Lignum</p>
        <p className="text-[11px] text-muted-foreground">ICP Scoring</p>
      </div>
    </Link>
  );
}
