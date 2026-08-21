import { PageHeader } from "@/components/shared/page-header";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import { getAccountsData } from "@/lib/data/accounts";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Client roster and ratings can change any time — never freeze this page.
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireAdmin();
  const data = await getAccountsData();

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Companies that have converted to clients, with monitoring, qualitative scoring and manual Talent Insights."
      />
      <AccountsWorkspace data={data} now={new Date().toISOString()} />
    </div>
  );
}
