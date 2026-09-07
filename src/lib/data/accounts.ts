import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mirrors the real `active_accounts` + `active_accounts_jobs` tables and
// their currency/fee-type lookups. Separate dataset from `companies` — no
// foreign key between them, keyed by Loxo's numeric `company_id`.

// Everything job-scoped (the jobs table itself, and every metric derived
// from candidates/events/placements against a job) is restricted to these
// two categories — the other real values (Tier 3, Tier 3 Spec, Retainer,
// Tom Wood, Dropout, null) are out of scope for this page.
export const ALLOWED_JOB_CATEGORIES = ["Tier 1", "Tier 2", "T1", "T1-Exec", "T1-House", "T1-existing", "T1-new", "T2",  "T2T1"] as const;

export interface AccountListItem {
  companyId: number;
  companyName: string;
  status: string;
  ownedBy: string | null;
  totalRevenue: number | null;
  revenueCurrencyCode: string | null;
  updatedAt: string;
}

export interface AccountHeader {
  companyId: number;
  companyName: string;
  companyUrl: string | null;
  status: string;
  ownedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountJob {
  jobId: number;
  jobTitle: string;
  createdAt: string;
  publishedAt: string | null;
  salary: string | null;
  salaryCurrencyCode: string | null;
  jobType: string | null;
  jobCategory: string | null;
  fee: number | null;
  feeTypeKey: string | null;
  feeCurrencyCode: string | null;
}

interface AccountListRow {
  company_id: number;
  company_name: string;
  status: string;
  owned_by: string | null;
  total_revenue: number | null;
  updated_at: string;
  revenue_currency: { code: string; symbol: string } | null;
}

export async function getAccountsList(): Promise<AccountListItem[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("company_id, company_name, status, owned_by, total_revenue, updated_at, revenue_currency:currencies!revenue_currency_id(code, symbol)")
    .order("company_name");

  if (error) throw new Error(`Failed to load active_accounts: ${error.message}`);

  return ((data ?? []) as unknown as AccountListRow[]).map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    status: r.status,
    ownedBy: r.owned_by,
    totalRevenue: r.total_revenue,
    revenueCurrencyCode: r.revenue_currency?.code ?? null,
    updatedAt: r.updated_at,
  }));
}

interface AccountHeaderRow {
  company_id: number;
  company_name: string;
  company_url: string | null;
  status: string;
  owned_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAccountHeader(companyId: number): Promise<AccountHeader | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("company_id, company_name, company_url, status, owned_by, created_at, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load account header: ${error.message}`);
  if (!data) return null;

  const r = data as AccountHeaderRow;
  return {
    companyId: r.company_id,
    companyName: r.company_name,
    companyUrl: r.company_url,
    status: r.status,
    ownedBy: r.owned_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface AccountJobRow {
  job_id: number;
  job_title: string;
  created_at: string;
  published_at: string | null;
  salary: string | null;
  salary_currency_id: number | null;
  job_type: string | null;
  job_category: string | null;
  fee: number | null;
  fee_type_id: number | null;
  fee_currency_id: number | null;
  salary_currency: { code: string; symbol: string } | null;
  fee_currency: { code: string; symbol: string } | null;
  fee_type: { fee_type_key: string } | null;
}

// The five dimensions of the manual client scorecard — matches the
// `account_qualitative.metric` check constraint in
// docs/migrations/002_account_scorecard.sql.
export const QUALITATIVE_METRICS = [
  "relationship_strength",
  "delivery_satisfaction",
  "growth_potential",
  "payment_reliability",
  "strategic_fit",
] as const;

export type QualitativeMetric = (typeof QUALITATIVE_METRICS)[number];

export interface QualitativeRating {
  metric: QualitativeMetric;
  rating: number;
  ratedBy: string | null;
  ratedAt: string;
  refreshDue: string | null;
}

interface QualitativeRow {
  metric: string;
  rating: number;
  rated_by: string | null;
  rated_at: string;
  refresh_due: string | null;
}

export async function getAccountQualitative(companyId: number): Promise<QualitativeRating[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("account_qualitative")
    .select("metric, rating, rated_by, rated_at, refresh_due")
    .eq("company_id", companyId);

  if (error) throw new Error(`Failed to load account_qualitative: ${error.message}`);

  return ((data ?? []) as QualitativeRow[]).map((r) => ({
    metric: r.metric as QualitativeMetric,
    rating: r.rating,
    ratedBy: r.rated_by,
    ratedAt: r.rated_at,
    refreshDue: r.refresh_due,
  }));
}

export interface TalentInsights {
  headcountChange: number | null;
  attrition: number | null;
  avgTenure: number | null;
  enteredBy: string | null;
  enteredAt: string;
}

interface TalentInsightsRow {
  headcount_change: number | null;
  attrition: number | null;
  avg_tenure: number | null;
  entered_by: string | null;
  entered_at: string;
}

export async function getTalentInsights(companyId: number): Promise<TalentInsights | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("talent_insights")
    .select("headcount_change, attrition, avg_tenure, entered_by, entered_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load talent_insights: ${error.message}`);
  if (!data) return null;

  const r = data as TalentInsightsRow;
  return {
    headcountChange: r.headcount_change,
    attrition: r.attrition,
    avgTenure: r.avg_tenure,
    enteredBy: r.entered_by,
    enteredAt: r.entered_at,
  };
}

export interface HealthWeights {
  qual: number;
  talent: number;
  adverse: number;
}

interface HealthWeightsRow {
  health_weight_qualitative: number;
  health_weight_talent: number;
  health_weight_adverse: number;
}

export async function getHealthWeights(): Promise<HealthWeights> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_settings")
    .select("health_weight_qualitative, health_weight_talent, health_weight_adverse")
    .eq("id", "global")
    .maybeSingle();

  if (error) throw new Error(`Failed to load model_settings: ${error.message}`);

  const r = data as HealthWeightsRow | null;
  return {
    qual: r?.health_weight_qualitative ?? 50,
    talent: r?.health_weight_talent ?? 30,
    adverse: r?.health_weight_adverse ?? 20,
  };
}

export async function getAccountJobs(companyId: number): Promise<AccountJob[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts_jobs")
    .select(
      "job_id, job_title, created_at, published_at, salary, salary_currency_id, job_type, job_category, fee, fee_type_id, fee_currency_id, salary_currency:currencies!salary_currency_id(code, symbol), fee_currency:currencies!fee_currency_id(code, symbol), fee_type:fee_type(fee_type_key)",
    )
    .eq("company_id", companyId)
    .in("job_category", ALLOWED_JOB_CATEGORIES)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Failed to load active_accounts_jobs: ${error.message}`);

  return ((data ?? []) as unknown as AccountJobRow[]).map((r) => ({
    jobId: r.job_id,
    jobTitle: r.job_title,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    salary: r.salary,
    salaryCurrencyCode: r.salary_currency?.code ?? null,
    jobType: r.job_type,
    jobCategory: r.job_category,
    fee: r.fee,
    feeTypeKey: r.fee_type?.fee_type_key ?? null,
    feeCurrencyCode: r.fee_currency?.code ?? null,
  }));
}
