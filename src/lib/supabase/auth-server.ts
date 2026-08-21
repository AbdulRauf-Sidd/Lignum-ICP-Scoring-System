import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// For Server Components/Actions/Route Handlers that need to know who's
// signed in. Cookie writes are wrapped in try/catch because Server
// Components can't set cookies — middleware is what actually persists a
// refreshed session; this client just needs to be able to read one.
export async function getSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — no-op, middleware handles refresh.
        }
      },
    },
  });
}

export type UserRole = "admin" | "user";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const role: UserRole = user.app_metadata?.role === "admin" ? "admin" : "user";
  const name: string = user.user_metadata?.full_name || user.email.split("@")[0];

  return { id: user.id, email: user.email, name, role };
}

// Belt-and-suspenders check for admin-only pages — middleware already
// blocks these routes for non-admins, but a Server Component shouldn't rely
// on that alone.
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}
