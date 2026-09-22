"use client";

import * as React from "react";
import { Banknote, Calculator, CheckCircle2, FileText, Loader2, MessagesSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UkDateInput } from "@/components/ui/uk-date-input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMultiCurrency, formatNumber } from "@/lib/format";
import { getAccountMetrics, type AccountMetrics as AccountMetricsData } from "@/app/(dashboard)/accounts/actions";
import { type DatePreset, DATE_PRESET_LABELS, datePresetRange, toDateInputValue } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

// `revenueGbp` is null when the exchange-rate feed is unreachable or one of
// the currencies in the mix isn't in it — falls back to the honest per-
// currency breakdown rather than showing a wrong or missing number.
function formatRevenue(metrics: AccountMetricsData): string {
  return metrics.revenueGbp !== null ? formatCurrency(metrics.revenueGbp, "GBP", 0) : formatMultiCurrency(metrics.revenue, 0);
}

// This dataset's real rows only ever go back a handful of years — early
// enough to include everything without needing an actual "no lower bound"
// query mode, which getAccountMetrics doesn't have.
const EPOCH = "1970-01-01";

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

export function AccountMetrics({
  companyId,
  preset,
  onPresetChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
}: {
  companyId: number;
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customStart: string;
  onCustomStartChange: (value: string) => void;
  customEnd: string;
  onCustomEndChange: (value: string) => void;
}) {
  const [metrics, setMetrics] = React.useState<AccountMetricsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const range = datePresetRange(preset, customStart, customEnd);
  // "All time" (and an not-yet-filled-in custom bound) has no real lower/upper
  // limit — getAccountMetrics needs concrete dates, so an open end falls back
  // to the widest possible window instead.
  const rangeStart = range.start ?? EPOCH;
  const rangeEnd = range.end ?? toDateInputValue(new Date());

  React.useEffect(() => {
    let cancelled = false;
    // End date is a plain day (YYYY-MM-DD) — push it to the end of that day so
    // the range is inclusive of everything that happened on it.
    const startIso = new Date(`${rangeStart}T00:00:00.000Z`).toISOString();
    const endIso = new Date(`${rangeEnd}T23:59:59.999Z`).toISOString();
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
  }, [companyId, rangeStart, rangeEnd]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={(v) => onPresetChange(v as DatePreset)}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESET_LABELS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <UkDateInput value={customStart} onChange={onCustomStartChange} className="w-32 bg-card" />
            <span className="text-sm text-muted-foreground">to</span>
            <UkDateInput value={customEnd} onChange={onCustomEndChange} className="w-32 bg-card" />
          </>
        )}
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Total revenue"
          value={metrics ? formatRevenue(metrics) : "—"}
          hint={
            metrics && metrics.revenueGbp !== null && metrics.revenue.length > 0
              ? `Converted from ${formatMultiCurrency(metrics.revenue, 0)} at ${metrics.revenueRatesLive ? "today's" : "approximate (offline)"} rates`
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
          label="Revenue per CV"
          value={metrics ? formatCurrency(metrics.cvCost, "GBP", 0) : "—"}
          hint="Total revenue ÷ total CVs, this date range"
          tone="indigo"
          icon={Calculator}
        />
        <MetricCard
          label="Revenue per interview"
          value={metrics ? formatCurrency(metrics.interviewCost, "GBP", 0) : "—"}
          hint="Total revenue ÷ first interviews, this date range"
          tone="teal"
          icon={Calculator}
        />
        <MetricCard
          label="Recruiter cost"
          value={metrics ? formatCurrency(metrics.recruiterCost, "GBP", 0) : "—"}
          hint="Total CVs × CV cost (Model config)"
          tone="sky"
          icon={FileText}
        />
        <MetricCard
          label="Account management cost"
          value={metrics ? formatCurrency(metrics.accountManagementCost, "GBP", 0) : "—"}
          hint={`${metrics ? formatNumber(metrics.totalJobs) : "—"} jobs added × interview cost (Model config)`}
          tone="amber"
          icon={Calculator}
        />
        <MetricCard
          label="Business cost"
          value={metrics ? formatCurrency(metrics.businessCost, "GBP", 0) : "—"}
          hint="Recruiter cost + account management cost"
          tone="violet"
          icon={Banknote}
        />
      </div>
      <Badge variant="outline" className="w-fit border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
        CVs / interviews / placements counted once per candidate, per activity
      </Badge>
    </div>
  );
}
