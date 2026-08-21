"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Layers, LogOut } from "lucide-react";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    <div className="flex min-h-svh w-full bg-background">
      <AutoRefresh />
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarBrand />
        <SidebarNav counts={counts} isAdmin={isAdmin} />
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
              <SidebarNav counts={counts} isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex items-center gap-2 rounded-md border-l pl-3 outline-none">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="max-w-40 truncate text-sm font-medium">{user.email}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">{user.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
