import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TriageWorkspace } from "@/components/triage/triage-workspace";
import { getTriageCompanies } from "@/lib/data/companies";
import { getIcpProfiles } from "@/lib/data/icp-profiles";

// Companies move in and out of triage as n8n runs — never freeze this list.
export const dynamic = "force-dynamic";

export default async function TriagePage() {
  const [companies, profiles] = await Promise.all([getTriageCompanies(), getIcpProfiles()]);

  return (
    <div>
      <PageHeader
        title="Triage"
        description="Companies scored from your own runs land here first. Confirm ambiguous entities, review low-confidence sectors, then approve to the target list."
      />
      <Suspense>
        <TriageWorkspace companies={companies} profiles={profiles} />
      </Suspense>
    </div>
  );
}
