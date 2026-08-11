"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ConfigActionState = { error?: string } | undefined;

export async function updateIcpWeights(
  _prevState: ConfigActionState,
  formData: FormData
): Promise<ConfigActionState> {
  const supabase = await createClient();

  const slug = String(formData.get("slug"));
  const weights = {
    icp_fit: Number(formData.get("icp_fit")),
    scale_footprint: Number(formData.get("scale_footprint")),
    hiring_growth: Number(formData.get("hiring_growth")),
    financial_viability: Number(formData.get("financial_viability")),
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total !== 100) {
    return { error: `Weights for ${slug} must sum to 100 (currently ${total}).` };
  }

  const { error } = await supabase
    .from("icp_profiles")
    .update({ weights })
    .eq("slug", slug);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/config");
}

export async function updateAppConfig(
  _prevState: ConfigActionState,
  formData: FormData
): Promise<ConfigActionState> {
  const supabase = await createClient();

  const key = String(formData.get("key"));
  const raw = String(formData.get("value"));

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: `"${key}" is not valid JSON.` };
  }

  const { error } = await supabase
    .from("app_config")
    .update({ value })
    .eq("key", key);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/config");
}
