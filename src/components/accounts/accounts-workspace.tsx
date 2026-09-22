"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, LoaderCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountsList } from "@/components/accounts/accounts-list";
import { AccountMetrics } from "@/components/accounts/account-metrics";
import { AccountJobsTable } from "@/components/accounts/account-jobs-table";
import { AccountScorecard, AccountTalentInsights } from "@/components/accounts/account-insights";
import { AccountFirmographics } from "@/components/accounts/account-firmographics";
import { statusMeta } from "@/components/accounts/status-meta";
import { formatDateTime } from "@/lib/format";
import { computeAccountHealth, type HealthBand } from "@/lib/account-health";
import type { Company } from "@/lib/types";
import type { ContactRow } from "@/lib/data/contacts";
import type { AccountListItem, AccountHeader, AccountJob, QualitativeRatings, TalentInsights, HealthWeights, AccountFirmographics as AccountFirmographicsData } from "@/lib/data/accounts";
import { type DatePreset, datePresetRange } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

const HEALTH_BAND_META: Record<HealthBand, { label: string; badge: string; bar: string }> = {
  healthy: { label: "Healthy", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  watch: { label: "Watch", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  at_risk: { label: "At risk", badge: "bg-red-500/10 text-red-600 dark:text-red-400", bar: "bg-red-500" },
};

export function AccountsWorkspace({
  accounts,
  initialSearch,
  initialDate,
  selectedCompanyId,
  header,
  jobs,
  qualitative,
  talentInsights,
  healthWeights,
  firmographics,
  enrichmentCompany,
  enrichmentContacts,
}: {
  accounts: AccountListItem[];
  initialSearch: string;
  initialDate: { preset: DatePreset; customStart: string; customEnd: string };
  selectedCompanyId: number | null;
  header: AccountHeader | null;
  jobs: AccountJob[];
  qualitative: QualitativeRatings;
  talentInsights: TalentInsights;
  healthWeights: HealthWeights;
  firmographics: AccountFirmographicsData | null;
  enrichmentCompany: Company | null;
  enrichmentContacts: ContactRow[];
}) {
  const [navigating, setNavigating] = React.useState(false);

  // `header` is a fresh object every time the server actually sends new data
  // for this URL — unlike useTransition's isPending, which this app already
  // found resolves before the destination page's data has finished loading,
  // this only clears once the real content has arrived. Adjusted during
  // render (not an effect) so there's no extra visible frame.
  const [prevHeader, setPrevHeader] = React.useState(header);
  if (header !== prevHeader) {
    setPrevHeader(header);
    setNavigating(false);
  }

  return (
    <div className="relative">
      {navigating && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-24 backdrop-blur-[1px]">
          <LoaderCircle className="size-8 animate-spin text-primary" aria-label="Loading" role="status" />
        </div>
      )}
      <div className={cn(navigating && "pointer-events-none opacity-40 transition-opacity")}>
        {!selectedCompanyId || !header ? (
          <AccountsList
            accounts={accounts}
            initialSearch={initialSearch}
            initialDate={initialDate}
            onNavigate={() => setNavigating(true)}
          />
        ) : (
          <AccountDetail
            key={header.companyId}
            header={header}
            jobs={jobs}
            qualitative={qualitative}
            talentInsights={talentInsights}
            healthWeights={healthWeights}
            firmographics={firmographics}
            enrichmentCompany={enrichmentCompany}
            enrichmentContacts={enrichmentContacts}
            onNavigate={() => setNavigating(true)}
          />
        )}
      </div>
    </div>
  );
}

function AccountDetail({
  header,
  jobs,
  qualitative,
  talentInsights,
  healthWeights,
  firmographics,
  enrichmentCompany,
  enrichmentContacts,
  onNavigate,
}: {
  header: AccountHeader;
  jobs: AccountJob[];
  qualitative: QualitativeRatings;
  talentInsights: TalentInsights;
  healthWeights: HealthWeights;
  firmographics: AccountFirmographicsData | null;
  enrichmentCompany: Company | null;
  enrichmentContacts: ContactRow[];
  onNavigate: () => void;
}) {
  const meta = statusMeta(header.status);

  // Owned here (rather than left inside AccountScorecard/AccountTalentInsights)
  // so a rating or talent-insight edit can update Account Health immediately —
  // it's a pure client-side calculation, so there's no reason it should wait
  // for a page reload to see a change made two components down.
  const [qualitativeState, setQualitativeState] = React.useState(qualitative);
  const [talentInsightsState, setTalentInsightsState] = React.useState(talentInsights);
  const health = computeAccountHealth(qualitativeState, talentInsightsState, healthWeights);
  const bandMeta = HEALTH_BAND_META[health.band];

  // Shared with AccountJobsTable below, so the same date range that scopes
  // the metric cards also scopes which jobs are listed — one selector for
  // the whole account view rather than two that could disagree.
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all_time");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const dateRange = datePresetRange(datePreset, customStart, customEnd);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground" asChild>
        <Link href="/accounts" onClick={onNavigate}>
          <ArrowLeft /> Back to accounts
        </Link>
      </Button>

      <div className="flex flex-col gap-6">
        <Card className={cn("border-l-4", meta.border)}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{header.companyName}</h2>
                <Badge variant="outline" className={cn("border-transparent", meta.badge)}>
                  Current Client
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {header.companyUrl ? (
                  <a
                    href={header.companyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:underline"
                  >
                    {header.companyUrl.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span>No URL on file</span>
                )}
                <span>Owner: {header.ownedBy ?? "Unassigned"}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Account health</span>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none font-semibold tabular-nums">{health.score}</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", bandMeta.bar)} style={{ width: `${health.score}%` }} />
                </div>
                <Badge variant="outline" className={cn("border-transparent", bandMeta.badge)}>
                  {bandMeta.label}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Qual {health.qualAvg.toFixed(1)}/5 · Talent {health.talentScore} · Adverse -{health.adversePenalty}
              </span>
              {health.isBaseline && (
                <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground">
                  Not yet rated
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">Updated {formatDateTime(header.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <AccountFirmographics data={firmographics} company={enrichmentCompany} contacts={enrichmentContacts} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AccountScorecard companyId={header.companyId} ratings={qualitativeState} onRatingsChange={setQualitativeState} />
          <AccountTalentInsights companyId={header.companyId} insights={talentInsightsState} onInsightsChange={setTalentInsightsState} />
        </div>

        <AccountMetrics
          companyId={header.companyId}
          preset={datePreset}
          onPresetChange={setDatePreset}
          customStart={customStart}
          onCustomStartChange={setCustomStart}
          customEnd={customEnd}
          onCustomEndChange={setCustomEnd}
        />

        <AccountJobsTable jobs={jobs} companyId={header.companyId} rangeStart={dateRange.start} rangeEnd={dateRange.end} />
      </div>
    </div>
  );
}
