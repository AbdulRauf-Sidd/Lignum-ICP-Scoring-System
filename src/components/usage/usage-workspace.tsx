"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Layers, PoundSterling } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd, formatDateTime } from "@/lib/format";
import { useChartPalette } from "@/hooks/use-chart-palette";
import type { UsageRunDetail } from "@/lib/data/usage";
import { summarizeUsageRuns } from "@/lib/data/usage";

const ACTION_LABELS: Record<string, string> = {
  creditsafe_report: "Creditsafe report",
  account_redeem: "Cognism account redeem",
  contact_redeem: "Cognism contact redeem",
  repull_skip: "Skipped (re-pull window)",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function UsageWorkspace({ runs }: { runs: UsageRunDetail[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const palette = useChartPalette();

  const summary = summarizeUsageRuns(runs);
  const actionEntries = Object.entries(summary.actionCounts).sort((a, b) => b[1] - a[1]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {actionEntries.map(([action, count]) => (
          <StatCard key={action} icon={Layers} label={actionLabel(action)} value={count.toString()} sub="native units" />
        ))}
        <StatCard icon={PoundSterling} label="Metered cost" value={formatUsd(summary.totalCostUsd)} sub="across all runs" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage by action</CardTitle>
          <CardDescription>Line items logged per action type, across every run.</CardDescription>
        </CardHeader>
        <CardContent>
          {actionEntries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No usage logged yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={actionEntries.map(([action, count]) => ({ action: actionLabel(action), count }))}
                  margin={{ left: 4, right: 12, top: 8 }}
                >
                  <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                  <XAxis
                    dataKey="action"
                    tickLine={false}
                    axisLine={{ stroke: palette.ink.axis }}
                    tick={{ fill: palette.ink.text, fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: palette.ink.muted, fontSize: 11 }}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    formatter={(value) => [value, "Count"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                    {actionEntries.map(([action], i) => (
                      <Cell key={action} fill={palette.categorical[i % palette.categorical.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>Expand a run to see per-company line items.</CardDescription>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Line items</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No runs yet.
                    </TableCell>
                  </TableRow>
                )}
                {runs.map((run) => {
                  const isOpen = expanded.has(run.id);
                  return (
                    <React.Fragment key={run.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(run.id)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </TableCell>
                        <TableCell className="font-medium capitalize">{run.run_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{run.run_by ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(run.started_at)}</TableCell>
                        <TableCell>
                          <Badge variant={run.status === "in_progress" ? "secondary" : "outline"} className="capitalize">
                            {run.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{run.companyCount}</TableCell>
                        <TableCell>{run.items.length}</TableCell>
                        <TableCell>{formatUsd(run.totalCostUsd)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="px-4 py-3">
                              {run.items.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">
                                  No line items for this run.
                                </p>
                              ) : (
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
                                        <TableCell>{actionLabel(item.action)}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.companyName}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                                            {item.costUsd !== null
                                              ? "metered"
                                              : item.creditsUsed === 0
                                                ? "skipped"
                                                : `${item.creditsUsed ?? 1} unit${(item.creditsUsed ?? 1) === 1 ? "" : "s"}`}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{item.costUsd !== null ? formatUsd(item.costUsd) : "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Layers;
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
          <p className="mt-1 text-xs text-muted-foreground capitalize">{label}</p>
          <p className="text-[11px] text-muted-foreground/70">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
