import { PageHeader } from "@/components/shared/page-header";
import { ImportWorkspace } from "@/components/import/import-workspace";
import { getHomeStats, getEnrichmentQueue } from "@/lib/data/companies";
import { getIcpProfiles } from "@/lib/data/icp-profiles";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [stats, queue, profiles] = await Promise.all([getHomeStats(), getEnrichmentQueue(), getIcpProfiles()]);
  return (
    <div>
      <PageHeader
        title="Import & queue"
        description="Add companies by CSV or manually, then run the validation gate and enrichment. Sector and sub-sector are assigned automatically during classification."
      />
      <ImportWorkspace
        inProgressCount={stats.inProgressCount}
        failedCount={stats.failedCount}
        scoredThisWeekCount={stats.scoredThisWeekCount}
        queue={queue}
        profiles={profiles}
      />
    </div>
  );
}
