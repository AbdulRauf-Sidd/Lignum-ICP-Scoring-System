import { getSupabaseServerClient } from "@/lib/supabase/server";

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

export interface UsageRunDetail extends UsageRunRow {
  companyCount: number;
  totalCostUsd: number;
  items: UsageLineItem[];
}

export interface UsageSummary {
  actionCredits: Record<string, number>;
  totalCredits: number;
}

export async function getUsageRuns(limit = 200): Promise<UsageRunDetail[]> {
  const supabase = getSupabaseServerClient();
  const { data: runs, error } = await supabase
    .from("usage_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load usage_runs: ${error.message}`);

  const runRows = (runs ?? []) as UsageRunRow[];
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

  return runRows.map((run) => {
    const runItems = itemsByRun.get(run.id) ?? [];
    return {
      ...run,
      companyCount: new Set(runItems.map((i) => i.companyId)).size,
      totalCostUsd: runItems.reduce((sum, i) => sum + (i.costUsd ?? 0), 0),
      items: runItems,
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

  const rows = (runs ?? []) as UsageRunRow[];
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
