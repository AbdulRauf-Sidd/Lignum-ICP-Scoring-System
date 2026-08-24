"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { Menu, LogOut, Bell, Plus, ChevronUp } from "lucide-react";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { LinkLoadingIcon } from "@/components/layout/link-loading-icon";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  PageHeaderProvider,
  usePageHeaderContent,
} from "@/components/layout/page-header-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/supabase/auth-actions";
import type { SessionUser } from "@/lib/supabase/auth-server";

export function AppShell({
  children,
  triageCount,
  user,
}: {
  children: React.ReactNode;
  triageCount: number;
  user: SessionUser;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const counts = { triage: triageCount };
  const isAdmin = user.role === "admin";
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <PageHeaderProvider>
      <div className="flex h-svh w-full bg-background">
        <AutoRefresh />
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <SidebarBrand />
          <SidebarNav counts={counts} isAdmin={isAdmin} />
          <SidebarAccount user={user} initials={initials} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[66px] shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col gap-0 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarBrand />
                <SidebarNav
                  counts={counts}
                  isAdmin={isAdmin}
                  onNavigate={() => setMobileOpen(false)}
                />
                <SidebarAccount user={user} initials={initials} />
              </SheetContent>
            </Sheet>

            <HeaderTitle />

            <Button
              variant="outline"
              size="icon-lg"
              className="relative shrink-0"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {triageCount > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center border-2 border-background bg-primary px-1 font-mono text-[10px] text-primary-foreground">
                  {triageCount}
                </Badge>
              )}
            </Button>
            <ThemeToggle className="size-9 shrink-0" />

            <Button asChild size="lg" className="h-9 shrink-0 gap-1.5 px-4">
              <Link href="/import">
                <Plus className="size-4" /> Add company <LinkLoadingIcon />
              </Link>
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
              <ViewTransition default="dashboard-page">{children}</ViewTransition>
            </div>
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}

function HeaderTitle() {
  const { content } = usePageHeaderContent();
  return (
    <div className="min-w-0 flex-1">
      {content && (
        <>
          <h1 className="truncate font-heading text-lg leading-tight font-bold tracking-tight text-foreground">
            {content.title}
          </h1>
          {content.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {content.description}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SidebarAccount({ user, initials }: { user: SessionUser; initials: string }) {
  return (
    <div className="mt-auto shrink-0 border-t border-sidebar-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-sidebar-accent">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.email}</p>
              <p className="text-[11px] capitalize text-sidebar-foreground/60">{user.role}</p>
            </div>
            <ChevronUp className="size-3.5 shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()} variant="destructive">
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarBrand() {
  return (
    <Link
      href="/"
      className="flex shrink-0 flex-col gap-2 border-b border-sidebar-border px-[22px] pt-6 pb-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="h-[30px] w-[13px] shrink-0 rounded-[1px] bg-sidebar-primary" />
        <span className="font-heading text-[23px] leading-none font-extrabold tracking-wide text-sidebar-foreground uppercase">
          Lignum
        </span>
        <LinkLoadingIcon />
      </div>
      <span className="ml-[22px] font-mono text-[9.5px] tracking-[0.26em] text-sidebar-foreground/60 uppercase">
        ICP Scoring
      </span>
    </Link>
  );
}
