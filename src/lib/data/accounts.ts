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

// The five dimensions of the manual client scorecard — each is its own
// column on active_accounts (see docs/migrations/003_consolidate_scorecard_into_active_accounts.sql),
// current value only, no update history.
export const QUALITATIVE_METRICS = [
  "relationship_strength",
  "delivery_satisfaction",
  "growth_potential",
  "payment_reliability",
  "strategic_fit",
] as const;

export type QualitativeMetric = (typeof QUALITATIVE_METRICS)[number];

export type QualitativeRatings = Record<QualitativeMetric, number | null>;

interface QualitativeRow {
  relationship_strength: number | null;
  delivery_satisfaction: number | null;
  growth_potential: number | null;
  payment_reliability: number | null;
  strategic_fit: number | null;
}

export async function getAccountQualitative(companyId: number): Promise<QualitativeRatings> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("relationship_strength, delivery_satisfaction, growth_potential, payment_reliability, strategic_fit")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load qualitative ratings: ${error.message}`);

  const r = (data ?? {}) as Partial<QualitativeRow>;
  return {
    relationship_strength: r.relationship_strength ?? null,
    delivery_satisfaction: r.delivery_satisfaction ?? null,
    growth_potential: r.growth_potential ?? null,
    payment_reliability: r.payment_reliability ?? null,
    strategic_fit: r.strategic_fit ?? null,
  };
}

export interface TalentInsights {
  headcountChange: number | null;
  attrition: number | null;
  avgTenure: number | null;
}

interface TalentInsightsRow {
  headcount_change: number | null;
  attrition: number | null;
  avg_tenure: number | null;
}

export async function getTalentInsights(companyId: number): Promise<TalentInsights> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("headcount_change, attrition, avg_tenure")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load talent insights: ${error.message}`);

  const r = (data ?? {}) as Partial<TalentInsightsRow>;
  return {
    headcountChange: r.headcount_change ?? null,
    attrition: r.attrition ?? null,
    avgTenure: r.avg_tenure ?? null,
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

// Firmographics come from the separate prospecting `companies` table (no
// foreign key to active_accounts — matched at read time by domain, since
// that's the only thing the two datasets share). `companies.domain` is
// stored inconsistently (some rows keep a "www." prefix, some don't), so
// both tables are normalized to a bare hostname before comparing.
export interface AccountFirmographics {
  revenueUsd: number | null;
  headcount: number | null;
  creditRating: number | null;
  hasBankruptcy: boolean | null;
  hasActiveLawsuit: boolean | null;
  foundedYear: number | null;
  hq: string | null;
  // Legal entity type (e.g. "Corporation", "Limited Liability"), not true
  // ownership structure — this dataset has no parent/subsidiary/shareholder
  // data anywhere, so this is the closest honest stand-in.
  ownership: string | null;
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface FirmographicsRow {
  id: string;
  revenue_usd: number | null;
  headcount: number | null;
  credit_rating: number | null;
  has_bankruptcy: boolean | null;
  has_active_lawsuit: boolean | null;
}

// Only the parts of Creditsafe's full_report shape this reads — the real
// payload has many more fields.
interface CreditsafeReport {
  report?: {
    companyIdentification?: {
      basicInformation?: {
        companyRegistrationDate?: string;
        contactAddress?: { city?: string; province?: string; country?: string };
        legalForm?: { description?: string };
      };
    };
  };
}

interface CreditsafeExtract {
  foundedYear: number | null;
  hq: string | null;
  ownership: string | null;
}

// Founded year, HQ, and legal entity type all come from the matched
// company's own Creditsafe report (enrichment_data.raw_response, source
// "creditsafe" / call_type "full_report") — companyRegistrationDate for the
// year, contactAddress for the city/state, legalForm.description for entity
// type (the closest thing to "ownership" this data has — see the
// AccountFirmographics.ownership comment). Malformed or missing JSON is
// treated as "not available" rather than thrown, since this is best-effort
// on top of an already-found match.
function parseCreditsafeExtract(raw: string | null): CreditsafeExtract {
  if (!raw) return { foundedYear: null, hq: null, ownership: null };
  try {
    const parsed = JSON.parse(raw) as CreditsafeReport;
    const info = parsed.report?.companyIdentification?.basicInformation;
    const regDate = info?.companyRegistrationDate;
    const foundedYear = regDate ? new Date(regDate).getFullYear() : null;
    const address = info?.contactAddress;
    const hq = address?.city && address?.province ? `${titleCase(address.city)}, ${address.province}` : null;
    const ownership = info?.legalForm?.description ?? null;
    return { foundedYear: Number.isNaN(foundedYear) ? null : foundedYear, hq, ownership };
  } catch {
    return { foundedYear: null, hq: null, ownership: null };
  }
}

// Creditsafe's address fields come back in ALL CAPS.
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Null return means "not yet enriched" — no usable domain on the account,
// or no matching row in `companies` yet. A `companies` match with no
// Creditsafe report on file still returns a result, just with
// foundedYear/hq null.
export async function getAccountFirmographics(companyUrl: string | null): Promise<AccountFirmographics | null> {
  const domain = extractDomain(companyUrl);
  if (!domain) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, revenue_usd, headcount, credit_rating, has_bankruptcy, has_active_lawsuit")
    .in("domain", [domain, `www.${domain}`])
    .order("last_enriched_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load companies: ${error.message}`);
  if (!data) return null;

  const r = data as FirmographicsRow;

  const { data: reportRow, error: reportError } = await supabase
    .from("enrichment_data")
    .select("raw_response")
    .eq("company_id", r.id)
    .eq("source", "creditsafe")
    .eq("call_type", "full_report")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError) throw new Error(`Failed to load enrichment_data: ${reportError.message}`);

  const { foundedYear, hq, ownership } = parseCreditsafeExtract(reportRow?.raw_response ?? null);

  return {
    revenueUsd: r.revenue_usd,
    headcount: r.headcount,
    creditRating: r.credit_rating,
    hasBankruptcy: r.has_bankruptcy,
    hasActiveLawsuit: r.has_active_lawsuit,
    ownership,
    foundedYear,
    hq,
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
