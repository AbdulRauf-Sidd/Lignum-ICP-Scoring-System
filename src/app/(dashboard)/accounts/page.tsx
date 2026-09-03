import { PageHeader } from "@/components/shared/page-header";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import { getAccountsList, getAccountHeader, getAccountJobs } from "@/lib/data/accounts";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Synced from Loxo on its own schedule, and status/owner are edited live —
// never freeze this page.
export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await requireAdmin();
  const params = await searchParams;
  const companyParam = Array.isArray(params.company) ? params.company[0] : params.company;

  const accounts = await getAccountsList();
  const selectedCompanyId = companyParam ? Number(companyParam) : null;

  const [header, jobs] = selectedCompanyId
    ? await Promise.all([getAccountHeader(selectedCompanyId), getAccountJobs(selectedCompanyId)])
    : [null, []];

  return (
    <div>
      <PageHeader title="Accounts" description="Company records synced from Loxo - jobs, candidates and placements." />
      <AccountsWorkspace accounts={accounts} selectedCompanyId={selectedCompanyId} header={header} jobs={jobs} />
    </div>
  );
}
