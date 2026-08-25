import { PageHeader } from "@/components/shared/page-header";
import { UsersWorkspace } from "@/components/admin/users-workspace";
import { getUsers } from "@/lib/data/users";
import { requireAdmin } from "@/lib/supabase/auth-server";

// New accounts can be added at any time — never freeze this page.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await getUsers();

  return (
    <div>
      <PageHeader title="Users" description="Who can sign in, and what they can reach." />
      <UsersWorkspace users={users} currentUserId={me.id} />
    </div>
  );
}
