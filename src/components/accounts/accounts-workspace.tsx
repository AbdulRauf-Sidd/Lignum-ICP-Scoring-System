"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Briefcase, Loader2, RefreshCw, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreRing } from "@/components/shared/score-display";
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

export function AccountsWorkspace({ data, now }: { data: AccountsData; now: string }) {
  const router = useRouter();
  const nowMs = new Date(now).getTime();
  const { companies, records, adverseEvents } = data;
  const [openId, setOpenId] = React.useState<string | null>(null);
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

  const openCompany = companies.find((c) => c.id === openId) ?? null;
  const openRecord = openId ? records[openId] : null;
  const openEvents = openId ? (adverseEvents[openId] ?? []) : [];

  function updateRating(companyId: string, key: RatingKey, value: number) {
    setRatingDrafts((prev) => ({ ...prev, [companyId]: { ...prev[companyId], [key]: value } }));
  }

  async function handleSaveQualitative(companyId: string) {
    setSavingQualitative(true);
    try {
      await saveQualitativeRatings(companyId, ratingDrafts[companyId]);
      toast.success("Qualitative ratings saved", { description: "Refresh reminder reset." });
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

  return (
    <div>
      <Card>
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No client accounts yet — companies show up here once their lifecycle status moves to &quot;client&quot;.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Health score</TableHead>
                    <TableHead>Last reviewed</TableHead>
                    <TableHead>Adverse events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => {
                    const record = records[c.id];
                    const events = adverseEvents[c.id] ?? [];
                    const reviewedAt = record?.qualitative_reviewed_at ?? null;
                    const daysSince = reviewedAt ? Math.round((nowMs - new Date(reviewedAt).getTime()) / 86_400_000) : null;
                    const needsRefresh = daysSince === null || daysSince > 90;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                        <TableCell>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.domain}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.sector || "—"}</TableCell>
                        <TableCell>
                          <ScoreRing score={record?.health_score ?? null} size={36} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            {reviewedAt ? formatDate(reviewedAt) : "Not yet reviewed"}
                            {needsRefresh && (
                              <Badge variant="outline" className="gap-1 border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <RefreshCw className="size-3" /> Refresh due
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {events.length > 0 ? (
                            <Badge variant="outline" className="gap-1 border-transparent bg-destructive/10 text-destructive">
                              <AlertTriangle className="size-3" /> {events.length}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
          {openCompany && (
            <div className="flex flex-col gap-6 p-6">
              <SheetHeader className="p-0">
                <SheetTitle>{openCompany.name}</SheetTitle>
                <SheetDescription>
                  {openCompany.sector || "Not classified"}
                  {openCompany.subSector ? ` · ${openCompany.subSector}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <ScoreRing score={openRecord?.health_score ?? null} size={48} />
                <div>
                  <p className="text-sm font-medium">Account health score</p>
                  <p className="text-xs text-muted-foreground">Not set yet — computed from monitoring, ratings and delivery signals once available.</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Adverse events feed</p>
                {openEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No adverse events recorded.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {openEvents.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{e.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(e.event_date)}</p>
                        </div>
                        <Badge variant="outline" className={cn("border-transparent capitalize", SEVERITY_STYLES[e.severity])}>
                          {e.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Star className="size-4" /> Qualitative ratings
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {openRecord?.qualitative_reviewed_at ? `Reviewed ${formatDate(openRecord.qualitative_reviewed_at)}` : "Not yet reviewed"}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {RATING_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-normal">{label}</Label>
                      <Select
                        value={String(ratingDrafts[openCompany.id][key])}
                        onValueChange={(v) => updateRating(openCompany.id, key, Number(v))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <Button size="sm" className="mt-3" onClick={() => handleSaveQualitative(openCompany.id)} disabled={savingQualitative}>
                  {savingQualitative && <Loader2 className="size-4 animate-spin" />}
                  Save ratings
                </Button>
              </div>

              <Separator />

              <div>
                <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
                  <Briefcase className="size-4" /> Talent Insights (manual)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Active roles</Label>
                    <Input
                      type="number"
                      value={talentDrafts[openCompany.id].activeRoles}
                      onChange={(e) => updateTalent(openCompany.id, { activeRoles: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Placements YTD</Label>
                    <Input
                      type="number"
                      value={talentDrafts[openCompany.id].placementsYtd}
                      onChange={(e) => updateTalent(openCompany.id, { placementsYtd: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Avg. time to fill (days)</Label>
                    <Input
                      type="number"
                      value={talentDrafts[openCompany.id].avgTimeToFillDays}
                      onChange={(e) => updateTalent(openCompany.id, { avgTimeToFillDays: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea
                      value={talentDrafts[openCompany.id].notes}
                      onChange={(e) => updateTalent(openCompany.id, { notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <Button size="sm" className="mt-3" onClick={() => handleSaveTalent(openCompany.id)} disabled={savingTalent}>
                  {savingTalent && <Loader2 className="size-4 animate-spin" />}
                  Save Talent Insights
                </Button>
              </div>

              <Separator />

              <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">CRM delivery metrics</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Not yet connected. Live Loxo delivery metrics (candidate stage, placement fee, dates) land in
                  this panel in a later phase.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
