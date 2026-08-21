import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SCORE_CATEGORY_LABELS } from "@/lib/constants";
import type { Company, ScoreCategory, CandidateEntity, CompanyStatus, Tier, MatchFlag, TriageReason } from "@/lib/types";

// Mirrors the real `companies` table — see the n8n workflow's Supabase nodes
// for the source of truth on these column names.
interface CompanyRow {
  id: string;
  name: string;
  domain: string;
  status: CompanyStatus;
  triage_reason: TriageReason;
  lifecycle_status: "prospect" | "exported" | "client";
  icp: string | null;
  tier: Tier;
  match_flag: MatchFlag | null;
  score: number | null;
  sector: string | null;
  sub_sector: string | null;
  classification_confidence: number | null;
  creditsafe_company_id: string | null;
  creditsafe_match_score: number | null;
  cognism_company_id: string | null;
  cognism_match_score: number | null;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
  last_enriched_at: string | null;
  candidate_entities: CandidateEntity[] | null;
}

// Mirrors the real `scoring_breakdown` table.
interface ScoringBreakdownRow {
  id: string;
  company_id: string;
  icp_name: string;
  score_icp_fit: number | null;
  score_scale_footprint: number | null;
  score_hiring_growth: number | null;
  score_financial_viability: number | null;
  weights_used: string; // JSON string, e.g. {"icp_fit": 37.5, ...}
  excluded_categories: string[];
  total_score: number;
  tier: Tier;
  match_flag: MatchFlag;
  created_at: string;
}

const CATEGORY_KEYS = ["icp_fit", "scale_footprint", "hiring_growth", "financial_viability"] as const;

function buildScoringBreakdown(row: ScoringBreakdownRow): ScoreCategory[] {
  let weights: Record<string, number> = {};
  try {
    weights = JSON.parse(row.weights_used || "{}");
  } catch {
    weights = {};
  }
  const excluded = new Set(row.excluded_categories ?? []);
  const scoreByKey: Record<string, number | null> = {
    icp_fit: row.score_icp_fit,
    scale_footprint: row.score_scale_footprint,
    hiring_growth: row.score_hiring_growth,
    financial_viability: row.score_financial_viability,
  };

  return CATEGORY_KEYS.map((key) => {
    const isExcluded = excluded.has(key);
    const subScore = isExcluded ? null : scoreByKey[key];
    const weight = Math.round(weights[key] ?? 0);
    return {
      key,
      label: SCORE_CATEGORY_LABELS[key],
      subScore,
      weight,
      contribution: isExcluded || subScore === null ? null : Math.round((subScore * weight) / 100),
      excluded: isExcluded,
    };
  });
}

function buildOneLineReason(row: CompanyRow, breakdown: ScoreCategory[]): string {
  if (!row.icp) return "Not yet matched to an ICP.";
  const top = [...breakdown]
    .filter((c) => !c.excluded && c.contribution !== null)
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))[0];
  if (!top) return `Matched to ${row.icp}.`;
  return `Matched to ${row.icp} on ${top.label.toLowerCase()}.`;
}

function mapRowToCompany(row: CompanyRow, breakdownRow: ScoringBreakdownRow | null): Company {
  const scoringBreakdown = breakdownRow ? buildScoringBreakdown(breakdownRow) : [];
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    sector: row.sector ?? "",
    subSector: row.sub_sector ?? "",
    status: row.status,
    triageReason: row.triage_reason,
    lifecycleStatus: row.lifecycle_status,
    tier: row.tier,
    matchFlag: row.match_flag,
    icp: row.icp ?? "",
    score: row.score,
    confidence: row.classification_confidence,
    scoringBreakdown,
    // Not persisted on `companies` yet — Scoring Engine reads these off the
    // in-memory redeem response but nothing writes them back to the row.
    revenueUsd: null,
    headcount: null,
    country: "",
    importedBy: row.imported_by ?? "—",
    importedAt: row.created_at,
    lastEnrichedAt: row.last_enriched_at,
    candidateEntities: row.candidate_entities ?? [],
    // Per-field source attribution (enrichment_data.raw_response) isn't
    // parsed into individual fields yet — deferred.
    sourcedFields: [],
    // CRM export tracking doesn't exist in the schema yet ("to be defined"
    // in the build plan) — always false until that's built.
    exported: false,
    classificationConfidence: row.classification_confidence,
    proposedSector: row.sector,
    proposedSubSector: row.sub_sector,
    oneLineReason: buildOneLineReason(row, scoringBreakdown),
  };
}

async function getLatestBreakdownsByCompanyId(
  companyIds: string[],
): Promise<Map<string, ScoringBreakdownRow>> {
  if (companyIds.length === 0) return new Map();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("scoring_breakdown")
    .select("*")
    .in("company_id", companyIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load scoring_breakdown: ${error.message}`);

  const latestByCompany = new Map<string, ScoringBreakdownRow>();
  for (const row of (data ?? []) as ScoringBreakdownRow[]) {
    // Rows are ordered newest-first; scoring_breakdown keeps history, so the
    // first one seen per company_id is the latest — never overwritten.
    if (!latestByCompany.has(row.company_id)) latestByCompany.set(row.company_id, row);
  }
  return latestByCompany;
}

export async function getScoredCompanies(): Promise<Company[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("status", "scored")
    .order("score", { ascending: false });

  if (error) throw new Error(`Failed to load companies: ${error.message}`);

  const rows = (data ?? []) as CompanyRow[];
  const breakdowns = await getLatestBreakdownsByCompanyId(rows.map((r) => r.id));
  return rows.map((row) => mapRowToCompany(row, breakdowns.get(row.id) ?? null));
}

export async function getTriageCount(): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("status", "triage");

  if (error) throw new Error(`Failed to count triage companies: ${error.message}`);
  return count ?? 0;
}

export interface FlaggedCompany {
  id: string;
  name: string;
  domain: string;
  status: CompanyStatus;
}

export interface FlaggedCompaniesResult {
  items: FlaggedCompany[];
  count: number;
}

export async function getFailedCompanies(limit = 5): Promise<FlaggedCompaniesResult> {
  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("companies")
    .select("id, name, domain, status", { count: "exact" })
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load failed companies: ${error.message}`);
  return { items: (data ?? []) as FlaggedCompany[], count: count ?? 0 };
}

export async function getNoMatchCompanies(limit = 5): Promise<FlaggedCompaniesResult> {
  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("companies")
    .select("id, name, domain, status", { count: "exact" })
    .eq("match_flag", "no_match")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load no-match companies: ${error.message}`);
  return { items: (data ?? []) as FlaggedCompany[], count: count ?? 0 };
}

export interface LowConfidenceCompany extends FlaggedCompany {
  confidence: number;
}

export interface LowConfidenceCompaniesResult {
  items: LowConfidenceCompany[];
  count: number;
}

export async function getLowConfidenceCompanies(limit = 5): Promise<LowConfidenceCompaniesResult> {
  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("companies")
    .select("id, name, domain, status, classification_confidence", { count: "exact" })
    .not("classification_confidence", "is", null)
    .lt("classification_confidence", 70)
    .order("classification_confidence", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to load low-confidence companies: ${error.message}`);
  const items = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    domain: r.domain as string,
    status: r.status as CompanyStatus,
    confidence: r.classification_confidence as number,
  }));
  return { items, count: count ?? 0 };
}

export async function getEnrichmentQueue(limit = 20): Promise<FlaggedCompany[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, status")
    .in("status", ["queued", "enriching", "failed"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load enrichment queue: ${error.message}`);
  return (data ?? []) as FlaggedCompany[];
}

export async function getTriageCompanies(): Promise<Company[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("status", "triage")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load companies: ${error.message}`);

  const rows = (data ?? []) as CompanyRow[];
  const breakdowns = await getLatestBreakdownsByCompanyId(rows.map((r) => r.id));
  return rows.map((row) => mapRowToCompany(row, breakdowns.get(row.id) ?? null));
}

export interface HomeStats {
  triageCount: number;
  entityAmbiguousCount: number;
  lowConfidenceCount: number;
  scoredThisWeekCount: number;
  inProgressCount: number;
  failedCount: number;
}

export async function getHomeStats(): Promise<HomeStats> {
  const supabase = getSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: statusRows, error: statusError }, { count: scoredThisWeekCount, error: scoredError }] =
    await Promise.all([
      supabase.from("companies").select("status, triage_reason"),
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("status", "scored")
        .gte("last_enriched_at", sevenDaysAgo),
    ]);

  if (statusError) throw new Error(`Failed to load companies: ${statusError.message}`);
  if (scoredError) throw new Error(`Failed to load scored companies: ${scoredError.message}`);

  const rows = (statusRows ?? []) as { status: CompanyStatus; triage_reason: TriageReason }[];
  const triageRows = rows.filter((r) => r.status === "triage");

  return {
    triageCount: triageRows.length,
    entityAmbiguousCount: triageRows.filter((r) => r.triage_reason === "entity_ambiguous").length,
    lowConfidenceCount: triageRows.filter((r) => r.triage_reason === "low_confidence_sector").length,
    scoredThisWeekCount: scoredThisWeekCount ?? 0,
    inProgressCount: rows.filter((r) => r.status === "queued" || r.status === "enriching").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
  };
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = getSupabaseServerClient();
  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (companyError) throw new Error(`Failed to load company: ${companyError.message}`);
  if (!companyRow) return null;

  const { data: breakdownRows, error: breakdownError } = await supabase
    .from("scoring_breakdown")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (breakdownError) throw new Error(`Failed to load scoring_breakdown: ${breakdownError.message}`);

  return mapRowToCompany(companyRow as CompanyRow, (breakdownRows?.[0] as ScoringBreakdownRow) ?? null);
}
