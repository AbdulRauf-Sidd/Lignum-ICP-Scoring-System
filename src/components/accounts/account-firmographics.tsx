import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsdCompact, formatNumber } from "@/lib/format";
import type { AccountFirmographics as AccountFirmographicsData } from "@/lib/data/accounts";

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

export function AccountFirmographics({ data }: { data: AccountFirmographicsData | null }) {
  const fields: { label: string; value: string | null; fallback?: boolean }[] = [
    { label: "Revenue", value: data ? formatUsdCompact(data.revenueUsd) : null, fallback: data?.revenueSource === "creditsafe" },
    { label: "Headcount", value: data ? formatNumber(data.headcount) : null, fallback: data?.headcountSource === "creditsafe" },
    { label: "Sites", value: data ? formatNumber(data.numberOfSites) : null },
    { label: "HQ", value: data?.hq ?? null },
    { label: "Founded", value: data?.foundedYear ? String(data.foundedYear) : null },
    { label: "Credit", value: data && data.creditRating !== null ? `${Math.round(data.creditRating)}/100` : null },
    { label: "Credit limit", value: data ? formatUsdCompact(data.creditLimit) : null },
    { label: "Risk", value: data ? riskLabel(data) : null },
    { label: "Ownership", value: data?.ownership ?? null },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Firmographics</h3>
          {!data && (
            <Badge variant="outline" className="border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
              Not yet enriched
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
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
      </CardContent>
    </Card>
  );
}
