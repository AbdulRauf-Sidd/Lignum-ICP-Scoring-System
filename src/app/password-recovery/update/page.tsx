import { redirect } from "next/navigation";
import { PasswordRecoveryUpdate } from "@/components/auth/password-recovery-update";
import { getSessionUser } from "@/lib/supabase/auth-server";

export default async function PasswordRecoveryUpdatePage() {
  const user = await getSessionUser();
  if (!user) redirect("/password-recovery?error=invalid_link");
  return <PasswordRecoveryUpdate />;
}
