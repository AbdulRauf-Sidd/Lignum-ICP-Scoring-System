"use client";

import * as React from "react";
import { AlertTriangle, Briefcase, RefreshCw, Star } from "lucide-react";
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
import { COMPANIES, ACCOUNTS } from "@/lib/mock/data";
import { ScoreRing } from "@/components/shared/score-display";
import { formatDate, formatUsdCompact, formatNumber } from "@/lib/format";
import type { AccountRecord, QualitativeRatings, TalentInsights } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TODAY = new Date("2026-08-12T12:00:00Z").getTime();
const DAY_MS = 1000 * 60 * 60 * 24;

const clientCompanies = COMPANIES.filter((c) => c.lifecycleStatus === "client");

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-destructive/10 text-destructive",
};

const RATING_LABELS: { key: keyof Omit<QualitativeRatings, "lastReviewedAt">; label: string }[] = [
  { key: "relationshipHealth", label: "Relationship health" },
  { key: "deliverySatisfaction", label: "Delivery satisfaction" },
  { key: "communication", label: "Communication" },
  { key: "valuePerceived", label: "Value perceived" },
  { key: "renewalLikelihood", label: "Renewal likelihood" },
];

export function AccountsWorkspace() {
  const [records, setRecords] = React.useState<Record<string, AccountRecord>>(() =>
    Object.fromEntries(ACCOUNTS.map((a) => [a.companyId, a])),
  );
  const [openId, setOpenId] = React.useState<string | null>(null);

  const openCompany = clientCompanies.find((c) => c.id === openId) ?? null;
  const openRecord = openId ? records[openId] : null;

  function updateRating(companyId: string, key: keyof Omit<QualitativeRatings, "lastReviewedAt">, value: number) {
    setRecords((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        qualitative: { ...prev[companyId].qualitative, [key]: value },
      },
    }));
  }

  function saveQualitative(companyId: string) {
    setRecords((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        qualitative: { ...prev[companyId].qualitative, lastReviewedAt: new Date().toISOString() },
      },
    }));
    toast.success("Qualitative ratings saved", { description: "Refresh reminder reset." });
  }

  function updateTalent(companyId: string, patch: Partial<TalentInsights>) {
    setRecords((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], talentInsights: { ...prev[companyId].talentInsights, ...patch } },
    }));
  }

  return (
    <div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Headcount</TableHead>
                  <TableHead>Health score</TableHead>
                  <TableHead>Last reviewed</TableHead>
                  <TableHead>Adverse events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientCompanies.map((c) => {
                  const record = records[c.id];
                  const daysSince = Math.round((TODAY - new Date(record.qualitative.lastReviewedAt).getTime()) / DAY_MS);
                  const needsRefresh = daysSince > 90;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.domain}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.sector}</TableCell>
                      <TableCell className="text-muted-foreground">{formatUsdCompact(c.revenueUsd)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatNumber(c.headcount)}</TableCell>
                      <TableCell>
                        <ScoreRing score={record.healthScore} size={36} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          {formatDate(record.qualitative.lastReviewedAt)}
                          {needsRefresh && (
                            <Badge variant="outline" className="gap-1 border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <RefreshCw className="size-3" /> Refresh due
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.adverseEvents.length > 0 ? (
                          <Badge variant="outline" className="gap-1 border-transparent bg-destructive/10 text-destructive">
                            <AlertTriangle className="size-3" /> {record.adverseEvents.length}
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
        </CardContent>
      </Card>

      <Sheet open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
          {openCompany && openRecord && (
            <div className="flex flex-col gap-6 p-6">
              <SheetHeader className="p-0">
                <SheetTitle>{openCompany.name}</SheetTitle>
                <SheetDescription>
                  {openCompany.sector} · {openCompany.subSector} · {openCompany.country}
                </SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <ScoreRing score={openRecord.healthScore} size={48} />
                <div>
                  <p className="text-sm font-medium">Account health score</p>
                  <p className="text-xs text-muted-foreground">Computed from monitoring, ratings and delivery signals.</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Adverse events feed</p>
                {openRecord.adverseEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No adverse events recorded.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {openRecord.adverseEvents.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{e.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(e.date)}</p>
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
                  <span className="text-xs text-muted-foreground">Reviewed {formatDate(openRecord.qualitative.lastReviewedAt)}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {RATING_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-normal">{label}</Label>
                      <Select
                        value={String(openRecord.qualitative[key])}
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
                <Button size="sm" className="mt-3" onClick={() => saveQualitative(openCompany.id)}>
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
                      value={openRecord.talentInsights.activeRoles}
                      onChange={(e) => updateTalent(openCompany.id, { activeRoles: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Placements YTD</Label>
                    <Input
                      type="number"
                      value={openRecord.talentInsights.placementsYtd}
                      onChange={(e) => updateTalent(openCompany.id, { placementsYtd: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Avg. time to fill (days)</Label>
                    <Input
                      type="number"
                      value={openRecord.talentInsights.avgTimeToFillDays}
                      onChange={(e) => updateTalent(openCompany.id, { avgTimeToFillDays: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea
                      value={openRecord.talentInsights.notes}
                      onChange={(e) => updateTalent(openCompany.id, { notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
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
