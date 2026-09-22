import { Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar, ScoreRing } from "@/components/shared/score-display";
import { TierBadge, MatchFlagBadge } from "@/components/shared/badges";
import { formatGbpCompact, formatNumber, formatDate } from "@/lib/format";
import type { AccountFirmographics as AccountFirmographicsData } from "@/lib/data/accounts";
import type { ContactRow, ContactStatus } from "@/lib/data/contacts";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONTACT_STATUS_STYLES: Record<ContactStatus, string> = {
  listed: "bg-muted text-muted-foreground",
  in_process: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  redeemed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  listed: "Listed",
  in_process: "In process",
  redeemed: "Redeemed",
  failed: "Failed",
};

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{children}</h4>;
}

// Matched from the separate prospecting `companies` table by domain, fetched
// server-side alongside the rest of this account's data (see
// getAccountFirmographics) — no on-demand "Connect" step. Revenue/headcount/
// credit/founded/HQ/sites/ownership all come straight off that company's
// `companies` row; Ownership is really legal entity type — see the
// AccountFirmographics.ownership comment. Fields stay blank when no matching
// company has been through enrichment yet — nothing here is invented.
// Credit limit is Creditsafe's recommended limit, shown for BD reference
// only — it never factors into the ICP score (that's Credit risk instead,
// driven by Creditsafe's risk score).
function riskLabel(data: AccountFirmographicsData): string | null {
  if (data.hasBankruptcy === null && data.hasActiveLawsuit === null) return null;
  return data.hasBankruptcy || data.hasActiveLawsuit ? "Elevated" : "Low";
}

export function AccountFirmographics({
  data,
  company,
  contacts,
}: {
  data: AccountFirmographicsData | null;
  company: Company | null;
  contacts: ContactRow[];
}) {
  const fields: { label: string; value: string | null; fallback?: boolean }[] = [
    { label: "Revenue", value: data ? formatGbpCompact(data.revenueGbp) : null, fallback: data?.revenueSource === "creditsafe" },
    { label: "Headcount", value: data ? formatNumber(data.headcount) : null, fallback: data?.headcountSource === "creditsafe" },
    { label: "Sites", value: data ? formatNumber(data.numberOfSites) : null },
    { label: "HQ", value: data?.hq ?? null },
    { label: "Founded", value: data?.foundedYear ? String(data.foundedYear) : null },
    { label: "Credit", value: data && data.creditRating !== null ? `${Math.round(data.creditRating)}/100` : null },
    { label: "Credit limit", value: data ? formatGbpCompact(data.creditLimitGbp) : null },
    { label: "Risk", value: data ? riskLabel(data) : null },
    { label: "Ownership", value: data?.ownership ?? null },
    { label: "Hiring activity (6 mo)", value: company ? formatNumber(company.hiringEventCount) : null },
    { label: "Credit risk score", value: company?.creditsafeRiskScore != null ? String(company.creditsafeRiskScore) : null },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Enrichment data</h3>
          {!data && (
            <Badge variant="outline" className="border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
              Not yet enriched
            </Badge>
          )}
        </div>
        <SubHeading>Firmographics</SubHeading>
        <div className="-mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {fields.map(({ label, value, fallback }) => (
            <div key={label}>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                {value ?? <span className="text-muted-foreground">—</span>}
                {fallback && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-muted px-1 py-0 text-[9px] font-normal tracking-wide text-muted-foreground uppercase"
                    title="Cognism had no value for this company — sourced from Creditsafe instead."
                  >
                    Creditsafe fallback
                  </Badge>
                )}
              </p>
            </div>
          ))}
        </div>

        {company && (
          <>
            <div className="flex flex-col gap-3 border-t pt-4">
              <SubHeading>ICP match &amp; score</SubHeading>
              <div className="flex flex-wrap items-center gap-4">
                <ScoreRing score={company.score} size={44} />
                <TierBadge tier={company.tier} />
                <MatchFlagBadge flag={company.matchFlag} />
                <Badge variant="outline">{company.icp || "No ICP assigned"}</Badge>
                <span className="text-sm text-muted-foreground">
                  {company.sector || "Not classified"}
                  {company.subSector ? ` · ${company.subSector}` : ""}
                  {company.confidence !== null ? ` · ${company.confidence}% sector confidence` : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{company.oneLineReason}</p>
              <p className="text-xs text-muted-foreground">
                Last enriched {formatDate(company.lastEnrichedAt)} · imported {formatDate(company.importedAt)}
              </p>
              {company.scoringBreakdown.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {company.scoringBreakdown.map((cat) => (
                    <ScoreBar
                      key={cat.key}
                      label={cat.label}
                      subScore={cat.subScore}
                      weight={cat.weight}
                      contribution={cat.contribution}
                      excluded={cat.excluded}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <SubHeading>Contacts ({contacts.length})</SubHeading>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts have been pulled for this company yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  {contacts.map((ct, i) => (
                    <div
                      key={ct.id}
                      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5", i > 0 && "border-t")}
                    >
                      <div className="min-w-48 flex-1">
                        <p className="text-sm font-medium">{ct.name}</p>
                        <p className="text-xs text-muted-foreground">{ct.title ?? "—"}</p>
                      </div>
                      <span className="flex min-w-48 flex-1 items-center gap-1.5 text-sm">
                        <Mail className="size-3.5 text-muted-foreground" />
                        {ct.email ?? <span className="text-muted-foreground">Not revealed</span>}
                      </span>
                      <span className="flex w-36 shrink-0 items-center gap-1.5 text-sm">
                        <Phone className="size-3.5 text-muted-foreground" />
                        {ct.phone ?? <span className="text-muted-foreground">—</span>}
                      </span>
                      <Badge variant="outline" className={cn("shrink-0 border-transparent", CONTACT_STATUS_STYLES[ct.status])}>
                        {CONTACT_STATUS_LABELS[ct.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
