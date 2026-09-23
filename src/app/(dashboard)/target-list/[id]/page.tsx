import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCompanyById } from "@/lib/data/companies";
import { getContactsForCompanies } from "@/lib/data/contacts";
import { CompanyContactsCard } from "@/components/target-list/company-contacts-card";

// Always fetch fresh — this company's status/score can change between
// n8n runs, and freezing it at build time would show stale data.
export const dynamic = "force-dynamic";
import { ScoreRing, ScoreBar } from "@/components/shared/score-display";
import { TierBadge, MatchFlagBadge } from "@/components/shared/badges";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { formatGbpCompact, formatNumber, formatDate } from "@/lib/format";

export default async function CompanyDetailPage({ params }: PageProps<"/target-list/[id]">) {
  const { id } = await params;
  const company = await getCompanyById(id);
  if (!company) notFound();

  const contacts = await getContactsForCompanies([id]);

  return (
    <div>
      <PageHeader title="Target list" description={company.name} />
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" asChild>
        <Link href="/target-list">
          <ArrowLeft /> Back to target list
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CompanyAvatar id={company.id} name={company.name} domain={company.domain} size={12} />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <TierBadge tier={company.tier} />
              {company.exported && (
                <Badge variant="outline" className="border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  Exported
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="size-3.5" /> {company.domain}
              </span>
              {company.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {company.country}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5" /> {company.sector || "Not classified"}
                {company.subSector ? ` · ${company.subSector}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" /> imported {formatDate(company.importedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border px-4 py-2.5">
          <ScoreRing score={company.score} size={52} />
          <div>
            <p className="text-xs text-muted-foreground">Total score</p>
            <p className="text-sm font-medium">{company.confidence ?? "—"}% sector confidence</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Matched ICP</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="text-sm">{company.icp || "Unassigned"}</Badge>
                <MatchFlagBadge flag={company.matchFlag} />
              </div>
              <p className="text-sm text-muted-foreground">{company.oneLineReason}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Score breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {company.scoringBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scoring run recorded for this company yet.</p>
              ) : (
                company.scoringBreakdown.map((cat) => (
                  <ScoreBar
                    key={cat.key}
                    label={cat.label}
                    subScore={cat.subScore}
                    weight={cat.weight}
                    contribution={cat.contribution}
                    excluded={cat.excluded}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stored fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Annual revenue</TableCell>
                      <TableCell>{formatGbpCompact(company.revenueGbp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.revenueSource ?? "—"}</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Headcount</TableCell>
                      <TableCell>{formatNumber(company.headcount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.headcountSource ?? "—"}</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Hiring activity (6mo)</TableCell>
                      <TableCell>{formatNumber(company.hiringEventCount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">cognism</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Risk score</TableCell>
                      <TableCell>{company.creditsafeRiskScore ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">creditsafe</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Credit limit</TableCell>
                      <TableCell>{formatGbpCompact(company.creditsafeCreditLimitGbp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">creditsafe</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Revenue and Headcount are sourced from Cognism by default; the Source column shows
                &quot;creditsafe&quot; whenever this specific company had no Cognism value and Creditsafe was used
                as a fallback instead. Risk score feeds the Credit risk category in the score breakdown above;
                Credit limit is a BD reference only and never affects the score.
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <CompanyContactsCard company={company} contacts={contacts} />
        </div>
      </div>
    </div>
  );
}
