import { PageHeader } from "@/components/shared/page-header";
import { ConfigWorkspace } from "@/components/admin/config-workspace";
import { getIcpProfiles, getSectorTaxonomy } from "@/lib/data/icp-profiles";

// Admins edit this live — never freeze it.
export const dynamic = "force-dynamic";

export default async function ModelConfigPage() {
  const [profiles, taxonomy] = await Promise.all([getIcpProfiles(), getSectorTaxonomy()]);

  return (
    <div>
      <PageHeader
        title="Model config"
        description="Admin only. Per-ICP weights and target sectors, plus the active sector taxonomy. Changes apply on the next score or re-score, with no new API spend."
      />
      <ConfigWorkspace profiles={profiles} taxonomy={taxonomy} />
    </div>
  );
}
