"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartPalette } from "@/hooks/use-chart-palette";
import type { MonthlyScoredPoint, SectorPerformance, TierCount, SectorCompanyCount } from "@/lib/data/analytics";
import type { UserActivityRow, WeeklyUserPoint } from "@/lib/data/analytics-activity";
import { cn } from "@/lib/utils";

type Metric = "companies" | "contacts" | "csvs";
type Period = 4 | 8 | 12;

const METRIC_META: Record<Metric, { label: string; tileLabel: string; chartTitle: string }> = {
  companies: { label: "Companies", tileLabel: "Companies enriched", chartTitle: "Companies enriched" },
  contacts: { label: "Contacts", tileLabel: "Contacts pulled", chartTitle: "Contacts pulled" },
  csvs: { label: "CSVs", tileLabel: "CSV imports", chartTitle: "CSVs imported" },
};

const AVATAR_STYLES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % mod;
}

function Avatar({ id, name }: { id: string; name: string }) {
  const style = AVATAR_STYLES[hashIndex(id, AVATAR_STYLES.length)];
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", style)}>
      {initials(name)}
    </span>
  );
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", active && "border-primary bg-primary/5")}>
      <p className={cn("text-2xl font-semibold leading-none", active && "text-primary")}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

export function AnalyticsWorkspace({
  trend,
  sectorPerf,
  tierDist,
  userActivity,
  weeklyByMetric,
  companiesBySector,
}: {
  trend: MonthlyScoredPoint[];
  sectorPerf: SectorPerformance[];
  tierDist: TierCount[];
  userActivity: UserActivityRow[];
  weeklyByMetric: Record<Metric, WeeklyUserPoint[]>;
  companiesBySector: SectorCompanyCount[];
}) {
  const palette = useChartPalette();
  const [metric, setMetric] = React.useState<Metric>("companies");
  const [period, setPeriod] = React.useState<Period>(8);
  const [userFilter, setUserFilter] = React.useState<string>("all");

  const users = userFilter === "all" ? userActivity : userActivity.filter((u) => u.user === userFilter);
  const weeklyData = weeklyByMetric[metric].slice(-period);

  function totalFor(m: Metric) {
    return weeklyByMetric[m]
      .slice(-period)
      .reduce((sum, point) => sum + users.reduce((s, u) => s + (Number(point[u.user]) || 0), 0), 0);
  }

  const csvTotal = totalFor("csvs");
  const companiesTotal = totalFor("companies");
  const contactsTotal = totalFor("contacts");
  const peakWeek = Math.max(0, ...weeklyData.map((p) => users.reduce((s, u) => s + (Number(p[u.user]) || 0), 0)));

  const maxSectorCount = Math.max(1, ...companiesBySector.map((s) => s.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PillGroup
          value={metric}
          onChange={setMetric}
          options={[
            { value: "companies" as const, label: "Companies" },
            { value: "contacts" as const, label: "Contacts" },
            { value: "csvs" as const, label: "CSVs" },
          ]}
        />
        <PillGroup
          value={String(period) as `${Period}`}
          onChange={(v) => setPeriod(Number(v) as Period)}
          options={[
            { value: "4" as const, label: "4 weeks" },
            { value: "8" as const, label: "8 weeks" },
            { value: "12" as const, label: "12 weeks" },
          ]}
        />
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {userActivity.map((u) => (
              <SelectItem key={u.user} value={u.user}>
                {u.user}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto gap-1.5 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
          Placeholder data · per-user
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="CSV imports" value={csvTotal} active={metric === "csvs"} />
        <StatTile label="Companies enriched" value={companiesTotal} active={metric === "companies"} />
        <StatTile label="Contacts pulled" value={contactsTotal} active={metric === "contacts"} />
        <StatTile label="Active users" value={users.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{METRIC_META[metric].chartTitle}</CardTitle>
          <CardDescription>
            Last {period} weeks · peak {peakWeek}/week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={36} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {users.map((u, i) => (
                  <Bar
                    key={u.user}
                    dataKey={u.user}
                    stackId="a"
                    fill={palette.categorical[i % palette.categorical.length]}
                    radius={i === users.length - 1 ? [4, 4, 0, 0] : undefined}
                    maxBarSize={64}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Companies by sector</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {companiesBySector.map((s, i) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: palette.categorical[i % palette.categorical.length] }}
                />
                <span className="w-40 shrink-0 truncate text-sm">{s.sector}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(s.count / maxSectorCount) * 100}%`, background: palette.categorical[i % palette.categorical.length] }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-user activity</CardTitle>
            <CardDescription>Placeholder data — attribution becomes accurate once Microsoft SSO is connected.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y">
              {userActivity.map((row, i) => (
                <div key={row.email} className={cn("flex items-center gap-3 px-6 py-3", i === 0 && "bg-primary/5")}>
                  <span className="w-4 shrink-0 text-sm text-muted-foreground">{i + 1}</span>
                  <Avatar id={row.email} name={row.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.user}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.role}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right text-sm tabular-nums">
                    <span className="w-10 text-muted-foreground">{row.csvsImported}</span>
                    <span className="w-12 font-medium">{row.companiesAdded}</span>
                    <span className="w-12 text-muted-foreground">{row.contactsAdded}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Companies scored per month</CardTitle>
          <CardDescription>Trailing 6 months · real scoring outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                <Bar dataKey="scored" radius={[4, 4, 0, 0]} maxBarSize={48} fill={palette.categorical[0]} name="Scored" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scored companies by ICP</CardTitle>
            <CardDescription>Real scoring outcomes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorPerf} layout="vertical" margin={{ left: 12, right: 20, top: 8 }}>
                  <CartesianGrid horizontal={false} stroke={palette.ink.grid} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="sector"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tick={{ fill: palette.ink.text, fontSize: 12 }}
                  />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="scoredCount" radius={[0, 4, 4, 0]} maxBarSize={28} name="Scored companies">
                    {sectorPerf.map((s, i) => (
                      <Cell key={s.sector} fill={palette.categorical[i % palette.categorical.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier distribution</CardTitle>
            <CardDescription>Ordinal — A, B, C shown light to dark.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDist} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                  <XAxis dataKey="tier" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64} name="Companies">
                    {tierDist.map((t, i) => (
                      <Cell key={t.tier} fill={palette.ordinal[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
