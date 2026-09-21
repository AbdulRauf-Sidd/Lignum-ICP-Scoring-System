import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FieldSource, MatchedAccount } from "@/lib/types";
import { normalizeDomain } from "@/lib/domain";
import { convertToUsd, getUsdExchangeRates } from "@/lib/exchange-rates";

// Mirrors the real `active_accounts` + `active_accounts_jobs` tables and
// their currency/fee-type lookups. Separate dataset from `companies` — no
// foreign key between them, keyed by Loxo's numeric `company_id`.

// Everything job-scoped (the jobs table itself, and every metric derived
// from candidates/events/placements against a job) is restricted to these
// two categories — the other real values (Tier 3, Tier 3 Spec, Retainer,
// Tom Wood, Dropout, null) are out of scope for this page.
export const ALLOWED_JOB_CATEGORIES = ["Tier 1", "Tier 2", "T1", "T1-Exec", "T1-House", "T1-existing", "T1-new", "T2",  "T2T1"] as const;

const PLACEMENT_PAGE_SIZE = 1_000;
const FEE_TYPE_PERCENTAGE = 1;
const FEE_TYPE_FLAT = 2;

export interface AccountListItem {
  companyId: number;
  companyName: string;
  status: string;
  ownedBy: string | null;
  totalRevenue: number | null;
  revenueCurrencyCode: string | null;
  // totalRevenue / total CVs and / total first interviews, scoped to the
  // same date range as totalRevenue. Null when there are none.
  cvCost: number | null;
  interviewCost: number | null;
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

interface AccountListJobRow {
  company_id: number;
  job_id: number;
}

interface AccountListPlacementRow {
  company_id: number;
  job_id: number;
  fee: number;
  fee_type_id: number | null;
  salary: number;
  currency: { code: string } | null;
}

function calculatePlacementRevenue(row: AccountListPlacementRow): number | null {
  if (row.fee_type_id === FEE_TYPE_PERCENTAGE) return (row.salary * row.fee) / 100;
  if (row.fee_type_id === FEE_TYPE_FLAT) return row.fee;
  return null;
}

// Mirrors getAccountMetrics' CV/first-interview counting (actions.ts) —
// same activity keys, same (job, person) dedupe — just grouped by company
// across every account at once instead of scoped to one, since the list
// page shows every account in a single table.
const CV_ACTIVITY_KEY = "submitted";
const FIRST_INTERVIEW_ACTIVITY_KEYS = ["client_interview", "moved_to_1st_stage_interviews"];
const EVENT_PAGE_SIZE = 1_000;

interface AccountListEventRow {
  company_id: number;
  job_id: number;
  person_id: number;
  activity_key: string;
}

// Inclusive day bounds (YYYY-MM-DD) or null for an open end — same shape as
// datePresetRange. Scopes revenue, CVs and interviews by their created_at,
// exactly like the single-account metrics do.
export interface DateRange {
  start: string | null;
  end: string | null;
}

function rangeIso(range?: DateRange): { startIso: string | null; endIso: string | null } {
  return {
    startIso: range?.start ? new Date(`${range.start}T00:00:00.000Z`).toISOString() : null,
    endIso: range?.end ? new Date(`${range.end}T23:59:59.999Z`).toISOString() : null,
  };
}

async function fetchCvInterviewEventRows(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  range?: DateRange,
): Promise<AccountListEventRow[]> {
  const { startIso, endIso } = rangeIso(range);
  const allRows: AccountListEventRow[] = [];
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    let query = supabase
      .from("active_accounts_jobs_candidates_events")
      .select("company_id, job_id, person_id, activity_key")
      .in("activity_key", [CV_ACTIVITY_KEY, ...FIRST_INTERVIEW_ACTIVITY_KEYS]);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);
    const { data, error } = await query
      .order("event_id", { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load candidate events: ${error.message}`);

    const page = (data ?? []) as AccountListEventRow[];
    allRows.push(...page);
    if (page.length < EVENT_PAGE_SIZE) return allRows;
  }
}

// A re-sent CV or duplicate status log shouldn't inflate the count, but the
// same activity for a different job is a separate submission — dedupe key
// is (job, person), same as the single-account version.
function countEventsByCompany(rows: AccountListEventRow[], activityKeys: string[]): Map<number, number> {
  const seenByCompany = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!activityKeys.includes(r.activity_key)) continue;
    const seen = seenByCompany.get(r.company_id) ?? new Set<string>();
    seen.add(`${r.job_id}:${r.person_id}`);
    seenByCompany.set(r.company_id, seen);
  }
  const result = new Map<number, number>();
  for (const [companyId, seen] of seenByCompany) result.set(companyId, seen.size);
  return result;
}

export async function getAccountsList(search?: string, range?: DateRange): Promise<AccountListItem[]> {
  const supabase = getSupabaseServerClient();
  const { startIso, endIso } = rangeIso(range);
  const fetchTierJobRows = async (): Promise<AccountListJobRow[]> => {
    const allRows: AccountListJobRow[] = [];
    for (let offset = 0; ; offset += PLACEMENT_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("active_accounts_jobs")
        .select("company_id, job_id")
        .in("job_category", ALLOWED_JOB_CATEGORIES)
        .order("job_id", { ascending: true })
        .range(offset, offset + PLACEMENT_PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to load account jobs: ${error.message}`);

      const page = (data ?? []) as AccountListJobRow[];
      allRows.push(...page);
      if (page.length < PLACEMENT_PAGE_SIZE) return allRows;
    }
  };
  const fetchPlacementRows = async (): Promise<AccountListPlacementRow[]> => {
    const allRows: AccountListPlacementRow[] = [];
    for (let offset = 0; ; offset += PLACEMENT_PAGE_SIZE) {
      let query = supabase
        .from("active_accounts_placements")
        .select("company_id, job_id, fee, fee_type_id, salary, currency:currencies!salary_currency_id(code)");
      if (startIso) query = query.gte("created_at", startIso);
      if (endIso) query = query.lte("created_at", endIso);
      const { data, error } = await query
        .order("placement_id", { ascending: true })
        .range(offset, offset + PLACEMENT_PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to load account placements: ${error.message}`);

      const page = (data ?? []) as unknown as AccountListPlacementRow[];
      allRows.push(...page);
      if (page.length < PLACEMENT_PAGE_SIZE) return allRows;
    }
  };

  let accountsQuery = supabase
    .from("active_accounts")
    .select("company_id, company_name, status, owned_by, total_revenue, updated_at, revenue_currency:currencies!revenue_currency_id(code, symbol)")
    .order("company_name");
  if (search) {
    accountsQuery = accountsQuery.ilike("company_name", `%${search}%`);
  }

  const [{ data, error }, tierJobRows, placementRows, { rates }, eventRows] = await Promise.all([
    accountsQuery,
    fetchTierJobRows(),
    fetchPlacementRows(),
    getUsdExchangeRates(),
    fetchCvInterviewEventRows(supabase, range),
  ]);
  if (error) throw new Error(`Failed to load active_accounts: ${error.message}`);

  const tierJobKeys = new Set(tierJobRows.map((row) => `${row.company_id}:${row.job_id}`));
  const revenueByCompany = new Map<number, number>();
  for (const placement of placementRows) {
    if (!tierJobKeys.has(`${placement.company_id}:${placement.job_id}`)) continue;

    const revenue = calculatePlacementRevenue(placement);
    if (revenue === null) continue;
    const revenueUsd = convertToUsd(revenue, placement.currency?.code ?? null, rates);
    if (revenueUsd === null) continue;

    revenueByCompany.set(placement.company_id, (revenueByCompany.get(placement.company_id) ?? 0) + revenueUsd);
  }

  const cvCountByCompany = countEventsByCompany(eventRows, [CV_ACTIVITY_KEY]);
  const interviewCountByCompany = countEventsByCompany(eventRows, FIRST_INTERVIEW_ACTIVITY_KEYS);

  return ((data ?? []) as unknown as AccountListRow[]).map((r) => {
    const totalRevenue = revenueByCompany.get(r.company_id) ?? 0;
    const cvCount = cvCountByCompany.get(r.company_id) ?? 0;
    const interviewCount = interviewCountByCompany.get(r.company_id) ?? 0;
    return {
      companyId: r.company_id,
      companyName: r.company_name,
      status: r.status,
      // Revenue per CV / per first interview — null when there are none.
      cvCost: cvCount > 0 ? totalRevenue / cvCount : null,
      interviewCost: interviewCount > 0 ? totalRevenue / interviewCount : null,
      ownedBy: r.owned_by,
      totalRevenue,
      revenueCurrencyCode: "USD",
      updatedAt: r.updated_at,
    };
  });
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

// Same {min, max, score} shape as the band columns on icp_profiles.
export interface Band {
  min: number;
  max: number;
  score: number;
}

export type ScorecardWeights = Record<QualitativeMetric, number>;

export interface TalentBands {
  headcountChange: Band[];
  attrition: Band[];
  avgTenure: Band[];
}

export interface HealthWeights {
  qual: number;
  talent: number;
  adverse: number;
  // Per-dimension weights for the Client Scorecard (sum to 100) -- replaces
  // the old equal-weight average across the 5 ratings.
  scorecardWeights: ScorecardWeights;
  // Band tables converting each Talent Insights metric into a 0-100
  // sub-score -- replaces the old hardcoded formula.
  talentBands: TalentBands;
}

export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  qual: 50,
  talent: 30,
  adverse: 20,
  scorecardWeights: {
    relationship_strength: 20,
    delivery_satisfaction: 20,
    growth_potential: 20,
    payment_reliability: 20,
    strategic_fit: 20,
  },
  talentBands: { headcountChange: [], attrition: [], avgTenure: [] },
};

interface HealthWeightsRow {
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
}

// Malformed band JSON (e.g. mid-edit as raw text in Model config) falls back
// to an empty band list rather than throwing -- computeAccountHealth already
// treats "no matching band" as neutral, so this degrades gracefully.
function parseBands(json: string | null | undefined): Band[] {
  if (!json) return [];
  try {
    const val = JSON.parse(json);
    if (!Array.isArray(val)) return [];
    return val.filter(
      (b): b is Band => b && typeof b === "object" && typeof b.min === "number" && typeof b.max === "number" && typeof b.score === "number",
    );
  } catch {
    return [];
  }
}

export async function getHealthWeights(): Promise<HealthWeights> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_settings")
    .select(
      "health_weight_qualitative, health_weight_talent, health_weight_adverse, health_weight_relationship_strength, health_weight_delivery_satisfaction, health_weight_growth_potential, health_weight_payment_reliability, health_weight_strategic_fit, headcount_change_bands, attrition_bands, tenure_bands",
    )
    .eq("id", "global")
    .maybeSingle();

  if (error) throw new Error(`Failed to load model_settings: ${error.message}`);

  const r = data as HealthWeightsRow | null;
  if (!r) return DEFAULT_HEALTH_WEIGHTS;

  return {
    qual: r.health_weight_qualitative ?? DEFAULT_HEALTH_WEIGHTS.qual,
    talent: r.health_weight_talent ?? DEFAULT_HEALTH_WEIGHTS.talent,
    adverse: r.health_weight_adverse ?? DEFAULT_HEALTH_WEIGHTS.adverse,
    scorecardWeights: {
      relationship_strength: r.health_weight_relationship_strength ?? DEFAULT_HEALTH_WEIGHTS.scorecardWeights.relationship_strength,
      delivery_satisfaction: r.health_weight_delivery_satisfaction ?? DEFAULT_HEALTH_WEIGHTS.scorecardWeights.delivery_satisfaction,
      growth_potential: r.health_weight_growth_potential ?? DEFAULT_HEALTH_WEIGHTS.scorecardWeights.growth_potential,
      payment_reliability: r.health_weight_payment_reliability ?? DEFAULT_HEALTH_WEIGHTS.scorecardWeights.payment_reliability,
      strategic_fit: r.health_weight_strategic_fit ?? DEFAULT_HEALTH_WEIGHTS.scorecardWeights.strategic_fit,
    },
    talentBands: {
      headcountChange: parseBands(r.headcount_change_bands),
      attrition: parseBands(r.attrition_bands),
      avgTenure: parseBands(r.tenure_bands),
    },
  };
}

// Firmographics come from the separate prospecting `companies` table (no
// foreign key to active_accounts — matched at read time by domain, since
// that's the only thing the two datasets share). `companies.domain` is
// stored inconsistently (some rows keep a "www." prefix, some don't), so
// both tables are normalized to a bare hostname before comparing.
export interface AccountFirmographics {
  revenueUsd: number | null;
  revenueSource: FieldSource | null;
  headcount: number | null;
  headcountSource: FieldSource | null;
  creditRating: number | null;
  hasBankruptcy: boolean | null;
  hasActiveLawsuit: boolean | null;
  foundedYear: number | null;
  hq: string | null;
  numberOfSites: number | null;
  // Creditsafe's "Company Recommendation" credit limit — reference only for
  // BD, never used in scoring (that's creditsafeRiskScore, driving the
  // credit_risk ICP category instead).
  creditLimit: number | null;
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
  revenue_usd: number | null;
  revenue_source: FieldSource | null;
  headcount: number | null;
  headcount_source: FieldSource | null;
  credit_rating: number | null;
  has_bankruptcy: boolean | null;
  has_active_lawsuit: boolean | null;
  founded_year: number | null;
  headquarters: string | null;
  number_of_sites: number | null;
  ownership: string | null;
  creditsafe_credit_limit: number | null;
}

// Null return means "not yet enriched" — no usable domain on the account,
// or no matching row in `companies` yet. Founded year, HQ, sites count, and
// legal entity type ("ownership" — see the AccountFirmographics.ownership
// comment) are all columns n8n writes onto `companies` directly during
// enrichment now, so this is a single-table read — no more re-parsing the
// raw Creditsafe JSON from enrichment_data at request time.
export async function getAccountFirmographics(companyUrl: string | null): Promise<AccountFirmographics | null> {
  const domain = extractDomain(companyUrl);
  if (!domain) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "revenue_usd, revenue_source, headcount, headcount_source, credit_rating, has_bankruptcy, has_active_lawsuit, founded_year, headquarters, number_of_sites, ownership, creditsafe_credit_limit",
    )
    .in("domain", [domain, `www.${domain}`])
    .order("last_enriched_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load companies: ${error.message}`);
  if (!data) return null;

  const r = data as FirmographicsRow;

  return {
    revenueUsd: r.revenue_usd,
    revenueSource: r.revenue_source,
    headcount: r.headcount,
    headcountSource: r.headcount_source,
    creditRating: r.credit_rating,
    hasBankruptcy: r.has_bankruptcy,
    hasActiveLawsuit: r.has_active_lawsuit,
    ownership: r.ownership,
    foundedYear: r.founded_year,
    hq: r.headquarters,
    numberOfSites: r.number_of_sites,
    creditLimit: r.creditsafe_credit_limit,
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

// Accounts whose company_url matches any of the given domains, keyed by the
// normalized domain. n8n decides which companies are matches; this only
// fetches the account side so triage can show both records.
export async function getAccountsMatchingDomains(domains: string[]): Promise<Map<string, MatchedAccount[]>> {
  const wanted = new Set(domains.map(normalizeDomain).filter((d) => /^[a-z0-9.-]+$/.test(d)));
  const result = new Map<string, MatchedAccount[]>();
  if (wanted.size === 0) return result;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("company_id, company_name, company_url, status, owned_by")
    .or([...wanted].map((d) => `company_url.ilike.%${d}%`).join(","));
  if (error) throw new Error(`Failed to load matching accounts: ${error.message}`);

  for (const row of (data ?? []) as {
    company_id: number;
    company_name: string;
    company_url: string | null;
    status: string;
    owned_by: string | null;
  }[]) {
    if (!row.company_url) continue;
    const key = normalizeDomain(row.company_url);
    if (!wanted.has(key)) continue;
    const list = result.get(key) ?? [];
    list.push({
      companyId: row.company_id,
      companyName: row.company_name,
      companyUrl: row.company_url,
      domain: key,
      status: row.status,
      ownedBy: row.owned_by,
    });
    result.set(key, list);
  }
  return result;
}
