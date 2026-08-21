import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { getMonthlyScoredTrend, getSectorPerformance, getTierDistribution } from "@/lib/data/analytics";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Scoring outcomes change as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAdmin();
  const [trend, sectorPerf, tierDist] = await Promise.all([
    getMonthlyScoredTrend(),
    getSectorPerformance(),
    getTierDistribution(),
  ]);

  return (
    <div>
      <PageHeader title="Analytics" description="Scoring outcomes across sectors, tiers and time." />
      <AnalyticsWorkspace trend={trend} sectorPerf={sectorPerf} tierDist={tierDist} />
    </div>
  );
}
