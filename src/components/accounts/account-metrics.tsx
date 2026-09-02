"use client";

import * as React from "react";
import { Banknote, Calculator, CheckCircle2, FileText, Loader2, MessagesSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getAccountMetrics, type AccountMetrics as AccountMetricsData } from "@/app/(dashboard)/accounts/actions";
import type { AccountHeader } from "@/lib/data/accounts";
import { cn } from "@/lib/utils";

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

export function AccountMetrics({
  companyId,
  header,
  lifetime,
}: {
  companyId: number;
  header: AccountHeader;
  lifetime: AccountMetricsData | null;
}) {
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

  // Price/CV and Price/Interview pair the account's lifetime revenue with
  // lifetime (not date-range-scoped) counts — mixing a static lifetime total
  // with a date-filtered count would make the price swing wildly just from
  // picking a narrower range, which isn't a real price change.
  const pricePerCv =
    header.totalRevenue !== null && lifetime && lifetime.totalCvs > 0 ? header.totalRevenue / lifetime.totalCvs : null;
  const pricePerInterview =
    header.totalRevenue !== null && lifetime && lifetime.firstInterviews > 0
      ? header.totalRevenue / lifetime.firstInterviews
      : null;

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
          value={formatCurrency(header.totalRevenue, header.revenueCurrencyCode ?? "USD")}
          hint="Lifetime — not scoped to the date range"
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
          value={formatCurrency(pricePerCv, header.revenueCurrencyCode ?? "USD")}
          hint="Lifetime revenue ÷ lifetime CVs"
          tone="indigo"
          icon={Calculator}
        />
        <MetricCard
          label="Price / interview"
          value={formatCurrency(pricePerInterview, header.revenueCurrencyCode ?? "USD")}
          hint="Lifetime revenue ÷ lifetime interviews"
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
