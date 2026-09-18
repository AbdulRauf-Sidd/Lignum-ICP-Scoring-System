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
  weight_credit_risk: number;
  target_sectors: string[];
  revenue_bands_usd: string;
  headcount_bands: string;
  hiring_growth_bands: string;
  credit_risk_bands: string;
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
    input.weight_icp_fit +
    input.weight_scale_footprint +
    input.weight_hiring_growth +
    input.weight_financial_viability +
    input.weight_credit_risk;
  if (weightSum !== 100) {
    throw new Error(`Weights must sum to 100 (currently ${weightSum}).`);
  }
  if (!input.icp_name.trim()) {
    throw new Error("ICP name is required.");
  }
  assertValidJson("Revenue bands", input.revenue_bands_usd);
  assertValidJson("Headcount bands", input.headcount_bands);
  assertValidJson("Hiring & growth bands", input.hiring_growth_bands);
  assertValidJson("Credit risk bands", input.credit_risk_bands);
  assertValidJson("Fit rules", input.fit_rules);

  const supabase = getSupabaseServerClient();
  const record = {
    icp_name: input.icp_name.trim(),
    weight_icp_fit: input.weight_icp_fit,
    weight_scale_footprint: input.weight_scale_footprint,
    weight_hiring_growth: input.weight_hiring_growth,
    weight_financial_viability: input.weight_financial_viability,
    weight_credit_risk: input.weight_credit_risk,
    target_sectors: input.target_sectors,
    revenue_bands_usd: input.revenue_bands_usd,
    headcount_bands: input.headcount_bands,
    hiring_growth_bands: input.hiring_growth_bands,
    credit_risk_bands: input.credit_risk_bands,
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

export interface ModelSettingsInput {
  tier_a_min: number;
  tier_b_min: number;
  soft_rule_penalty: number;
  hard_rule_penalty: number;
  contact_pull_on_demand: boolean;
  indicative_price_per_credit: number | null;
  cv_cost: number | null;
  interview_cost: number | null;
  auto_repull_enabled: boolean;
  re_pull_after_days: number;
  gbp_to_usd_rate: number;
  eur_to_usd_rate: number;
  health_weight_qualitative: number;
  health_weight_talent: number;
  health_weight_adverse: number;
  health_weight_relationship_strength: number;
  health_weight_delivery_satisfaction: number;
  health_weight_growth_potential: number;
  health_weight_payment_reliability: number;
  health_weight_strategic_fit: number;
  headcount_change_bands: string;
  attrition_bands: string;
  tenure_bands: string;
  review_reminder_days: number;
}

export async function saveModelSettings(input: ModelSettingsInput) {
  if (input.tier_a_min <= input.tier_b_min) {
    throw new Error("Tier A threshold must be higher than Tier B.");
  }
  if (input.hard_rule_penalty < input.soft_rule_penalty) {
    throw new Error("Hard requirement penalty must be at least as large as the soft signal penalty.");
  }
  const healthSum = input.health_weight_qualitative + input.health_weight_talent + input.health_weight_adverse;
  if (healthSum !== 100) {
    throw new Error(`Account health weights must sum to 100 (currently ${healthSum}).`);
  }
  const scorecardSum =
    input.health_weight_relationship_strength +
    input.health_weight_delivery_satisfaction +
    input.health_weight_growth_potential +
    input.health_weight_payment_reliability +
    input.health_weight_strategic_fit;
  if (scorecardSum !== 100) {
    throw new Error(`Client scorecard weights must sum to 100 (currently ${scorecardSum}).`);
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("model_settings")
    .upsert({ id: "global", ...input, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
  revalidatePath("/admin/config");
}
