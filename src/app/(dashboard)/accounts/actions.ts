"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getUsdExchangeRates, convertToUsd } from "@/lib/exchange-rates";
import { ALLOWED_JOB_CATEGORIES } from "@/lib/data/accounts";
import type { CurrencyAmount } from "@/lib/format";

// A candidate can hit the same activity twice on the same job (re-sent CV,
// duplicate status log, etc.) — 70 of 607 real event rows are exactly that.
// Counting raw rows would inflate the metrics, so we count each person once
// per activity within the company. Flip this if raw-event counting is ever
// wanted instead — every metric below reads this one flag.
const COUNT_DISTINCT_PERSONS = true;

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
  // Sum of `revenue` converted to USD — null if one of the currencies isn't
  // in the rates we have, so the caller can fall back to showing the
  // per-currency breakdown instead of a wrong number.
  revenueUsd: number | null;
  // false when revenueUsd was computed from the static fallback snapshot
  // rather than a live/cached fetch — lets the caller avoid claiming "today's
  // rates" when they aren't. Meaningless when revenueUsd is null.
  revenueRatesLive: boolean;
}

interface EventRow {
  person_id: number;
  activity_key: string;
}

function countActivity(rows: EventRow[], key: string): number {
  const matching = rows.filter((r) => r.activity_key === key);
  if (COUNT_DISTINCT_PERSONS) return new Set(matching.map((r) => r.person_id)).size;
  return matching.length;
}

interface PlacementRow {
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

export async function getAccountMetrics(companyId: number, startDate: string, endDate: string): Promise<AccountMetrics> {
  const supabase = getSupabaseServerClient();

  // Every metric below is scoped to Tier 1 / Tier 2 jobs only — resolve the
  // company's tier 1/2 job ids first, then filter events and placements to
  // just those jobs.
  const { data: jobRows, error: jobsError } = await supabase
    .from("active_accounts_jobs")
    .select("job_id")
    .eq("company_id", companyId)
    .in("job_category", ALLOWED_JOB_CATEGORIES);
  if (jobsError) throw new Error(`Failed to load account jobs: ${jobsError.message}`);

  const jobIds = (jobRows ?? []).map((r) => r.job_id as number);
  if (jobIds.length === 0) {
    return { totalCvs: 0, firstInterviews: 0, totalPlacements: 0, revenue: [], revenueUsd: 0, revenueRatesLive: true };
  }

  const [{ data: eventRows, error: eventsError }, { data: placementRows, error: placementsError }] = await Promise.all([
    supabase
      .from("active_accounts_jobs_candidates_events")
      .select("person_id, activity_key")
      .eq("company_id", companyId)
      .in("job_id", jobIds)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("activity_key", ["moved_to_cv_sent", "client_interview"]),
    supabase
      .from("active_accounts_placements")
      .select("fee, fee_type_id, salary, salary_currency_id, currency:currencies!salary_currency_id(code)")
      .eq("company_id", companyId)
      .in("job_id", jobIds)
      .gte("created_at", startDate)
      .lte("created_at", endDate),
  ]);

  if (eventsError) throw new Error(`Failed to load account metrics: ${eventsError.message}`);
  if (placementsError) throw new Error(`Failed to load placements: ${placementsError.message}`);

  const rows = (eventRows ?? []) as EventRow[];
  const placements = (placementRows ?? []) as unknown as PlacementRow[];

  // Roughly a fifth of companies have placements in more than one currency —
  // summing those together would misrepresent the total, so revenue is kept
  // as separate per-currency totals as well as a converted-to-USD figure.
  const revenueByCurrency = new Map<string | null, number>();
  for (const p of placements) {
    const amount = placementRevenue(p);
    if (amount === null) continue;
    const code = p.currency?.code ?? null;
    revenueByCurrency.set(code, (revenueByCurrency.get(code) ?? 0) + amount);
  }
  const revenue = Array.from(revenueByCurrency.entries())
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => b.amount - a.amount);

  const { rates, live } = await getUsdExchangeRates();
  let revenueUsd: number | null = 0;
  for (const r of revenue) {
    const converted = convertToUsd(r.amount, r.code, rates);
    if (converted === null) {
      revenueUsd = null;
      break;
    }
    revenueUsd += converted;
  }

  return {
    totalCvs: countActivity(rows, "moved_to_cv_sent"),
    firstInterviews: countActivity(rows, "client_interview"),
    totalPlacements: placements.length,
    revenue,
    revenueUsd,
    revenueRatesLive: live,
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

  const eventsByPerson = new Map<number, CandidateEvent[]>();
  for (const e of (eventRows ?? []) as CandidateEventRow[]) {
    const list = eventsByPerson.get(e.person_id) ?? [];
    list.push({ eventId: e.event_id, activityKey: e.activity_key, createdAt: e.created_at });
    eventsByPerson.set(e.person_id, list);
  }

  return ((candidateRows ?? []) as CandidateRow[]).map((c) => ({
    candidateId: c.candidate_id,
    personId: c.person_id,
    addedAt: c.created_at,
    events: eventsByPerson.get(c.person_id) ?? [],
  }));
}
