import { PageHeader } from "@/components/shared/page-header";
import { UsageWorkspace } from "@/components/usage/usage-workspace";

export default function UsagePage() {
  return (
    <div>
      <PageHeader
        title="Usage & audit"
        description="Credits and reports as counts (Cognism, Creditsafe), metered spend in pounds (Firecrawl, Exa, LLM). Grouped by run."
      />
      <UsageWorkspace />
    </div>
  );
}
