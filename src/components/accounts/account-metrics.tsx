"use client";

import * as React from "react";
import { Banknote, Calculator, CheckCircle2, FileText, Loader2, MessagesSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMultiCurrency, formatNumber } from "@/lib/format";
import { getAccountMetrics, type AccountMetrics as AccountMetricsData } from "@/app/(dashboard)/accounts/actions";
import { cn } from "@/lib/utils";

// `revenueUsd` is null when the exchange-rate feed is unreachable or one of
// the currencies in the mix isn't in it — falls back to the honest per-
// currency breakdown rather than showing a wrong or missing number.
function formatRevenue(metrics: AccountMetricsData): string {
  return metrics.revenueUsd !== null ? formatCurrency(metrics.revenueUsd, "USD") : formatMultiCurrency(metrics.revenue);
}

type Preset = "7d" | "30d" | "quarter" | "custom";

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { start: string; end: string } {
  const now = new Date();
  const end = now;
  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start: toDateInputValue(start), end: toDateInputValue(end) };
  }
  if (preset === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { start: toDateInputValue(start), end: toDateInputValue(end) };
  }
  // "quarter"
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

const TONES = {
  emerald: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", value: "text-emerald-600 dark:text-emerald-400" },
  sky: { icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400", value: "text-sky-600 dark:text-sky-400" },
  amber: { icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", value: "text-amber-600 dark:text-amber-400" },
  violet: { icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", value: "text-violet-600 dark:text-violet-400" },
  indigo: { icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", value: "text-indigo-600 dark:text-indigo-400" },
  teal: { icon: "bg-teal-500/10 text-teal-600 dark:text-teal-400", value: "text-teal-600 dark:text-teal-400" },
} as const;

type Tone = keyof typeof TONES;

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", t.icon)}>
          <Icon className="size-3.5" />
        </span>
        <p className={cn("text-2xl leading-none font-semibold", t.value)}>{value}</p>
      </div>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AccountMetrics({ companyId }: { companyId: number }) {
  const [preset, setPreset] = React.useState<Preset>("30d");
  const [customStart, setCustomStart] = React.useState(() => presetRange("30d").start);
  const [customEnd, setCustomEnd] = React.useState(() => presetRange("30d").end);
  const [metrics, setMetrics] = React.useState<AccountMetricsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const range = preset === "custom" ? { start: customStart, end: customEnd } : presetRange(preset);

  React.useEffect(() => {
    let cancelled = false;
    // End date is a plain day (YYYY-MM-DD) — push it to the end of that day so
    // the range is inclusive of everything that happened on it.
    const startIso = new Date(`${range.start}T00:00:00.000Z`).toISOString();
    const endIso = new Date(`${range.end}T23:59:59.999Z`).toISOString();
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return getAccountMetrics(companyId, startIso, endIso);
      })
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.start, range.end]);

  // Same USD revenue and counts as the cards above, both scoped to the
  // selected date range — so the price moves only when the underlying
  // activity does, not from switching between a lifetime figure and a
  // windowed one. Converting first then dividing (rather than dividing each
  // currency bucket and converting after) gives the same result but only
  // needs the one already-converted total.
  const pricePerCv =
    metrics && metrics.revenueUsd !== null && metrics.totalCvs > 0 ? metrics.revenueUsd / metrics.totalCvs : null;
  const pricePerInterview =
    metrics && metrics.revenueUsd !== null && metrics.firstInterviews > 0 ? metrics.revenueUsd / metrics.firstInterviews : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="quarter">This quarter</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-40 bg-card"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40 bg-card" />
          </>
        )}
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total revenue"
          value={metrics ? formatRevenue(metrics) : "—"}
          hint={
            metrics && metrics.revenueUsd !== null && metrics.revenue.length > 0
              ? `Converted from ${formatMultiCurrency(metrics.revenue)} at ${metrics.revenueRatesLive ? "today's" : "approximate (offline)"} rates`
              : "From placements in this date range"
          }
          tone="emerald"
          icon={Banknote}
        />
        <MetricCard label="Total CVs" value={metrics ? formatNumber(metrics.totalCvs) : "—"} tone="sky" icon={FileText} />
        <MetricCard
          label="First interviews"
          value={metrics ? formatNumber(metrics.firstInterviews) : "—"}
          tone="amber"
          icon={MessagesSquare}
        />
        <MetricCard
          label="Total placements"
          value={metrics ? formatNumber(metrics.totalPlacements) : "—"}
          tone="violet"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Price / CV"
          value={formatCurrency(pricePerCv, "USD")}
          hint="Revenue ÷ CVs, this date range"
          tone="indigo"
          icon={Calculator}
        />
        <MetricCard
          label="Price / interview"
          value={formatCurrency(pricePerInterview, "USD")}
          hint="Revenue ÷ interviews, this date range"
          tone="teal"
          icon={Calculator}
        />
      </div>
      <Badge variant="outline" className="w-fit border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
        CVs / interviews / placements counted once per candidate, per activity
      </Badge>
    </div>
  );
}
