import { PageHeader } from "@/components/shared/page-header";
import { ConfigWorkspace } from "@/components/admin/config-workspace";
import { getIcpProfiles, getSectorTaxonomy } from "@/lib/data/icp-profiles";
import { getModelSettings } from "@/lib/data/model-settings";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Admins edit this live — never freeze it.
export const dynamic = "force-dynamic";

export default async function ModelConfigPage() {
  await requireAdmin();
  const [profiles, taxonomy, settings] = await Promise.all([getIcpProfiles(), getSectorTaxonomy(), getModelSettings()]);

  return (
    <div>
      <PageHeader title="Model config" description="Weights, bands and target sectors, per ICP — applied on the next score or re-score." />
      <ConfigWorkspace profiles={profiles} taxonomy={taxonomy} settings={settings} />
    </div>
  );
}
