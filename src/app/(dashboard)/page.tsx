import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TriageReasonBadge } from "@/components/shared/badges";
import {
  getTriageCount,
  getFailedCompanies,
  getNoMatchCompanies,
  getLowConfidenceCompanies,
} from "@/lib/data/companies";
import { getMidLowEmailQualityContacts } from "@/lib/data/contacts";
import { getSectorPerformance } from "@/lib/data/analytics";
import { getRecentUsageRuns } from "@/lib/data/usage";
import { formatDateHeading, formatDateTime } from "@/lib/format";
import { getSessionUser } from "@/lib/supabase/auth-server";
import { cn } from "@/lib/utils";
import type { CompanyStatus, TriageReason } from "@/lib/types";

// Everything here changes as n8n runs and as the team works — never freeze it.
export const dynamic = "force-dynamic";

type AttentionType = "failed" | "no_match" | "low_confidence" | "email_quality";

interface AttentionItem {
  type: AttentionType;
  title: string;
  detail: string;
  cta: string;
  href: string;
  triageReason?: TriageReason;
}

const ATTENTION_META: Record<AttentionType, { label: string; dot: string; chip: string; value: string }> = {
  failed: {
    label: "Failure",
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
  no_match: {
    label: "No match",
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
  low_confidence: {
    label: "Low confidence",
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  email_quality: {
    label: "Email quality",
    dot: "bg-sky-500",
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    value: "text-sky-600 dark:text-sky-400",
  },
};

function openHref(id: string, status: CompanyStatus) {
  return status === "triage" ? "/triage" : `/target-list/${id}`;
}

function openCta(status: CompanyStatus) {
  return status === "triage" ? "Review in triage" : "Open account";
}

function failureDetail(name: string, triageReason: TriageReason, lastError: string | null): string {
  switch (triageReason) {
    case "insufficient_data":
      return `${name} — not enough public data to enrich.`;
    case "no_icp_profile":
      return `${name} — classified into a sector with no matching ICP profile configured.`;
    case "processing_error":
      return `${name} — ${lastError ?? "enrichment failed with an unknown error."}`;
    default:
      return `${name} — enrichment could not complete.`;
  }
}

export default async function HomePage() {
  const [user, triageCount, failed, noMatch, lowConfidence, emailQuality, sectorPerf, recentRuns] = await Promise.all([
    getSessionUser(),
    getTriageCount(),
    getFailedCompanies(),
    getNoMatchCompanies(),
    getLowConfidenceCompanies(),
    getMidLowEmailQualityContacts(),
    getSectorPerformance(),
    getRecentUsageRuns(1),
  ]);

  const firstName = (user?.name ?? "there").split(" ")[0];
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const items: AttentionItem[] = [
    ...failed.items.map((c) => ({
      type: "failed" as const,
      title: "Enrichment failed",
      detail: failureDetail(c.name, c.triageReason, c.lastError),
      cta: "Retry in queue",
      href: "/import",
      triageReason: c.triageReason,
    })),
    ...noMatch.items.map((c) => ({
      type: "no_match" as const,
      title: "No ICP match",
      detail: `${c.name} — did not match its assigned ICP.`,
      cta: openCta(c.status),
      href: openHref(c.id, c.status),
    })),
    ...lowConfidence.items.map((c) => ({
      type: "low_confidence" as const,
      title: "Low data confidence",
      detail: `${c.name} — scored at ${c.confidence}% data confidence.`,
      cta: openCta(c.status),
      href: openHref(c.id, c.status),
    })),
    ...emailQuality.groups.map((g) => ({
      type: "email_quality" as const,
      title: "Mid / low email quality",
      detail: `${g.count} contact${g.count === 1 ? "" : "s"} at ${g.companyName} returned a low or medium quality email.`,
      cta: "Open contacts",
      href: `/contacts?company=${g.companyId}`,
    })),
  ];

  const attentionCounts = {
    failed: failed.count,
    no_match: noMatch.count,
    low_confidence: lowConfidence.count,
    email_quality: emailQuality.groups.length,
  };
  const totalAttention = attentionCounts.failed + attentionCounts.no_match + attentionCounts.low_confidence + attentionCounts.email_quality;
  const topItems = items.slice(0, 5);

  const summary =
    totalAttention > 0
      ? `${totalAttention} item${totalAttention === 1 ? "" : "s"} need attention${triageCount > 0 ? `, ${triageCount} awaiting triage` : ""}.`
      : triageCount > 0
        ? `${triageCount} compan${triageCount === 1 ? "y" : "ies"} awaiting triage.`
        : "Everything looks healthy — no open flags.";

  const pushRecs = sectorPerf
    .map((s) => {
      if (s.scoredCount === 0) {
        return { tag: "Empty", tone: "danger" as const, title: s.sector, detail: "No companies scored yet. Import more to build coverage.", cta: "Add companies", href: "/import" };
      }
      if (s.scoredCount < 4) {
        return {
          tag: "Thin",
          tone: "warn" as const,
          title: s.sector,
          detail: `Only ${s.scoredCount} compan${s.scoredCount === 1 ? "y" : "ies"} scored. Import more to build coverage.`,
          cta: "Add companies",
          href: "/import",
        };
      }
      if (s.avgScore !== null && s.avgScore < 78) {
        return {
          tag: "Low avg",
          tone: "warn" as const,
          title: s.sector,
          detail: `Averaging ${s.avgScore}/100 across ${s.scoredCount} companies.`,
          cta: "View target list",
          href: "/target-list",
        };
      }
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 4);

  const lastRun = recentRuns[0] ?? null;

  return (
    <div>
      <PageHeader title="Insights" description="Your do-this-next summary, generated from the latest data" />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{formatDateHeading(now)}</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {greeting}, {firstName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
          </div>
          {triageCount > 0 && (
            <Button size="lg" asChild>
              <Link href="/triage">
                <ArrowRight /> Review {triageCount} account{triageCount === 1 ? "" : "s"} in triage
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["failed", "no_match", "low_confidence", "email_quality"] as const).map((type) => {
                const count = attentionCounts[type];
                const meta = ATTENTION_META[type];
                return (
                  <div key={type} className="rounded-lg border px-3 py-2.5">
                    <p className={cn("text-2xl font-semibold leading-none", count > 0 ? meta.value : "text-muted-foreground")}>
                      {count}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{meta.label}</p>
                  </div>
                );
              })}
            </div>

            {topItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing needs attention right now.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {topItems.map((item, i) => {
                  const meta = ATTENTION_META[item.type];
                  return (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.triageReason ? (
                            <TriageReasonBadge reason={item.triageReason} />
                          ) : (
                            <Badge variant="outline" className={cn("border-transparent text-[10px]", meta.chip)}>
                              {meta.label}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0" asChild>
                        <Link href={item.href}>{item.cta}</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {triageCount > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="h-8 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-semibold">Triage waiting</p>
                    <p className="text-xs text-muted-foreground">
                      {triageCount} compan{triageCount === 1 ? "y" : "ies"} awaiting review before scoring
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/triage">Review triage</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardDescription className="text-[11px] font-medium tracking-wider uppercase">Last run</CardDescription>
              <CardTitle className="text-base capitalize">
                {lastRun ? `${lastRun.run_type.replace(/_/g, " ")} run` : "No runs yet"}
              </CardTitle>
            </CardHeader>
            {lastRun && (
              <CardContent className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  {lastRun.companyCount} compan{lastRun.companyCount === 1 ? "y" : "ies"} · {formatDateTime(lastRun.started_at)}
                </p>
                <p className="text-sm text-muted-foreground">Run by {lastRun.run_by ?? "—"}</p>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link href="/usage">Open activity log</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {pushRecs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Where to push next</CardTitle>
            <CardDescription>Profiles that are thin or scoring low</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pushRecs.map((rec, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <span className={cn("h-9 w-1 shrink-0 rounded-full", rec.tone === "danger" ? "bg-destructive" : "bg-amber-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{rec.title}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-transparent text-[10px]",
                          rec.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {rec.tag}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.detail}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href={rec.href}>{rec.cta}</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
