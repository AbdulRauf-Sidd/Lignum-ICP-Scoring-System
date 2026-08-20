import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SECTORS } from "@/lib/constants";
import type { Tier, MatchFlag } from "@/lib/types";

interface ScoredCompanyRow {
  sector: string | null;
  icp: string | null;
  tier: Tier;
  match_flag: MatchFlag | null;
  score: number | null;
  last_enriched_at: string | null;
}

async function getScoredCompanyRows(): Promise<ScoredCompanyRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("sector, icp, tier, match_flag, score, last_enriched_at")
    .eq("status", "scored");

  if (error) throw new Error(`Failed to load scored companies: ${error.message}`);
  return (data ?? []) as ScoredCompanyRow[];
}

export interface SectorPerformance {
  sector: string;
  icp: string;
  scoredCount: number;
  avgScore: number | null;
  matchRate: number | null;
  noMatchCount: number;
  tierACount: number;
}

export async function getSectorPerformance(): Promise<SectorPerformance[]> {
  const rows = await getScoredCompanyRows();

  return SECTORS.map(({ sector }) => {
    const inSector = rows.filter((r) => r.sector === sector);
    const avgScore = inSector.length
      ? Math.round(inSector.reduce((sum, r) => sum + (r.score ?? 0), 0) / inSector.length)
      : null;
    const matches = inSector.filter((r) => r.match_flag === "match").length;
    const distinctIcps = Array.from(new Set(inSector.map((r) => r.icp).filter((icp): icp is string => !!icp)));

    return {
      sector,
      icp: distinctIcps.length === 0 ? "—" : distinctIcps.length === 1 ? distinctIcps[0] : "Multiple",
      scoredCount: inSector.length,
      avgScore,
      matchRate: inSector.length ? Math.round((matches / inSector.length) * 100) : null,
      noMatchCount: inSector.filter((r) => r.match_flag === "no_match").length,
      tierACount: inSector.filter((r) => r.tier === "A").length,
    };
  });
}

export interface TierCount {
  tier: Tier;
  count: number;
}

export async function getTierDistribution(): Promise<TierCount[]> {
  const rows = await getScoredCompanyRows();
  return (["A", "B", "C"] as const).map((tier) => ({
    tier,
    count: rows.filter((r) => r.tier === tier).length,
  }));
}

export interface MonthlyScoredPoint {
  month: string;
  scored: number;
}

export async function getMonthlyScoredTrend(months = 6): Promise<MonthlyScoredPoint[]> {
  const rows = await getScoredCompanyRows();
  const now = new Date();
  const buckets: { key: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
    });
  }

  const countByKey = new Map<string, number>();
  for (const row of rows) {
    if (!row.last_enriched_at) continue;
    const d = new Date(row.last_enriched_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }

  return buckets.map((b) => ({ month: b.label, scored: countByKey.get(b.key) ?? 0 }));
}
