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
  auto_repull_enabled: boolean;
  re_pull_after_days: number;
  gbp_to_usd_rate: number;
  eur_to_usd_rate: number;
  health_weight_qualitative: number;
  health_weight_talent: number;
  health_weight_adverse: number;
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
  auto_repull_enabled: false,
  re_pull_after_days: 90,
  gbp_to_usd_rate: 1.27,
  eur_to_usd_rate: 1.08,
  health_weight_qualitative: 50,
  health_weight_talent: 30,
  health_weight_adverse: 20,
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
