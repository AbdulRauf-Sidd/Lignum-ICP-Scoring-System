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
import { statusMeta } from "@/components/accounts/status-meta";
import { formatDateTime } from "@/lib/format";
import type { AccountListItem, AccountHeader, AccountJob } from "@/lib/data/accounts";
import { cn } from "@/lib/utils";

export function AccountsWorkspace({
  accounts,
  selectedCompanyId,
  header,
  jobs,
}: {
  accounts: AccountListItem[];
  selectedCompanyId: number | null;
  header: AccountHeader | null;
  jobs: AccountJob[];
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
          <AccountsList accounts={accounts} onNavigate={() => setNavigating(true)} />
        ) : (
          <AccountDetail key={header.companyId} header={header} jobs={jobs} onNavigate={() => setNavigating(true)} />
        )}
      </div>
    </div>
  );
}

function AccountDetail({
  header,
  jobs,
  onNavigate,
}: {
  header: AccountHeader;
  jobs: AccountJob[];
  onNavigate: () => void;
}) {
  const meta = statusMeta(header.status);

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
                  {header.status}
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

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">Updated {formatDateTime(header.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <AccountMetrics companyId={header.companyId} />

        <AccountJobsTable jobs={jobs} companyId={header.companyId} />
      </div>
    </div>
  );
}
