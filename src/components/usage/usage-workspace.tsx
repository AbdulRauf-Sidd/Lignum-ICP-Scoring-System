"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatDateTime } from "@/lib/format";
import { useChartPalette } from "@/hooks/use-chart-palette";
import type { UsageRunDetail } from "@/lib/data/usage";
import { summarizeUsageRuns } from "@/lib/data/usage";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  creditsafe_report: "Creditsafe report",
  account_redeem: "Cognism account redeem",
  contact_redeem: "Cognism contact redeem",
  repull_skip: "Skipped (re-pull window)",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

function runTitle(runType: string): string {
  const words = runType.replace(/_/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} run`;
}

interface CompanyBreakdown {
  companyId: string;
  companyName: string;
  creditsafeCredits: number;
  cognismCredits: number;
  skipped: boolean;
}

function groupByCompany(items: UsageRunDetail["items"]): CompanyBreakdown[] {
  const map = new Map<string, CompanyBreakdown>();
  for (const item of items) {
    const entry = map.get(item.companyId) ?? {
      companyId: item.companyId,
      companyName: item.companyName,
      creditsafeCredits: 0,
      cognismCredits: 0,
      skipped: false,
    };
    if (item.action === "creditsafe_report") entry.creditsafeCredits += item.creditsUsed ?? 0;
    else if (item.action === "account_redeem" || item.action === "contact_redeem") entry.cognismCredits += item.creditsUsed ?? 0;
    else if (item.action === "repull_skip") entry.skipped = true;
    map.set(item.companyId, entry);
  }
  return Array.from(map.values());
}

export function UsageWorkspace({
  runs,
  indicativePricePerCredit,
}: {
  runs: UsageRunDetail[];
  indicativePricePerCredit: number | null;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const palette = useChartPalette();

  const summary = summarizeUsageRuns(runs);
  const actionEntries = Object.entries(summary.actionCredits).sort((a, b) => b[1] - a[1]);
  const maxCredits = Math.max(1, ...actionEntries.map(([, credits]) => credits));

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
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3.5">
            <div>
              <p className="font-mono text-[10.5px] tracking-wide text-muted-foreground uppercase">Total credits spent</p>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className="text-[34px] leading-none font-extrabold tracking-tight text-foreground">
                  {summary.totalCredits}
                </span>
                <span className="text-[13px] text-muted-foreground">credits across all activity</span>
              </div>
            </div>
            {indicativePricePerCredit !== null && (
              <div className="flex items-center gap-2 rounded-[10px] border bg-muted/40 px-3.5 py-2 text-[13px]">
                <b className="font-semibold">{formatUsd(summary.totalCredits * indicativePricePerCredit)}</b>
                <span className="font-mono text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Indicative
                </span>
              </div>
            )}
          </div>

          {actionEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No usage logged yet.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {actionEntries.map(([action, credits], i) => (
                <div key={action} className="grid grid-cols-[minmax(0,230px)_1fr_52px] items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-sm"
                      style={{ background: palette.categorical[i % palette.categorical.length] }}
                    />
                    <span className="truncate text-[13px] font-medium">{actionLabel(action)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(credits / maxCredits) * 100}%`,
                        background: palette.categorical[i % palette.categorical.length],
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-sm font-semibold">{credits}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Counted from this app&apos;s own redeem calls — not a provider balance.</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[17px] font-bold">Activity log</h3>
          <span className="font-mono text-xs text-muted-foreground">{runs.length} runs · newest first</span>
        </div>

        {runs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No runs yet.</CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {runs.map((run) => {
              const isOpen = expanded.has(run.id);
              const runCredits = run.items.reduce((sum, item) => sum + (item.creditsUsed ?? 0), 0);
              const companies = groupByCompany(run.items);
              const reportsCount = companies.filter((c) => c.creditsafeCredits > 0).length;
              const cognismCredits = companies.reduce((sum, c) => sum + c.cognismCredits, 0);
              const metaParts = [`${run.companyCount} compan${run.companyCount === 1 ? "y" : "ies"}`];
              if (reportsCount > 0) metaParts.push(`${reportsCount} report${reportsCount === 1 ? "" : "s"}`);
              if (cognismCredits > 0) metaParts.push(`${cognismCredits} Cognism credit${cognismCredits === 1 ? "" : "s"}`);
              if (reportsCount === 0 && cognismCredits === 0) metaParts.push(run.status.replace(/_/g, " "));
              return (
                <Card key={run.id} className="gap-0 overflow-hidden py-0">
                  <button
                    onClick={() => toggle(run.id)}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/30"
                  >
                    <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{runTitle(run.run_type)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold">{runCredits} cr</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatDateTime(run.started_at)}</p>
                    </div>
                    <div className="w-[130px] shrink-0 text-right">
                      <p className="text-[11px] text-muted-foreground">run by</p>
                      <p className="text-[12.5px] font-medium text-foreground/80">{run.run_by ?? "—"}</p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/20 px-4 py-3 pl-[53px]">
                      {companies.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">No line items for this run.</p>
                      ) : (
                        <div>
                          <div className="grid grid-cols-[1.6fr_1fr_1fr_96px] gap-3 py-2 font-mono text-[9.5px] tracking-wide text-muted-foreground uppercase">
                            <span>Company</span>
                            <span>Creditsafe</span>
                            <span>Cognism</span>
                            <span>Result</span>
                          </div>
                          {companies.map((c) => (
                            <div
                              key={c.companyId}
                              className="grid grid-cols-[1.6fr_1fr_1fr_96px] items-center gap-3 border-t py-2"
                            >
                              <span className="truncate text-[13px] font-medium">{c.companyName}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {c.creditsafeCredits > 0 ? `${c.creditsafeCredits} cr` : "—"}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {c.cognismCredits > 0 ? `${c.cognismCredits} cr` : "—"}
                              </span>
                              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                                {c.skipped ? "Skipped" : "Redeemed"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
