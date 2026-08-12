import { PageHeader } from "@/components/shared/page-header";
import { ConfigWorkspace } from "@/components/admin/config-workspace";

export default function ModelConfigPage() {
  return (
    <div>
      <PageHeader
        title="Model config"
        description="Admin only. Per-ICP weights, bands and thresholds. Changes apply on the next score or re-score, with no new API spend."
      />
      <ConfigWorkspace />
    </div>
  );
}
