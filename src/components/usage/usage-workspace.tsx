"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, FileText, KeyRound, Users2, PoundSterling } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USAGE_RUNS } from "@/lib/mock/data";
import { getUsageSummary, getUserBreakdown } from "@/lib/mock/derived";
import { formatGbp, formatDateTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/constants";
import { useChartPalette } from "@/hooks/use-chart-palette";
import { cn } from "@/lib/utils";

const OPAQUE_ACTION_LABELS: Record<string, string> = {
  creditsafe_report: "Creditsafe report",
  account_redeem: "Cognism account redeem",
  contact_redeem: "Cognism contact redeem",
};

const METERED_ACTION_LABELS: Record<string, string> = {
  firecrawl: "Firecrawl",
  exa: "Exa",
  llm: "LLM (OpenRouter)",
};

export function UsageWorkspace() {
  const summary = getUsageSummary();
  const userBreakdown = getUserBreakdown();
  const [view, setView] = React.useState<"mine" | "everyone">(CURRENT_USER.role === "admin" ? "everyone" : "mine");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const palette = useChartPalette();

  const visibleRuns = view === "mine" ? USAGE_RUNS.filter((r) => r.runBy === CURRENT_USER.name) : USAGE_RUNS;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const spendData = [
    { service: "Firecrawl", spend: summary.spendByService.firecrawl },
    { service: "Exa", spend: summary.spendByService.exa },
    { service: "LLM", spend: summary.spendByService.llm },
  ];

  return (
    <div className="flex flex-col gap-6">
      {CURRENT_USER.role === "admin" && (
        <Tabs value={view} onValueChange={(v) => setView(v as "mine" | "everyone")}>
          <TabsList>
            <TabsTrigger value="everyone">Everyone</TabsTrigger>
            <TabsTrigger value="mine">My usage</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Creditsafe reports" value={summary.creditsafeReports.toString()} sub="native units" />
        <StatCard icon={KeyRound} label="Cognism account redeems" value={summary.accountRedeems.toString()} sub="worst case 1/company" />
        <StatCard icon={Users2} label="Cognism contact redeems" value={summary.contactRedeems.toString()} sub="native units" />
        <StatCard icon={PoundSterling} label="Metered spend" value={formatGbp(summary.meteredSpendGbp)} sub="Firecrawl + Exa + LLM" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metered spend by service</CardTitle>
          <CardDescription>Firecrawl, Exa and the LLM are priced per call or token — computed and shown in pounds.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendData} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                <XAxis dataKey="service" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: palette.ink.muted, fontSize: 11 }}
                  tickFormatter={(v) => `£${v}`}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  formatter={(value) => [formatGbp(Number(value)), "Spend"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {spendData.map((d, i) => (
                    <Cell key={d.service} fill={palette.categorical[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>Expand a run to see per-company line items. Contact pulls appear as their own dated entries.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Run type</TableHead>
                  <TableHead>Run by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Line items</TableHead>
                  <TableHead>Metered spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRuns.map((run) => {
                  const isOpen = expanded.has(run.id);
                  const runSpend = run.items.reduce((s, i) => s + (i.costGbp ?? 0), 0);
                  return (
                    <React.Fragment key={run.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(run.id)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </TableCell>
                        <TableCell className="font-medium capitalize">{run.runType.replace("_", " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{run.runBy}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(run.createdAt)}</TableCell>
                        <TableCell>{run.companyCount}</TableCell>
                        <TableCell>{run.items.length}</TableCell>
                        <TableCell>{formatGbp(runSpend)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="px-4 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Kind</TableHead>
                                    <TableHead>Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {run.items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>
                                        {OPAQUE_ACTION_LABELS[item.action] ?? METERED_ACTION_LABELS[item.action]}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{item.companyName}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "border-transparent",
                                            item.isOpaque
                                              ? "bg-muted text-muted-foreground"
                                              : "bg-sky-500/10 text-sky-600 dark:text-sky-400",
                                          )}
                                        >
                                          {item.isOpaque ? "1 unit" : "metered"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{item.isOpaque ? "—" : formatGbp(item.costGbp)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {CURRENT_USER.role === "admin" && view === "everyone" && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by user</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Companies</TableHead>
                    <TableHead>Creditsafe reports</TableHead>
                    <TableHead>Cognism credits</TableHead>
                    <TableHead>Metered spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBreakdown.map((row) => (
                    <TableRow key={row.user}>
                      <TableCell className="font-medium">{row.user}</TableCell>
                      <TableCell>{row.runs}</TableCell>
                      <TableCell>{row.companies}</TableCell>
                      <TableCell>{row.creditsafeReports}</TableCell>
                      <TableCell>{row.cognismCredits}</TableCell>
                      <TableCell>{formatGbp(row.spendGbp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground/70">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
