import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getTriageCount } from "@/lib/data/companies";
import { getSessionUser } from "@/lib/supabase/auth-server";

// The triage count shown in the sidebar changes as n8n runs — never freeze it.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Middleware already enforces this, but a Server Component shouldn't
  // trust that alone — check again before rendering anything.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const triageCount = await getTriageCount();

  return (
    <AppShell triageCount={triageCount} user={user}>
      {children}
    </AppShell>
  );
}
