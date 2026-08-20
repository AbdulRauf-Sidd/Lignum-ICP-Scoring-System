"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface QualitativeInput {
  relationshipHealth: number;
  deliverySatisfaction: number;
  communication: number;
  valuePerceived: number;
  renewalLikelihood: number;
}

export async function saveQualitativeRatings(companyId: string, ratings: QualitativeInput) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("account_records").upsert(
    {
      company_id: companyId,
      relationship_health: ratings.relationshipHealth,
      delivery_satisfaction: ratings.deliverySatisfaction,
      communication: ratings.communication,
      value_perceived: ratings.valuePerceived,
      renewal_likelihood: ratings.renewalLikelihood,
      qualitative_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(`Failed to save qualitative ratings: ${error.message}`);
  revalidatePath("/accounts");
}

export interface TalentInsightsInput {
  activeRoles: number;
  placementsYtd: number;
  avgTimeToFillDays: number;
  notes: string;
}

export async function saveTalentInsights(companyId: string, talent: TalentInsightsInput) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("account_records").upsert(
    {
      company_id: companyId,
      active_roles: talent.activeRoles,
      placements_ytd: talent.placementsYtd,
      avg_time_to_fill_days: talent.avgTimeToFillDays,
      talent_notes: talent.notes,
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(`Failed to save talent insights: ${error.message}`);
  revalidatePath("/accounts");
}

export async function saveHealthScore(companyId: string, healthScore: number | null) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("account_records")
    .upsert({ company_id: companyId, health_score: healthScore }, { onConflict: "company_id" });
  if (error) throw new Error(`Failed to save health score: ${error.message}`);
  revalidatePath("/accounts");
}
