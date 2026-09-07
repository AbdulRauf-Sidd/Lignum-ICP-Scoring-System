"use client";

import * as React from "react";
import { Loader2, Star, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import {
  setQualitativeRating,
  markScorecardReviewed,
  updateTalentInsights,
  type TalentInsightsInput,
} from "@/app/(dashboard)/accounts/actions";
import {
  QUALITATIVE_METRICS,
  type QualitativeMetric,
  type QualitativeRating,
  type TalentInsights as TalentInsightsData,
} from "@/lib/data/accounts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const METRIC_LABELS: Record<QualitativeMetric, string> = {
  relationship_strength: "Relationship strength",
  delivery_satisfaction: "Delivery satisfaction",
  growth_potential: "Growth potential",
  payment_reliability: "Payment reliability",
  strategic_fit: "Strategic fit",
};

export function AccountScorecard({
  companyId,
  ratings,
  onRatingsChange,
}: {
  companyId: number;
  ratings: QualitativeRating[];
  onRatingsChange?: (ratings: QualitativeRating[]) => void;
}) {
  const [byMetric, setByMetric] = React.useState<Partial<Record<QualitativeMetric, QualitativeRating>>>(() =>
    Object.fromEntries(ratings.map((r) => [r.metric, r])),
  );
  const [savingMetric, setSavingMetric] = React.useState<QualitativeMetric | null>(null);
  const [markingReviewed, setMarkingReviewed] = React.useState(false);

  const rated = Object.values(byMetric).filter((r): r is QualitativeRating => !!r);
  // The oldest of the rated metrics — the whole card is only as "reviewed"
  // as its stalest dimension.
  const lastReviewed = rated.length ? rated.reduce((oldest, r) => (r.ratedAt < oldest ? r.ratedAt : oldest), rated[0].ratedAt) : null;

  async function rate(metric: QualitativeMetric, rating: number) {
    setSavingMetric(metric);
    try {
      await setQualitativeRating(companyId, metric, rating);
      const next = {
        ...byMetric,
        [metric]: { metric, rating, ratedBy: byMetric[metric]?.ratedBy ?? null, ratedAt: new Date().toISOString(), refreshDue: null },
      };
      setByMetric(next);
      // Account Health (in the parent header) is a pure client-side
      // calculation over these ratings — pushing the update up here is what
      // makes it recompute instantly instead of waiting for the next page load.
      onRatingsChange?.(Object.values(next).filter((r): r is QualitativeRating => !!r));
    } catch (err) {
      toast.error("Failed to save rating", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingMetric(null);
    }
  }

  async function markReviewed() {
    setMarkingReviewed(true);
    try {
      await markScorecardReviewed(companyId);
      const now = new Date().toISOString();
      const next = { ...byMetric };
      for (const metric of Object.keys(next) as QualitativeMetric[]) {
        const existing = next[metric];
        if (existing) next[metric] = { ...existing, ratedAt: now };
      }
      setByMetric(next);
      onRatingsChange?.(Object.values(next).filter((r): r is QualitativeRating => !!r));
      toast.success("Scorecard marked as reviewed");
    } catch (err) {
      toast.error("Failed to mark reviewed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setMarkingReviewed(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Star className="size-3.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Client scorecard</h3>
              <p className="text-xs text-muted-foreground">
                {lastReviewed ? `Last reviewed ${formatDate(lastReviewed)}` : "Not yet rated"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
            1-5
          </Badge>
        </div>

        <div className="flex flex-col divide-y">
          {QUALITATIVE_METRICS.map((metric) => {
            const current = byMetric[metric]?.rating ?? 0;
            const isSaving = savingMetric === metric;
            return (
              <div key={metric} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{METRIC_LABELS[metric]}</span>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={isSaving}
                        onClick={() => rate(metric, n)}
                        aria-label={`Rate ${METRIC_LABELS[metric]} ${n} out of 5`}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md text-xs font-medium transition-colors disabled:opacity-50",
                          n <= current
                            ? "bg-amber-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" className="mt-3 w-fit" onClick={markReviewed} disabled={markingReviewed || rated.length === 0}>
          {markingReviewed && <Loader2 className="size-3.5 animate-spin" />}
          Mark reviewed today
        </Button>
      </CardContent>
    </Card>
  );
}

const TALENT_FIELDS: { key: keyof TalentInsightsInput; label: string; suffix: string }[] = [
  { key: "headcountChange", label: "Headcount change (YoY)", suffix: "%" },
  { key: "attrition", label: "Attrition (annual)", suffix: "%" },
  { key: "avgTenure", label: "Average tenure", suffix: "yrs" },
];

export function AccountTalentInsights({
  companyId,
  insights,
  onInsightsChange,
}: {
  companyId: number;
  insights: TalentInsightsData | null;
  onInsightsChange?: (insights: TalentInsightsData) => void;
}) {
  const [data, setData] = React.useState({
    headcountChange: insights?.headcountChange ?? null,
    attrition: insights?.attrition ?? null,
    avgTenure: insights?.avgTenure ?? null,
    enteredBy: insights?.enteredBy ?? null,
    enteredAt: insights?.enteredAt ?? null,
  });
  const [drafts, setDrafts] = React.useState<Record<keyof TalentInsightsInput, string>>({
    headcountChange: data.headcountChange?.toString() ?? "",
    attrition: data.attrition?.toString() ?? "",
    avgTenure: data.avgTenure?.toString() ?? "",
  });
  const [saving, setSaving] = React.useState<keyof TalentInsightsInput | null>(null);

  async function save(key: keyof TalentInsightsInput, raw: string) {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && Number.isNaN(parsed)) {
      setDrafts((prev) => ({ ...prev, [key]: data[key]?.toString() ?? "" }));
      return;
    }
    if (parsed === data[key]) return;

    setSaving(key);
    try {
      const next = { headcountChange: data.headcountChange, attrition: data.attrition, avgTenure: data.avgTenure, [key]: parsed };
      await updateTalentInsights(companyId, next);
      const updated = { ...next, enteredBy: data.enteredBy, enteredAt: new Date().toISOString() };
      setData(updated);
      // Same reasoning as the scorecard — pushes the change up so Account
      // Health recomputes immediately instead of on the next page load.
      onInsightsChange?.(updated);
      toast.success("Talent insights updated");
    } catch (err) {
      toast.error("Failed to save talent insights", { description: err instanceof Error ? err.message : undefined });
      setDrafts((prev) => ({ ...prev, [key]: data[key]?.toString() ?? "" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Users2 className="size-3.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Talent insights</h3>
              <p className="text-xs text-muted-foreground">
                {data.enteredAt ? `Last entered ${formatDate(data.enteredAt)}${data.enteredBy ? ` by ${data.enteredBy}` : ""}` : "Not yet entered"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
            Manual
          </Badge>
        </div>

        <div className="flex flex-col divide-y">
          {TALENT_FIELDS.map(({ key, label, suffix }) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-1.5">
                {saving === key && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                <div className="flex items-center gap-1.5 rounded-md bg-muted pr-2.5 focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    type="number"
                    value={drafts[key]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={(e) => save(key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    disabled={saving === key}
                    className="h-8 w-16 border-none bg-transparent text-right tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                  <span className="text-xs text-muted-foreground">{suffix}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
