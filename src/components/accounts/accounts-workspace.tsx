"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Briefcase, Loader2, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TierBadge, SectorBadge } from "@/components/shared/badges";
import { formatDate } from "@/lib/format";
import type { AccountsData } from "@/lib/data/accounts";
import { saveQualitativeRatings, saveTalentInsights } from "@/app/(dashboard)/accounts/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-destructive/10 text-destructive",
};

const RATING_FIELDS = [
  { key: "relationshipHealth", label: "Relationship health" },
  { key: "deliverySatisfaction", label: "Delivery satisfaction" },
  { key: "communication", label: "Communication" },
  { key: "valuePerceived", label: "Value perceived" },
  { key: "renewalLikelihood", label: "Renewal likelihood" },
] as const;

type RatingKey = (typeof RATING_FIELDS)[number]["key"];

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

function Avatar({ id, name, className }: { id: string; name: string; className?: string }) {
  const style = AVATAR_STYLES[hashIndex(id, AVATAR_STYLES.length)];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md font-bold", style, className)}>
      {initials(name)}
    </span>
  );
}

function healthMeta(score: number | null): { label: string; badge: string; bar: string } {
  if (score === null) return { label: "Unknown", badge: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" };
  if (score >= 75) return { label: "Healthy", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 50) return { label: "Watch", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { label: "At risk", badge: "bg-destructive/10 text-destructive", bar: "bg-destructive" };
}

function RatingBar({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
            n <= value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function AccountsWorkspace({ data }: { data: AccountsData }) {
  const router = useRouter();
  const { companies, records, adverseEvents } = data;
  const [activeId, setActiveId] = React.useState<string | null>(companies[0]?.id ?? null);
  const [savingQualitative, setSavingQualitative] = React.useState(false);
  const [savingTalent, setSavingTalent] = React.useState(false);

  const [ratingDrafts, setRatingDrafts] = React.useState<Record<string, Record<RatingKey, number>>>(() =>
    Object.fromEntries(
      companies.map((c) => {
        const r = records[c.id];
        return [
          c.id,
          {
            relationshipHealth: r?.relationship_health ?? 3,
            deliverySatisfaction: r?.delivery_satisfaction ?? 3,
            communication: r?.communication ?? 3,
            valuePerceived: r?.value_perceived ?? 3,
            renewalLikelihood: r?.renewal_likelihood ?? 3,
          },
        ];
      }),
    ),
  );

  const [talentDrafts, setTalentDrafts] = React.useState<
    Record<string, { activeRoles: number; placementsYtd: number; avgTimeToFillDays: number; notes: string }>
  >(() =>
    Object.fromEntries(
      companies.map((c) => {
        const r = records[c.id];
        return [
          c.id,
          {
            activeRoles: r?.active_roles ?? 0,
            placementsYtd: r?.placements_ytd ?? 0,
            avgTimeToFillDays: r?.avg_time_to_fill_days ?? 0,
            notes: r?.talent_notes ?? "",
          },
        ];
      }),
    ),
  );

  const active = companies.find((c) => c.id === activeId) ?? null;
  const activeRecord = activeId ? records[activeId] : null;
  const activeEvents = activeId ? (adverseEvents[activeId] ?? []) : [];

  function updateRating(companyId: string, key: RatingKey, value: number) {
    setRatingDrafts((prev) => ({ ...prev, [companyId]: { ...prev[companyId], [key]: value } }));
  }

  async function handleSaveQualitative(companyId: string) {
    setSavingQualitative(true);
    try {
      await saveQualitativeRatings(companyId, ratingDrafts[companyId]);
      toast.success("Marked reviewed today");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save ratings", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingQualitative(false);
    }
  }

  function updateTalent(companyId: string, patch: Partial<(typeof talentDrafts)[string]>) {
    setTalentDrafts((prev) => ({ ...prev, [companyId]: { ...prev[companyId], ...patch } }));
  }

  async function handleSaveTalent(companyId: string) {
    setSavingTalent(true);
    try {
      await saveTalentInsights(companyId, talentDrafts[companyId]);
      toast.success("Talent Insights saved");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save Talent Insights", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingTalent(false);
    }
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No client accounts yet — companies show up here once their lifecycle status moves to &quot;client&quot;.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        {companies.map((c) => {
          const record = records[c.id];
          const meta = healthMeta(record?.health_score ?? null);
          const isActive = activeId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                isActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <Avatar id={c.id} name={c.name} className="size-7 text-[11px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className={cn("size-1.5 shrink-0 rounded-full", meta.bar)} />
                  {record?.health_score ?? "—"} · {meta.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="flex flex-col gap-6">
          {(() => {
            const meta = healthMeta(activeRecord?.health_score ?? null);
            const draft = ratingDrafts[active.id];
            const qualAvg = draft ? (Object.values(draft).reduce((a, b) => a + b, 0) / RATING_FIELDS.length).toFixed(1) : "—";
            return (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar id={active.id} name={active.name} className="size-14 text-lg" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{active.name}</h2>
                        <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                          Client
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">{active.domain}</span>
                        <SectorBadge sector={active.sector} />
                        {active.subSector && <span className="text-xs text-muted-foreground">{active.subSector}</span>}
                        <TierBadge tier={active.tier} />
                        <span className="text-xs text-muted-foreground">
                          ICP {active.score !== null ? Math.round(active.score) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Account health</p>
                      <Badge variant="outline" className={cn("border-transparent", meta.badge)}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-semibold tabular-nums">{activeRecord?.health_score ?? "—"}</span>
                      <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", meta.bar)}
                          style={{ width: `${activeRecord?.health_score ?? 0}%` }}
                        />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Qual {qualAvg}/5 · Adverse {activeEvents.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Firmographics · from enrichment</p>
              <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
                Not yet wired
              </Badge>
            </div>
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {["Revenue", "Headcount", "Sites", "HQ", "Founded", "Credit", "Risk", "Ownership"].map((label) => (
                    <div key={label}>
                      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">—</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <Star className="size-4" /> Client scorecard
                  </CardTitle>
                  <CardDescription>
                    {activeRecord?.qualitative_reviewed_at
                      ? `Ratings last reviewed ${formatDate(activeRecord.qualitative_reviewed_at)}`
                      : "Not yet reviewed"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
                  Manual · 1-5
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {RATING_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">{label}</Label>
                    <RatingBar
                      value={ratingDrafts[active.id][key]}
                      onChange={(n) => updateRating(active.id, key, n)}
                      disabled={savingQualitative}
                    />
                  </div>
                ))}
                <Button size="sm" className="w-fit" onClick={() => handleSaveQualitative(active.id)} disabled={savingQualitative}>
                  {savingQualitative && <Loader2 className="size-4 animate-spin" />}
                  Mark reviewed today
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <CardTitle className="flex items-center gap-1.5">
                  <Briefcase className="size-4" /> Talent Insights
                </CardTitle>
                <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
                  Manual entry
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">Active roles</Label>
                    <Input
                      type="number"
                      className="w-24 text-right"
                      value={talentDrafts[active.id].activeRoles}
                      onChange={(e) => updateTalent(active.id, { activeRoles: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">Placements YTD</Label>
                    <Input
                      type="number"
                      className="w-24 text-right"
                      value={talentDrafts[active.id].placementsYtd}
                      onChange={(e) => updateTalent(active.id, { placementsYtd: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">Avg. time to fill</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 text-right"
                        value={talentDrafts[active.id].avgTimeToFillDays}
                        onChange={(e) => updateTalent(active.id, { avgTimeToFillDays: Number(e.target.value) })}
                      />
                      <span className="w-8 text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    value={talentDrafts[active.id].notes}
                    onChange={(e) => updateTalent(active.id, { notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button size="sm" className="w-fit" onClick={() => handleSaveTalent(active.id)} disabled={savingTalent}>
                  {savingTalent && <Loader2 className="size-4 animate-spin" />}
                  Save Talent Insights
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <CardTitle>Adverse events</CardTitle>
              <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
                Creditsafe + Cognism
              </Badge>
            </CardHeader>
            <CardContent>
              {activeEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No adverse events recorded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeEvents.map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{e.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(e.event_date)}
                            {e.description ? ` · ${e.description}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 border-transparent capitalize", SEVERITY_STYLES[e.severity])}>
                        {e.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BarChart3 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Delivery efficiency · from CRM</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Placement volume, time-to-fill, fill rate and margin — sourced from Loxo. Not yet connected.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
              Not yet wired
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
