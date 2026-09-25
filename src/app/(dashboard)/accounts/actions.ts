"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { getGbpExchangeRates, convertToGbp } from "@/lib/exchange-rates";
import { getModelSettings } from "@/lib/data/model-settings";
import {
  ALLOWED_JOB_CATEGORIES,
  EXCLUDED_JOB_TYPES,
  QUALITATIVE_METRICS,
  type QualitativeMetric,
} from "@/lib/data/accounts";
import type { CurrencyAmount } from "@/lib/format";

const CV_ACTIVITY_KEY = "submitted";
const EVENT_PAGE_SIZE = 1_000;
// Each candidate/job pair counts once across the first-interview event keys.
const FIRST_INTERVIEW_ACTIVITY_KEYS = ["client_interview", "moved_to_1st_stage_interviews"];

// fee_type_id on active_accounts_placements: 1 = percentage of salary, 2 =
// flat amount. (3 = hourly exists on fee_type but never appears on a real
// placement row — those rows are counted toward totalPlacements same as any
// other, just skipped when summing revenue since there's no honest formula
// for them here.)
const FEE_TYPE_PERCENTAGE = 1;
const FEE_TYPE_FLAT = 2;

export interface AccountMetrics {
  totalCvs: number;
  firstInterviews: number;
  totalPlacements: number;
  revenue: CurrencyAmount[];
  // Sum of `revenue` converted to GBP — null if one of the currencies isn't
  // in the rates we have, so the caller can fall back to showing the
  // per-currency breakdown instead of a wrong number.
  revenueGbp: number | null;
  // false when revenueGbp was computed from the static fallback snapshot
  // rather than a live/cached fetch — lets the caller avoid claiming "today's
  // rates" when they aren't. Meaningless when revenueGbp is null.
  revenueRatesLive: boolean;
  // Revenue per CV / per first interview — divides by revenue from Tier 1 /
  // Tier 2 jobs only (not revenueGbp above, which is wider) since these two
  // ratios are meant to reflect standard per-hire recruiting work. Null when
  // there's no GBP figure for that subset or the count is 0.
  cvCost: number | null;
  interviewCost: number | null;
  // Jobs added in the date range, any job category.
  totalJobs: number;
  // recruiterCost = totalCvs * model_settings.cv_cost, accountManagementCost =
  // totalJobs * model_settings.interview_cost, businessCost = their sum. Null
  // when the model setting isn't configured on the Model config page, so the
  // caller shows a placeholder instead of a wrong £0 figure.
  recruiterCost: number | null;
  accountManagementCost: number | null;
  businessCost: number | null;
}

interface EventRow {
  job_id: number;
  person_id: number;
  activity_key: string;
}

function countCvs(rows: EventRow[]): number {
  const matching = rows.filter((r) => r.activity_key === CV_ACTIVITY_KEY);
  // A re-sent CV or duplicate status log should not inflate the total, but a
  // CV sent for a different job is a separate submission.
  return new Set(matching.map((r) => `${r.job_id}:${r.person_id}`)).size;
}

// Deduped by (job_id, person_id) rather than person_id alone — the two
// qualifying activity keys aren't just duplicate-event noise, they can be a
// real pair of separate events for the same super key, and only one should count.
function countFirstInterviews(rows: EventRow[]): number {
  const matching = rows.filter((r) => FIRST_INTERVIEW_ACTIVITY_KEYS.includes(r.activity_key));
  const superKeys = new Set(matching.map((r) => `${r.job_id}:${r.person_id}`));
  return superKeys.size;
}

interface PlacementRow {
  job_id: number;
  fee: number;
  fee_type_id: number | null;
  salary: number;
  salary_currency_id: number | null;
  currency: { code: string } | null;
}

// Percentage fees are a cut of the candidate's salary; flat fees are already
// a dollar amount. Anything else (fee_type_id unset, or a type this app
// doesn't have a formula for) is excluded from the sum rather than guessed —
// the row still counts toward totalPlacements below, just not revenue.
function placementRevenue(row: PlacementRow): number | null {
  if (row.fee_type_id === FEE_TYPE_PERCENTAGE) return (row.salary * row.fee) / 100;
  if (row.fee_type_id === FEE_TYPE_FLAT) return row.fee;
  return null;
}

// startDate/endDate are inclusive ISO bounds, or null for an open end (e.g.
// "All time") — matches getAccountsList's DateRange so the two pages can't
// silently disagree about what "no upper bound" means. Previously the caller
// substituted a concrete "today" for an open end, which clipped out any row
// whose created_at is after today (e.g. a placement logged with a
// forward-dated created_at) even under "All time".
export async function getAccountMetrics(companyId: number, startDate: string | null, endDate: string | null): Promise<AccountMetrics> {
  const supabase = getSupabaseServerClient();

  const { data: jobRows, error: jobsError } = await supabase
    .from("active_accounts_jobs")
    .select("job_id, created_at, job_type, job_category")
    .eq("company_id", companyId);
  if (jobsError) throw new Error(`Failed to load account jobs: ${jobsError.message}`);

  // MSP, Retainer and Dropout jobs are excluded from totalJobs. Total
  // Revenue itself is never job-filtered (any category, any job type) —
  // only revenue-per-CV and revenue-per-interview divide by the Tier 1/2,
  // non-MSP/Retainer/Dropout subset below.
  const includedJobRows = (jobRows ?? []).filter(
    (r) => !EXCLUDED_JOB_TYPES.includes(r.job_type as (typeof EXCLUDED_JOB_TYPES)[number]),
  );
  const tierJobIds = new Set(
    includedJobRows
      .filter((r) => ALLOWED_JOB_CATEGORIES.includes(r.job_category as (typeof ALLOWED_JOB_CATEGORIES)[number]))
      .map((r) => r.job_id as number),
  );

  const startMs = startDate ? new Date(startDate).getTime() : -Infinity;
  const endMs = endDate ? new Date(endDate).getTime() : Infinity;
  const totalJobs = includedJobRows.filter((r) => {
    const t = new Date(r.created_at as string).getTime();
    return t >= startMs && t <= endMs;
  }).length;
  const fetchEventPages = async (activityKeys: string[], metricName: string): Promise<EventRow[]> => {
    const allRows: EventRow[] = [];

    for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
      let query = supabase
        .from("active_accounts_jobs_candidates_events")
        .select("job_id, person_id, activity_key")
        .eq("company_id", companyId)
        .in("activity_key", activityKeys);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", endDate);
      const { data, error } = await query
        .order("event_id", { ascending: true })
        .range(offset, offset + EVENT_PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to load ${metricName} metrics: ${error.message}`);

      const page = (data ?? []) as EventRow[];
      allRows.push(...page);
      if (page.length < EVENT_PAGE_SIZE) return allRows;
    }
  };

  const cvEventsPromise = fetchEventPages([CV_ACTIVITY_KEY], "CV");
  const interviewEventsPromise = fetchEventPages(FIRST_INTERVIEW_ACTIVITY_KEYS, "first interview");

  const fetchPlacements = () => {
    let query = supabase
      .from("active_accounts_placements")
      .select("job_id, fee, fee_type_id, salary, salary_currency_id, currency:currencies!salary_currency_id(code)")
      .eq("company_id", companyId);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);
    return query;
  };

  const [
    cvRows,
    interviewRows,
    { data: placementRows, error: placementsError },
    modelSettings,
  ] = await Promise.all([cvEventsPromise, interviewEventsPromise, fetchPlacements(), getModelSettings()]);

  if (placementsError) throw new Error(`Failed to load placements: ${placementsError.message}`);

  const placements = (placementRows ?? []) as unknown as PlacementRow[];

  // Roughly a fifth of companies have placements in more than one currency —
  // summing those together would misrepresent the total, so revenue is kept
  // as separate per-currency totals as well as a converted-to-GBP figure.
  // A second, Tier 1/2-only total (tierRevenueByCurrency) feeds cvCost /
  // interviewCost below rather than the wider `revenue` figure.
  const revenueByCurrency = new Map<string | null, number>();
  const tierRevenueByCurrency = new Map<string | null, number>();
  for (const p of placements) {
    const amount = placementRevenue(p);
    if (amount === null) continue;
    const code = p.currency?.code ?? null;
    revenueByCurrency.set(code, (revenueByCurrency.get(code) ?? 0) + amount);
    if (tierJobIds.has(p.job_id)) {
      tierRevenueByCurrency.set(code, (tierRevenueByCurrency.get(code) ?? 0) + amount);
    }
  }
  const revenue = Array.from(revenueByCurrency.entries())
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => b.amount - a.amount);

  const { rates, live } = await getGbpExchangeRates();
  const toGbp = (byCurrency: Map<string | null, number>): number | null => {
    let gbp: number | null = 0;
    for (const [code, amount] of byCurrency) {
      const converted = convertToGbp(amount, code, rates);
      if (converted === null) return null;
      gbp += converted;
    }
    return gbp;
  };
  const revenueGbp = toGbp(revenueByCurrency);
  const tierRevenueGbp = toGbp(tierRevenueByCurrency);

  const totalCvs = countCvs(cvRows);
  const firstInterviews = countFirstInterviews(interviewRows);

  const recruiterCost = modelSettings.cv_cost !== null ? totalCvs * modelSettings.cv_cost : null;
  const accountManagementCost = modelSettings.interview_cost !== null ? totalJobs * modelSettings.interview_cost : null;

  return {
    totalCvs,
    firstInterviews,
    totalPlacements: placements.length,
    revenue,
    revenueGbp,
    revenueRatesLive: live,
    cvCost: tierRevenueGbp !== null && totalCvs > 0 ? tierRevenueGbp / totalCvs : null,
    interviewCost: tierRevenueGbp !== null && firstInterviews > 0 ? tierRevenueGbp / firstInterviews : null,
    totalJobs,
    recruiterCost,
    accountManagementCost,
    businessCost: recruiterCost !== null && accountManagementCost !== null ? recruiterCost + accountManagementCost : null,
  };
}

export interface CandidateEvent {
  eventId: number;
  activityKey: string;
  createdAt: string;
}

export interface JobCandidate {
  candidateId: number;
  personId: number;
  addedAt: string;
  events: CandidateEvent[];
}

interface CandidateRow {
  candidate_id: number;
  person_id: number;
  created_at: string;
}

interface CandidateEventRow {
  event_id: number;
  person_id: number;
  activity_key: string;
  created_at: string;
}

export async function getJobCandidates(jobId: number, companyId: number): Promise<JobCandidate[]> {
  const supabase = getSupabaseServerClient();
  const [{ data: candidateRows, error: candidatesError }, { data: eventRows, error: eventsError }] = await Promise.all([
    supabase
      .from("active_accounts_jobs_candidates")
      .select("candidate_id, person_id, created_at")
      .eq("job_id", jobId)
      .eq("company_id", companyId),
    supabase
      .from("active_accounts_jobs_candidates_events")
      .select("event_id, person_id, activity_key, created_at")
      .eq("job_id", jobId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
  ]);

  if (candidatesError) throw new Error(`Failed to load candidates: ${candidatesError.message}`);
  if (eventsError) throw new Error(`Failed to load candidate events: ${eventsError.message}`);

  // The source system frequently double-logs the same event a few hours
  // apart (same job/person/activity_key, same calendar date, two event_ids)
  // — confirmed in real data: of the job/person/activity_key groups with
  // more than one row, ~95% share a single date. Real repeats (e.g. several
  // interviews over separate weeks) do exist and must stay distinct, so the
  // dedupe key is (activity_key, date) rather than just activity_key — only
  // same-day repeats of the same activity are collapsed.
  const eventsByPerson = new Map<number, CandidateEvent[]>();
  const seenKeys = new Map<number, Set<string>>();
  for (const e of (eventRows ?? []) as CandidateEventRow[]) {
    const seen = seenKeys.get(e.person_id) ?? new Set<string>();
    const dedupeKey = `${e.activity_key}:${e.created_at.slice(0, 10)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    seenKeys.set(e.person_id, seen);

    const list = eventsByPerson.get(e.person_id) ?? [];
    list.push({ eventId: e.event_id, activityKey: e.activity_key, createdAt: e.created_at });
    eventsByPerson.set(e.person_id, list);
  }

  // Most candidates added to a job (roughly two-thirds, in the real data)
  // never got a single event logged — added but nothing tracked since. Those
  // are dropped rather than shown as an empty "No activity logged" row; a
  // candidate is only listed once something's actually happened to them,
  // whatever the activity — not just the CV/interview keys the metrics
  // above count, since e.g. a real "hired" candidate can lack a logged
  // "submitted" event and would otherwise be wrongly hidden.
  return ((candidateRows ?? []) as CandidateRow[])
    .filter((c) => eventsByPerson.has(c.person_id))
    .map((c) => ({
      candidateId: c.candidate_id,
      personId: c.person_id,
      addedAt: c.created_at,
      events: eventsByPerson.get(c.person_id) ?? [],
    }));
}

// Scorecard ratings and talent insights are plain columns on active_accounts
// now — current value only, no update history (see
// docs/migrations/003_consolidate_scorecard_into_active_accounts.sql).
export async function setQualitativeRating(companyId: number, metric: QualitativeMetric, rating: number) {
  // Server Actions are directly-invocable endpoints, not gated by the page
  // component that renders their trigger — this page's route is already
  // admin-only in proxy.ts, but every mutation here re-checks anyway,
  // matching admin/users/actions.ts.
  await requireAdmin();

  // `metric` becomes a literal column key below — the QualitativeMetric type
  // only constrains TypeScript callers, not a raw request hitting this
  // action directly, so it's re-checked against the same allowlist at
  // runtime before it's ever used as a key. Without this, an arbitrary
  // string here could overwrite any column on active_accounts (status,
  // owned_by, ...), not just a rating.
  if (!QUALITATIVE_METRICS.includes(metric)) throw new Error(`Invalid metric: ${metric}`);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`Invalid rating: ${rating}`);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("active_accounts")
    .update({ [metric]: rating, updated_at: new Date().toISOString() })
    .eq("company_id", companyId);

  if (error) throw new Error(`Failed to save rating: ${error.message}`);
}

export interface TalentInsightsInput {
  headcountChange: number | null;
  attrition: number | null;
  avgTenure: number | null;
}

export async function updateTalentInsights(companyId: number, input: TalentInsightsInput) {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("active_accounts")
    .update({
      headcount_change: input.headcountChange,
      attrition: input.attrition,
      avg_tenure: input.avgTenure,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (error) throw new Error(`Failed to save talent insights: ${error.message}`);
}
