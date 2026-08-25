"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import type { UserRole } from "@/lib/supabase/auth-server";

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export async function createUser(input: CreateUserInput) {
  await requireAdmin();

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: input.fullName.trim() ? { full_name: input.fullName.trim() } : {},
  });

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, role: UserRole) {
  const me = await requireAdmin();
  if (userId === me.id && role !== "admin") {
    throw new Error("You can't remove your own admin access.");
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { app_metadata: { role } });
  if (error) throw new Error(`Failed to update role: ${error.message}`);
  revalidatePath("/admin/users");
}
