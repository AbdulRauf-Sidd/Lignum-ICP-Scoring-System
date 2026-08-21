"use server";

import { redirect } from "next/navigation";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export async function signOut() {
  const supabase = await getSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
