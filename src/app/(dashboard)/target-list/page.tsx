import { PageHeader } from "@/components/shared/page-header";
import { TargetListWorkspace } from "@/components/target-list/target-list-workspace";

export default function TargetListPage() {
  return (
    <div>
      <PageHeader
        title="Target list"
        description="Approved companies ranked by score, tabbed by ICP. Shared across the team."
      />
      <TargetListWorkspace />
    </div>
  );
}
