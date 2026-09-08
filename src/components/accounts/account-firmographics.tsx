"use client";

import * as React from "react";
import { Loader2, Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsdCompact, formatNumber } from "@/lib/format";
import { connectFirmographics } from "@/app/(dashboard)/accounts/actions";
import type { AccountFirmographics as AccountFirmographicsData } from "@/lib/data/accounts";
import { toast } from "sonner";

// Matched from the separate prospecting `companies` table by domain, but
// only when the user clicks Connect — never automatically on page load.
// Founded/HQ/Ownership come from that company's Creditsafe report, when
// one's on file (see getAccountFirmographics; Ownership is really legal
// entity type — see the AccountFirmographics.ownership comment). There's no
// sites-count data anywhere, so that one stays blank even after a
// successful match — nothing here is invented.
function riskLabel(data: AccountFirmographicsData): string | null {
  if (data.hasBankruptcy === null && data.hasActiveLawsuit === null) return null;
  return data.hasBankruptcy || data.hasActiveLawsuit ? "Elevated" : "Low";
}

type Status = "idle" | "loading" | "not_found" | "matched";

export function AccountFirmographics({ companyUrl }: { companyUrl: string | null }) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [data, setData] = React.useState<AccountFirmographicsData | null>(null);

  async function connect() {
    setStatus("loading");
    try {
      const result = await connectFirmographics(companyUrl);
      setData(result);
      setStatus(result ? "matched" : "not_found");
      if (!result) toast.info("No matching company found for this domain yet");
    } catch (err) {
      setStatus("idle");
      toast.error("Failed to connect firmographics", { description: err instanceof Error ? err.message : undefined });
    }
  }

  const fields: { label: string; value: string | null }[] = [
    { label: "Revenue", value: data ? formatUsdCompact(data.revenueUsd) : null },
    { label: "Headcount", value: data ? formatNumber(data.headcount) : null },
    { label: "Sites", value: null },
    { label: "HQ", value: data?.hq ?? null },
    { label: "Founded", value: data?.foundedYear ? String(data.foundedYear) : null },
    { label: "Credit", value: data && data.creditRating !== null ? `${data.creditRating}/100` : null },
    { label: "Risk", value: data ? riskLabel(data) : null },
    { label: "Ownership", value: data?.ownership ?? null },
  ];

  const badgeText = status === "matched" ? "From enrichment" : status === "not_found" ? "Not yet enriched" : "Not connected";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Firmographics</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-transparent bg-muted text-[10px] tracking-wide text-muted-foreground uppercase">
              {badgeText}
            </Badge>
            <Button variant="outline" size="sm" onClick={connect} disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
              {status === "matched" || status === "not_found" ? "Reconnect" : "Connect"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
              <p className="mt-1 text-sm font-semibold">{value ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
