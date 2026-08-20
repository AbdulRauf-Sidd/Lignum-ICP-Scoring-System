"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface IcpProfileInput {
  id: string | null;
  icp_name: string;
  weight_icp_fit: number;
  weight_scale_footprint: number;
  weight_hiring_growth: number;
  weight_financial_viability: number;
  target_sectors: string[];
  revenue_bands_usd: string;
  headcount_bands: string;
  fit_rules: string;
}

function assertValidJson(label: string, value: string) {
  try {
    JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export async function saveIcpProfile(input: IcpProfileInput): Promise<{ id: string }> {
  const weightSum =
    input.weight_icp_fit + input.weight_scale_footprint + input.weight_hiring_growth + input.weight_financial_viability;
  if (weightSum !== 100) {
    throw new Error(`Weights must sum to 100 (currently ${weightSum}).`);
  }
  if (!input.icp_name.trim()) {
    throw new Error("ICP name is required.");
  }
  assertValidJson("Revenue bands", input.revenue_bands_usd);
  assertValidJson("Headcount bands", input.headcount_bands);
  assertValidJson("Fit rules", input.fit_rules);

  const supabase = getSupabaseServerClient();
  const record = {
    icp_name: input.icp_name.trim(),
    weight_icp_fit: input.weight_icp_fit,
    weight_scale_footprint: input.weight_scale_footprint,
    weight_hiring_growth: input.weight_hiring_growth,
    weight_financial_viability: input.weight_financial_viability,
    target_sectors: input.target_sectors,
    revenue_bands_usd: input.revenue_bands_usd,
    headcount_bands: input.headcount_bands,
    fit_rules: input.fit_rules,
  };

  if (input.id) {
    const { error } = await supabase.from("icp_profiles").update(record).eq("id", input.id);
    if (error) throw new Error(`Failed to save ICP profile: ${error.message}`);
    revalidatePath("/admin/config");
    return { id: input.id };
  }

  const { data, error } = await supabase.from("icp_profiles").insert(record).select("id").single();
  if (error) throw new Error(`Failed to create ICP profile: ${error.message}`);
  revalidatePath("/admin/config");
  return { id: data.id as string };
}

export async function deleteIcpProfile(id: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("icp_profiles").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete ICP profile: ${error.message}`);
  revalidatePath("/admin/config");
}

export async function setSectorTaxonomyActive(id: string, active: boolean) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("sector_taxonomy").update({ active }).eq("id", id);
  if (error) throw new Error(`Failed to update sector taxonomy: ${error.message}`);
  revalidatePath("/admin/config");
}
