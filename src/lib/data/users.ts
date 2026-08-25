import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/auth-server";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastSignInAt: string | null;
}

export async function getUsers(): Promise<AppUser[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Failed to load users: ${error.message}`);

  return data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.full_name as string | undefined) || (u.email ?? "").split("@")[0],
      role: (u.app_metadata?.role === "admin" ? "admin" : "user") as UserRole,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
