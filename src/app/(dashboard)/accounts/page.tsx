import { PageHeader } from "@/components/shared/page-header";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";

export default function AccountsPage() {
  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Companies that have converted to clients, with monitoring, qualitative scoring and manual Talent Insights."
      />
      <AccountsWorkspace />
    </div>
  );
}
