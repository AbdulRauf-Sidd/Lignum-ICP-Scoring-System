import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Activity on trend charts by period, attributed to real signed-in users."
      />
      <AnalyticsWorkspace />
    </div>
  );
}
