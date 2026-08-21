import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { getMonthlyScoredTrend, getSectorPerformance, getTierDistribution, getCompanyCountBySector } from "@/lib/data/analytics";
import { getUserActivity, getWeeklyActivityByUser } from "@/lib/data/analytics-activity";
import { requireUser } from "@/lib/supabase/auth-server";

// Scoring outcomes change as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

const MAX_WEEKS = 12;

export default async function AnalyticsPage() {
  await requireUser();
  const [trend, sectorPerf, tierDist, companiesBySector] = await Promise.all([
    getMonthlyScoredTrend(),
    getSectorPerformance(),
    getTierDistribution(),
    getCompanyCountBySector(),
  ]);
  const userActivity = getUserActivity();
  const weeklyByMetric = {
    companies: getWeeklyActivityByUser("companies", MAX_WEEKS, userActivity),
    contacts: getWeeklyActivityByUser("contacts", MAX_WEEKS, userActivity),
    csvs: getWeeklyActivityByUser("csvs", MAX_WEEKS, userActivity),
  };

  return (
    <div>
      <PageHeader title="Analytics" description="Team activity and trends — imports, companies, contacts and sectors." />
      <AnalyticsWorkspace
        trend={trend}
        sectorPerf={sectorPerf}
        tierDist={tierDist}
        userActivity={userActivity}
        weeklyByMetric={weeklyByMetric}
        companiesBySector={companiesBySector}
      />
    </div>
  );
}
