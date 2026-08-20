import { PageHeader } from "@/components/shared/page-header";
import { UsageWorkspace } from "@/components/usage/usage-workspace";
import { getUsageRuns } from "@/lib/data/usage";

// Usage log grows as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const runs = await getUsageRuns();

  return (
    <div>
      <PageHeader
        title="Usage & audit"
        description="Credits and reports (Cognism, Creditsafe) and metered cost, grouped by run."
      />
      <UsageWorkspace runs={runs} />
    </div>
  );
}
