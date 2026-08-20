import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getTriageCount } from "@/lib/data/companies";

// The triage count shown in the sidebar changes as n8n runs — never freeze it.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const triageCount = await getTriageCount();

  return <AppShell triageCount={triageCount}>{children}</AppShell>;
}
