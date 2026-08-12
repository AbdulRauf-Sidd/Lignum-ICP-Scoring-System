import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TriageWorkspace } from "@/components/triage/triage-workspace";

export default function TriagePage() {
  return (
    <div>
      <PageHeader
        title="Triage"
        description="Companies scored from your own runs land here first. Confirm ambiguous entities, review low-confidence sectors, then approve to the target list."
      />
      <Suspense>
        <TriageWorkspace />
      </Suspense>
    </div>
  );
}
