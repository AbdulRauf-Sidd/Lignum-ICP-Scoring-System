import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getUsers } from "@/lib/data/users";

const CREDITSAFE_BALANCE_WEBHOOK_URL =
  process.env.N8N_CREDITSAFE_BALANCE_WEBHOOK_URL ??
  "https://lignum.app.n8n.cloud/webhook/079475e7-ffdc-4bc2-b2be-647aa9062508";
const WEBHOOK_SECRET_HEADER = "X-Lignum-Webhook-Secret";

interface CreditsafeBalanceResponse {
  success?: boolean;
  data?: Array<{
    countryIso2?: string;
    paid?: number;
    used?: number;
  }>;
}

export interface CreditsafeCountryBalance {
  paid: number;
  used: number;
}

export interface CreditsafeBalances {
  US: CreditsafeCountryBalance;
  CA: CreditsafeCountryBalance;
}

const EMPTY_CREDITSAFE_BALANCES: CreditsafeBalances = {
  US: { paid: 0, used: 0 },
  CA: { paid: 0, used: 0 },
};

export async function getCreditsafeBalances(): Promise<CreditsafeBalances> {
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[usage] Missing N8N_WEBHOOK_SECRET; skipping Creditsafe balance fetch");
    return EMPTY_CREDITSAFE_BALANCES;
  }

  console.log("[usage] Fetching Creditsafe balances from:", CREDITSAFE_BALANCE_WEBHOOK_URL);

  try {
    const response = await fetch(CREDITSAFE_BALANCE_WEBHOOK_URL, {
      method: "GET",
      headers: {
        [WEBHOOK_SECRET_HEADER]: webhookSecret,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    console.log("[usage] Creditsafe webhook status:", response.status, response.statusText);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[usage] Creditsafe webhook non-OK response:", text);
      return EMPTY_CREDITSAFE_BALANCES;
    }

    const body = (await response.json()) as CreditsafeBalanceResponse;
    console.log("[usage] Creditsafe webhook JSON:", body);

    if (!body.success || !Array.isArray(body.data)) {
      console.warn("[usage] Creditsafe webhook returned unexpected payload");
      return EMPTY_CREDITSAFE_BALANCES;
    }

    const balances: CreditsafeBalances = {
      US: { ...EMPTY_CREDITSAFE_BALANCES.US },
      CA: { ...EMPTY_CREDITSAFE_BALANCES.CA },
    };
    for (const entry of body.data) {
      if (entry.countryIso2 !== "US" && entry.countryIso2 !== "CA") continue;
      balances[entry.countryIso2] = {
        paid: typeof entry.paid === "number" ? entry.paid : 0,
        used: typeof entry.used === "number" ? entry.used : 0,
      };
    }
    return balances;
  } catch (error) {
    console.error("[usage] Creditsafe balance fetch failed:", error);
    return EMPTY_CREDITSAFE_BALANCES;
  }
}

// Mirrors the real `usage_runs` table.
export interface UsageRunRow {
  id: string;
  run_type: string;
  run_by: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
}

export interface UsageRun extends UsageRunRow {
  companyCount: number;
}

// Mirrors the real `usage_items` table.
interface UsageItemRow {
  id: string;
  usage_run_id: string;
  company_id: string;
  action: string;
  cost_usd: number | null;
  credits_used: number | null;
  created_at: string;
}

export interface UsageLineItem {
  id: string;
  action: string;
  companyId: string;
  companyName: string;
  costUsd: number | null;
  creditsUsed: number | null;
}

// n8n marks a run "completed" once its last node finishes, but a couple of
// code paths still fall through without reaching that node (see the
// handover notes) -- past this age with a status that never advanced past
// "in_progress", it's more likely stale than genuinely still running.
const STALE_IN_PROGRESS_MS = 30 * 60 * 1000;

export interface UsageRunDetail extends UsageRunRow {
  companyCount: number;
  totalCostUsd: number;
  items: UsageLineItem[];
  isStale: boolean;
}

export interface UsageSummary {
  actionCredits: Record<string, number>;
  totalCredits: number;
}

// usage_runs.run_by stores the acting user's auth id (uuid); swap it for a
// display name. Scheduled repulls have no user, so they get a fixed label.
// Unknown ids (e.g. a deleted user) fall back to "—".
const AUTO_REPULL_LABEL = "Automated (scheduled repull)";

async function withRunByNames<T extends { run_by: string | null; run_type: string }>(rows: T[]): Promise<T[]> {
  const nameById = rows.some((r) => r.run_by)
    ? new Map((await getUsers()).map((u) => [u.id, u.name]))
    : new Map<string, string>();
  return rows.map((r) => ({
    ...r,
    run_by: r.run_by
      ? (nameById.get(r.run_by) ?? null)
      : r.run_type === "auto_repull"
        ? AUTO_REPULL_LABEL
        : null,
  }));
}

export async function getUsageRuns(limit = 200): Promise<UsageRunDetail[]> {
  const supabase = getSupabaseServerClient();
  const { data: runs, error } = await supabase
    .from("usage_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load usage_runs: ${error.message}`);

  const runRows = await withRunByNames((runs ?? []) as UsageRunRow[]);
  if (runRows.length === 0) return [];

  const runIds = runRows.map((r) => r.id);
  const { data: items, error: itemsError } = await supabase
    .from("usage_items")
    .select("*")
    .in("usage_run_id", runIds);

  if (itemsError) throw new Error(`Failed to load usage_items: ${itemsError.message}`);

  const itemRows = (items ?? []) as UsageItemRow[];
  const companyIds = Array.from(new Set(itemRows.map((i) => i.company_id)));

  let companyNameById = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    if (companiesError) throw new Error(`Failed to load companies: ${companiesError.message}`);
    companyNameById = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  }

  const itemsByRun = new Map<string, UsageLineItem[]>();
  for (const item of itemRows) {
    const list = itemsByRun.get(item.usage_run_id) ?? [];
    list.push({
      id: item.id,
      action: item.action,
      companyId: item.company_id,
      companyName: companyNameById.get(item.company_id) ?? "Unknown company",
      costUsd: item.cost_usd,
      creditsUsed: item.credits_used,
    });
    itemsByRun.set(item.usage_run_id, list);
  }

  const now = Date.now();
  return runRows.map((run) => {
    const runItems = itemsByRun.get(run.id) ?? [];
    return {
      ...run,
      companyCount: new Set(runItems.map((i) => i.companyId)).size,
      totalCostUsd: runItems.reduce((sum, i) => sum + (i.costUsd ?? 0), 0),
      items: runItems,
      isStale: run.status === "in_progress" && now - new Date(run.started_at).getTime() > STALE_IN_PROGRESS_MS,
    };
  });
}

export function summarizeUsageRuns(runs: UsageRunDetail[]): UsageSummary {
  const actionCredits: Record<string, number> = {};
  let totalCredits = 0;
  for (const run of runs) {
    for (const item of run.items) {
      const credits = item.creditsUsed ?? 0;
      actionCredits[item.action] = (actionCredits[item.action] ?? 0) + credits;
      totalCredits += credits;
    }
  }
  return { actionCredits, totalCredits };
}

export async function getRecentUsageRuns(limit = 8): Promise<UsageRun[]> {
  const supabase = getSupabaseServerClient();
  const { data: runs, error } = await supabase
    .from("usage_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load usage_runs: ${error.message}`);

  const rows = await withRunByNames((runs ?? []) as UsageRunRow[]);
  if (rows.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("usage_items")
    .select("usage_run_id, company_id")
    .in(
      "usage_run_id",
      rows.map((r) => r.id),
    );

  if (itemsError) throw new Error(`Failed to load usage_items: ${itemsError.message}`);

  const companiesByRun = new Map<string, Set<string>>();
  for (const item of (items ?? []) as { usage_run_id: string; company_id: string }[]) {
    if (!companiesByRun.has(item.usage_run_id)) companiesByRun.set(item.usage_run_id, new Set());
    companiesByRun.get(item.usage_run_id)!.add(item.company_id);
  }

  return rows.map((r) => ({ ...r, companyCount: companiesByRun.get(r.id)?.size ?? 0 }));
}
