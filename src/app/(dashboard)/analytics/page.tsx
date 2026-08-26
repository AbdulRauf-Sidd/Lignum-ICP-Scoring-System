import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { getMonthlyScoredTrend, getSectorPerformance, getTierDistribution, getCompanyCountBySector } from "@/lib/data/analytics";
import { requireUser } from "@/lib/supabase/auth-server";

// Scoring outcomes change as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireUser();
  const [trend, sectorPerf, tierDist, companiesBySector] = await Promise.all([
    getMonthlyScoredTrend(),
    getSectorPerformance(),
    getTierDistribution(),
    getCompanyCountBySector(),
  ]);

  return (
    <div>
      <PageHeader title="Analytics" description="Scoring trends and sector breakdown." />
      <AnalyticsWorkspace
        trend={trend}
        sectorPerf={sectorPerf}
        tierDist={tierDist}
        companiesBySector={companiesBySector}
      />
    </div>
  );
}
