import { PageHeader } from "@/components/shared/page-header";
import { TargetListWorkspace } from "@/components/target-list/target-list-workspace";
import { getScoredCompanies } from "@/lib/data/companies";

// Data changes as n8n writes new rows — always fetch fresh, never freeze
// this at build time.
export const dynamic = "force-dynamic";

export default async function TargetListPage({ searchParams }: PageProps<"/target-list">) {
  const params = await searchParams;
  const search = Array.isArray(params.q) ? params.q[0] : params.q;
  const companies = await getScoredCompanies(search);

  return (
    <div>
      <PageHeader
        title="Target list"
        description="Approved companies ranked by score, tabbed by ICP. Shared across the team."
      />
      <TargetListWorkspace companies={companies} initialSearch={search ?? ""} />
    </div>
  );
}
