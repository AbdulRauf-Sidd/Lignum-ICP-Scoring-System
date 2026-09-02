"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// A candidate can hit the same activity twice on the same job (re-sent CV,
// duplicate status log, etc.) — 70 of 607 real event rows are exactly that.
// Counting raw rows would inflate the metrics, so we count each person once
// per activity within the company. Flip this if raw-event counting is ever
// wanted instead — every metric below reads this one flag.
const COUNT_DISTINCT_PERSONS = true;

export interface AccountHeaderInput {
  status: string;
  ownedBy: string;
}

export async function updateAccountHeader(companyId: number, input: AccountHeaderInput) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("active_accounts")
    .update({
      status: input.status.trim(),
      owned_by: input.ownedBy.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (error) throw new Error(`Failed to update account: ${error.message}`);
  revalidatePath("/accounts");
}

export interface AccountMetrics {
  totalCvs: number;
  firstInterviews: number;
  totalPlacements: number;
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

// `total_revenue` on active_accounts is the account's lifetime running
// total, not a time series, so it's shown as-is from the header rather than
// scoped here — this query only covers the three activity-based metrics.
export async function getAccountMetrics(companyId: number, startDate: string, endDate: string): Promise<AccountMetrics> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts_jobs_candidates_events")
    .select("person_id, activity_key")
    .eq("company_id", companyId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .in("activity_key", ["moved_to_cv_sent", "client_interview", "moved_to_placed"]);

  if (error) throw new Error(`Failed to load account metrics: ${error.message}`);

  const rows = (data ?? []) as EventRow[];
  return {
    totalCvs: countActivity(rows, "moved_to_cv_sent"),
    firstInterviews: countActivity(rows, "client_interview"),
    totalPlacements: countActivity(rows, "moved_to_placed"),
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
