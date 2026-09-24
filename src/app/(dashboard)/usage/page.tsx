import { PageHeader } from "@/components/shared/page-header";
import { UsageWorkspace } from "@/components/usage/usage-workspace";
import { getCreditsafeBalances, getUsageRuns } from "@/lib/data/usage";
import { requireUser } from "@/lib/supabase/auth-server";

// Usage log grows as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  await requireUser();
  const [runs, creditsafeBalances] = await Promise.all([getUsageRuns(), getCreditsafeBalances()]);

  return (
    <div>
      <PageHeader
        title="Usage & audit"
        description="Credits spent on Cognism and Creditsafe redeems, grouped by run."
      />
      <UsageWorkspace runs={runs} creditsafeBalances={creditsafeBalances} />
    </div>
  );
}
