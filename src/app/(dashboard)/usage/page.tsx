import { PageHeader } from "@/components/shared/page-header";
import { UsageWorkspace } from "@/components/usage/usage-workspace";
import { getUsageRuns } from "@/lib/data/usage";
import { getModelSettings } from "@/lib/data/model-settings";
import { requireUser } from "@/lib/supabase/auth-server";

// Usage log grows as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  await requireUser();
  const [runs, settings] = await Promise.all([getUsageRuns(), getModelSettings()]);

  return (
    <div>
      <PageHeader
        title="Usage & audit"
        description="Credits spent on Cognism and Creditsafe redeems, grouped by run."
      />
      <UsageWorkspace runs={runs} indicativePricePerCredit={settings.indicative_price_per_credit} />
    </div>
  );
}
