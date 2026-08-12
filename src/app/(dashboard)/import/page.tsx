import { PageHeader } from "@/components/shared/page-header";
import { ImportWorkspace } from "@/components/import/import-workspace";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Import & queue"
        description="Add companies by CSV or manually, choose the ICP for this batch, then run the validation gate and enrichment."
      />
      <ImportWorkspace />
    </div>
  );
}
