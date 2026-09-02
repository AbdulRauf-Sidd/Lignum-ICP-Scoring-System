import { PageHeader } from "@/components/shared/page-header";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import { getAccountsList, getAccountHeader, getAccountJobs } from "@/lib/data/accounts";
import { getAccountMetrics } from "@/app/(dashboard)/accounts/actions";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Synced from Loxo on its own schedule, and status/owner are edited live —
// never freeze this page.
export const dynamic = "force-dynamic";

// Used to pair with the account's lifetime total_revenue for Price/CV and
// Price/Interview — those only make sense against all-time counts, not
// whatever date range happens to be selected in the metrics section.
const EPOCH = "1970-01-01T00:00:00.000Z";

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await requireAdmin();
  const params = await searchParams;
  const companyParam = Array.isArray(params.company) ? params.company[0] : params.company;

  const accounts = await getAccountsList();
  const selectedCompanyId = companyParam ? Number(companyParam) : null;

  const [header, jobs, lifetime] = selectedCompanyId
    ? await Promise.all([
        getAccountHeader(selectedCompanyId),
        getAccountJobs(selectedCompanyId),
        getAccountMetrics(selectedCompanyId, EPOCH, new Date().toISOString()),
      ])
    : [null, [], null];

  return (
    <div>
      <PageHeader title="Accounts" description="Company records synced from Loxo — jobs, candidates and placements." />
      <AccountsWorkspace
        accounts={accounts}
        selectedCompanyId={selectedCompanyId}
        header={header}
        jobs={jobs}
        lifetime={lifetime}
      />
    </div>
  );
}
