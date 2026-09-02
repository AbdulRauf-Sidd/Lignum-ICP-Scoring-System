"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AccountListItem } from "@/lib/data/accounts";
import { statusMeta } from "@/components/accounts/status-meta";
import { cn } from "@/lib/utils";

type SortKey = "name" | "status" | "revenue" | "updated";

const PAGE_SIZE = 20;

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className={cn("text-2xl leading-none font-semibold", tone)}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

export function AccountsList({ accounts, onNavigate }: { accounts: AccountListItem[]; onNavigate: () => void }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState<SortKey>("name");
  const [page, setPage] = React.useState(1);

  const statuses = React.useMemo(() => Array.from(new Set(accounts.map((a) => a.status))).sort(), [accounts]);

  const withRevenue = accounts.filter((a) => a.totalRevenue !== null && a.totalRevenue > 0).length;
  const owners = new Set(accounts.map((a) => a.ownedBy).filter(Boolean)).size;

  const filtered = accounts
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => a.companyName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "revenue") return (b.totalRevenue ?? -1) - (a.totalRevenue ?? -1);
      if (sortBy === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.companyName.localeCompare(b.companyName);
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const paged = filtered.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function updateSortBy(value: SortKey) {
    setSortBy(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Accounts" value={accounts.length} tone="text-primary" />
        <StatTile label="With revenue on file" value={withRevenue} tone="text-emerald-600 dark:text-emerald-400" />
        <StatTile label="Distinct owners" value={owners} tone="text-sky-600 dark:text-sky-400" />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder="Search companies…"
              className="bg-card pl-8"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => updateSearch("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => updateStatusFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {statuses.map((s) => {
              const meta = statusMeta(s);
              return (
                <button
                  key={s}
                  onClick={() => updateStatusFilter(s)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === s ? meta.badge : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", meta.dot)} />
                  {s}
                </button>
              );
            })}
          </div>
          <Select value={sortBy} onValueChange={(v) => updateSortBy(v as SortKey)}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="status">Sort: Status</SelectItem>
              <SelectItem value="revenue">Sort: Revenue</SelectItem>
              <SelectItem value="updated">Sort: Recently updated</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">
            {filtered.length} of {accounts.length}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No accounts match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((a) => {
                  const meta = statusMeta(a.status);
                  return (
                    <TableRow
                      key={a.companyId}
                      className="group cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        onNavigate();
                        router.push(`/accounts?company=${a.companyId}`);
                      }}
                    >
                      <TableCell className="font-medium">{a.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border-transparent", meta.badge)}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.ownedBy ?? "Unassigned"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(a.totalRevenue, a.revenueCurrencyCode ?? "USD")}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatDate(a.updatedAt)}</TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 -translate-x-1 text-muted-foreground/0 transition-all group-hover:translate-x-0 group-hover:text-primary" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(effectivePage - 1) * PAGE_SIZE + 1}–{Math.min(effectivePage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={effectivePage <= 1} onClick={() => setPage(effectivePage - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {effectivePage} of {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={effectivePage >= pageCount} onClick={() => setPage(effectivePage + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
