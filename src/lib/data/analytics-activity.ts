import { createRng, randInt, randomPastDate, MOCK_TODAY } from "@/lib/mock/rng";
import { randomPersonName } from "@/lib/mock/names";
import { SECTORS } from "@/lib/constants";

// Placeholder activity data — per-user attribution becomes accurate once
// Microsoft SSO is wired up. Seeded so it's stable across renders.
const SEED = 20260821;

const ROLES = ["Business Development", "Research Analyst", "BD Manager", "Data Analyst", "Sales Development Rep", "Account Executive"];

export interface UserActivityRow {
  user: string;
  email: string;
  role: string;
  csvsImported: number;
  companiesAdded: number;
  contactsAdded: number;
  lastActiveAt: string;
}

export function getUserActivity(userCount = 6): UserActivityRow[] {
  const rng = createRng(SEED);
  const rows: UserActivityRow[] = [];
  for (let i = 0; i < userCount; i++) {
    const { first, last } = randomPersonName(rng);
    rows.push({
      user: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@lignum.com`,
      role: ROLES[i % ROLES.length],
      csvsImported: randInt(rng, 1, 18),
      companiesAdded: randInt(rng, 10, 320),
      contactsAdded: randInt(rng, 5, 240),
      lastActiveAt: randomPastDate(rng, 14),
    });
  }
  return rows.sort((a, b) => b.companiesAdded - a.companiesAdded);
}

export interface WeeklyUserPoint {
  period: string;
  [userName: string]: string | number;
}

const METRIC_RANGE: Record<"companies" | "contacts" | "csvs", [number, number]> = {
  companies: [4, 60],
  contacts: [2, 45],
  csvs: [0, 6],
};

export function getWeeklyActivityByUser(
  metric: "companies" | "contacts" | "csvs",
  weeks: number,
  users: UserActivityRow[],
): WeeklyUserPoint[] {
  const rng = createRng(SEED + metric.length + weeks);
  const [min, max] = METRIC_RANGE[metric];
  const points: WeeklyUserPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(MOCK_TODAY);
    d.setDate(d.getDate() - i * 7);
    const point: WeeklyUserPoint = { period: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) };
    for (const u of users) point[u.user] = randInt(rng, min, max);
    points.push(point);
  }
  return points;
}

export interface PeriodActivityPoint {
  period: string;
  csvsImported: number;
  companiesAdded: number;
  contactsAdded: number;
}

export function getPeriodActivity(periods = 6): PeriodActivityPoint[] {
  const rng = createRng(SEED + 1);
  const points: PeriodActivityPoint[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(MOCK_TODAY.getFullYear(), MOCK_TODAY.getMonth() - i, 1);
    points.push({
      period: d.toLocaleDateString("en-GB", { month: "short" }),
      csvsImported: randInt(rng, 3, 22),
      companiesAdded: randInt(rng, 40, 260),
      contactsAdded: randInt(rng, 30, 190),
    });
  }
  return points;
}

export interface SectorTrendPoint {
  period: string;
  [sector: string]: string | number;
}

export function getSectorTrend(kind: "companies" | "contacts", periods = 6): SectorTrendPoint[] {
  const rng = createRng(SEED + (kind === "companies" ? 2 : 3));
  const [min, max] = kind === "companies" ? [4, 60] : [2, 45];
  const points: SectorTrendPoint[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(MOCK_TODAY.getFullYear(), MOCK_TODAY.getMonth() - i, 1);
    const point: SectorTrendPoint = { period: d.toLocaleDateString("en-GB", { month: "short" }) };
    for (const { sector } of SECTORS) {
      point[sector] = randInt(rng, min, max);
    }
    points.push(point);
  }
  return points;
}
