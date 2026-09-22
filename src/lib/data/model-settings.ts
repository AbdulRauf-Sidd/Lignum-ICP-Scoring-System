import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mirrors the real `model_settings` table — a single global row (id='global').
export interface ModelSettingsRow {
  id: string;
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
  // Per-dimension weights for the Client Scorecard (must sum to 100) --
  // replaces the old equal-weight average across the 5 ratings.
  health_weight_relationship_strength: number;
  health_weight_delivery_satisfaction: number;
  health_weight_growth_potential: number;
  health_weight_payment_reliability: number;
  health_weight_strategic_fit: number;
  // Band tables (JSON text, same {min,max,score} shape as icp_profiles'
  // band columns) converting each Talent Insights metric into a 0-100
  // sub-score -- replaces the old hardcoded formula.
  headcount_change_bands: string;
  attrition_bands: string;
  tenure_bands: string;
  review_reminder_days: number;
  updated_at: string;
}

const DEFAULTS: Omit<ModelSettingsRow, "id" | "updated_at"> = {
  tier_a_min: 82,
  tier_b_min: 68,
  soft_rule_penalty: 20,
  hard_rule_penalty: 60,
  contact_pull_on_demand: true,
  indicative_price_per_credit: null,
  cv_cost: null,
  interview_cost: null,
  auto_repull_enabled: false,
  re_pull_after_days: 90,
  gbp_to_usd_rate: 1.27,
  eur_to_usd_rate: 1.08,
  health_weight_qualitative: 50,
  health_weight_talent: 30,
  health_weight_adverse: 20,
  health_weight_relationship_strength: 20,
  health_weight_delivery_satisfaction: 20,
  health_weight_growth_potential: 20,
  health_weight_payment_reliability: 20,
  health_weight_strategic_fit: 20,
  headcount_change_bands:
    '[{"min":-100,"max":-10,"score":20},{"min":-10,"max":0,"score":50},{"min":0,"max":10,"score":70},{"min":10,"max":30,"score":90},{"min":30,"max":1000,"score":100}]',
  attrition_bands:
    '[{"min":0,"max":8,"score":100},{"min":8,"max":15,"score":80},{"min":15,"max":25,"score":55},{"min":25,"max":40,"score":30},{"min":40,"max":1000,"score":10}]',
  tenure_bands:
    '[{"min":0,"max":1,"score":20},{"min":1,"max":3,"score":50},{"min":3,"max":5,"score":75},{"min":5,"max":10,"score":90},{"min":10,"max":100,"score":100}]',
  review_reminder_days: 90,
};

// Returns defaults (not an error) if the migration hasn't been run yet, so
// the config page still renders — saving will surface the real error.
export async function getModelSettings(): Promise<ModelSettingsRow> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("model_settings").select("*").eq("id", "global").maybeSingle();

  if (error || !data) {
    return { id: "global", updated_at: new Date(0).toISOString(), ...DEFAULTS };
  }
  return data as ModelSettingsRow;
}
