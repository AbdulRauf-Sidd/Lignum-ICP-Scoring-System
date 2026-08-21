import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tier } from "@/lib/types";

// Mirrors the real `account_records` table — one row per client company,
// manually maintained (no automated pipeline computes these).
export interface AccountRecordRow {
  company_id: string;
  health_score: number | null;
  relationship_health: number | null;
  delivery_satisfaction: number | null;
  communication: number | null;
  value_perceived: number | null;
  renewal_likelihood: number | null;
  qualitative_reviewed_at: string | null;
  active_roles: number | null;
  placements_ytd: number | null;
  avg_time_to_fill_days: number | null;
  talent_notes: string | null;
}

// Mirrors the real `adverse_events` table.
export interface AdverseEventRow {
  id: string;
  company_id: string;
  type: string;
  description: string | null;
  event_date: string;
  severity: "low" | "medium" | "high";
}

export interface ClientCompany {
  id: string;
  name: string;
  domain: string;
  sector: string;
  subSector: string;
  score: number | null;
  tier: Tier;
}

async function getClientCompanies(): Promise<ClientCompany[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, sector, sub_sector, score, tier")
    .eq("lifecycle_status", "client");
  if (error) throw new Error(`Failed to load client companies: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    domain: r.domain as string,
    sector: (r.sector as string | null) ?? "",
    subSector: (r.sub_sector as string | null) ?? "",
    score: r.score as number | null,
    tier: r.tier as Tier,
  }));
}

export interface AccountsData {
  companies: ClientCompany[];
  records: Record<string, AccountRecordRow>;
  adverseEvents: Record<string, AdverseEventRow[]>;
}

export async function getAccountsData(): Promise<AccountsData> {
  const companies = await getClientCompanies();
  if (companies.length === 0) return { companies: [], records: {}, adverseEvents: {} };

  const supabase = getSupabaseServerClient();
  const companyIds = companies.map((c) => c.id);

  const [{ data: recordRows, error: recordsError }, { data: eventRows, error: eventsError }] = await Promise.all([
    supabase.from("account_records").select("*").in("company_id", companyIds),
    supabase.from("adverse_events").select("*").in("company_id", companyIds).order("event_date", { ascending: false }),
  ]);

  if (recordsError) throw new Error(`Failed to load account_records: ${recordsError.message}`);
  if (eventsError) throw new Error(`Failed to load adverse_events: ${eventsError.message}`);

  const records: Record<string, AccountRecordRow> = {};
  for (const row of (recordRows ?? []) as AccountRecordRow[]) records[row.company_id] = row;

  const adverseEvents: Record<string, AdverseEventRow[]> = {};
  for (const row of (eventRows ?? []) as AdverseEventRow[]) {
    const list = adverseEvents[row.company_id] ?? [];
    list.push(row);
    adverseEvents[row.company_id] = list;
  }

  return { companies, records, adverseEvents };
}
