import { COMPANIES, CONTACTS, USAGE_RUNS, NOTIFICATIONS, ICP_PROFILES } from "./data";
import { SECTORS } from "@/lib/constants";

const TODAY = new Date("2026-08-12T12:00:00Z").getTime();
const DAY_MS = 1000 * 60 * 60 * 24;

function withinDays(iso: string | null, days: number) {
  if (!iso) return false;
  return TODAY - new Date(iso).getTime() <= days * DAY_MS;
}

export function getHomeStats() {
  const triageCompanies = COMPANIES.filter((c) => c.status === "triage");
  const scoredThisWeek = COMPANIES.filter((c) => c.status === "scored" && withinDays(c.lastEnrichedAt, 7));
  const pendingContacts = CONTACTS.filter((c) => c.status === "listed");
  const unreadNotifications = NOTIFICATIONS.filter((n) => !n.read);
  const failedThisWeek = COMPANIES.filter((c) => c.status === "failed" && withinDays(c.importedAt, 14));

  return {
    triageCount: triageCompanies.length,
    entityAmbiguousCount: triageCompanies.filter((c) => c.triageReason === "entity_ambiguous").length,
    lowConfidenceCount: triageCompanies.filter((c) => c.triageReason === "low_confidence_sector").length,
    icpNoMatchCount: triageCompanies.filter((c) => c.triageReason === "icp_no_match").length,
    scoredThisWeekCount: scoredThisWeek.length,
    pendingContactsCount: pendingContacts.length,
    unreadNotificationsCount: unreadNotifications.length,
    failedCount: failedThisWeek.length,
  };
}

export function getLastRun() {
  return USAGE_RUNS[0] ?? null;
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

export function getSectorPerformance(): SectorPerformance[] {
  return SECTORS.map(({ sector }) => {
    const icp = ICP_PROFILES.find((p) => p.sector === sector)!;
    const scored = COMPANIES.filter((c) => c.sector === sector && c.status === "scored");
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length)
      : null;
    const matches = scored.filter((c) => c.matchFlag === "match").length;
    return {
      sector,
      icp: icp.name,
      scoredCount: scored.length,
      avgScore,
      matchRate: scored.length ? Math.round((matches / scored.length) * 100) : null,
      noMatchCount: scored.filter((c) => c.matchFlag === "no_match").length,
      tierACount: scored.filter((c) => c.tier === "A").length,
    };
  });
}

export function getWeakSectors(): SectorPerformance[] {
  return getSectorPerformance()
    .filter((s) => s.scoredCount > 0 && (s.avgScore ?? 100) < 65)
    .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0));
}

export function getUsageSummary() {
  const items = USAGE_RUNS.flatMap((r) => r.items);
  const creditsafeReports = items.filter((i) => i.action === "creditsafe_report").length;
  const accountRedeems = items.filter((i) => i.action === "account_redeem").length;
  const contactRedeems = items.filter((i) => i.action === "contact_redeem").length;
  const spendByService = {
    firecrawl: items.filter((i) => i.action === "firecrawl").reduce((s, i) => s + (i.costGbp ?? 0), 0),
    exa: items.filter((i) => i.action === "exa").reduce((s, i) => s + (i.costGbp ?? 0), 0),
    llm: items.filter((i) => i.action === "llm").reduce((s, i) => s + (i.costGbp ?? 0), 0),
  };
  return {
    creditsafeReports,
    accountRedeems,
    contactRedeems,
    meteredSpendGbp: spendByService.firecrawl + spendByService.exa + spendByService.llm,
    spendByService,
  };
}

export interface UserBreakdownRow {
  user: string;
  runs: number;
  companies: number;
  creditsafeReports: number;
  cognismCredits: number;
  spendGbp: number;
}

export function getUserBreakdown(): UserBreakdownRow[] {
  const users = Array.from(new Set(USAGE_RUNS.map((r) => r.runBy)));
  return users
    .map((user) => {
      const runs = USAGE_RUNS.filter((r) => r.runBy === user);
      const items = runs.flatMap((r) => r.items);
      return {
        user,
        runs: runs.length,
        companies: runs.reduce((s, r) => s + r.companyCount, 0),
        creditsafeReports: items.filter((i) => i.action === "creditsafe_report").length,
        cognismCredits: items.filter((i) => i.action === "account_redeem" || i.action === "contact_redeem").length,
        spendGbp: items.reduce((s, i) => s + (i.costGbp ?? 0), 0),
      };
    })
    .sort((a, b) => b.spendGbp - a.spendGbp);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

export function getMonthlyScoredTrend() {
  const counts = new Array(8).fill(0);
  COMPANIES.filter((c) => c.status === "scored" && c.lastEnrichedAt).forEach((c) => {
    const month = new Date(c.lastEnrichedAt as string).getMonth();
    if (month >= 0 && month < 8) counts[month] += 1;
  });
  return MONTH_LABELS.map((label, i) => ({ month: label, scored: counts[i] }));
}

export function getTierDistribution() {
  const scored = COMPANIES.filter((c) => c.status === "scored");
  return (["A", "B", "C"] as const).map((tier) => ({
    tier,
    count: scored.filter((c) => c.tier === tier).length,
  }));
}

export function getRecentActivity(limit = 8) {
  const runEvents = USAGE_RUNS.slice(0, limit).map((r) => ({
    id: r.id,
    kind: "run" as const,
    label: `${r.runType === "enrichment" ? "Enrichment" : "Contact pull"} run by ${r.runBy}`,
    detail: `${r.companyCount} companies`,
    createdAt: r.createdAt,
  }));
  return runEvents.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}
