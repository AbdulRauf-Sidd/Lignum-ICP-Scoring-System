"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/supabase/auth-server";
import { DEFAULT_USER_MODULES, normalizeModules, type AppModule } from "@/lib/modules";

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  modules?: AppModule[];
}

export async function createUser(input: CreateUserInput) {
  await requireModule("admin");

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { modules: normalizeModules(input.modules ?? DEFAULT_USER_MODULES) },
    user_metadata: input.fullName.trim() ? { full_name: input.fullName.trim() } : {},
  });

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  revalidatePath("/admin/users");
}

export async function updateUserModules(userId: string, modules: AppModule[]) {
  const me = await requireModule("admin");
  const selected = normalizeModules(modules);
  if (userId === me.id && !selected.includes("admin")) throw new Error("You can't remove your own admin module.");
  const supabase = getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) throw new Error(`Failed to load user: ${userError.message}`);
  const currentMetadata = userData.user.app_metadata ?? {};
  delete currentMetadata.role;
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...currentMetadata, modules: selected },
  });
  if (error) throw new Error(`Failed to update modules: ${error.message}`);
  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, active: boolean) {
  const me = await requireModule("admin");
  if (userId === me.id && !active) throw new Error("You can't deactivate your own account.");
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (error) throw new Error(`Failed to update account status: ${error.message}`);
  revalidatePath("/admin/users");
}
