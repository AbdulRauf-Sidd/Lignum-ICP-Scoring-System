"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UkDateInput } from "@/components/ui/uk-date-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AccountListItem } from "@/lib/data/accounts";
import { type DatePreset, DATE_PRESET_LABELS, datePresetRange } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

type SortKey = "name" | "revenue";

const UNASSIGNED = "Unassigned";
const PAGE_SIZE = 20;

// First, last, current, and its neighbors — everything else collapses to an
// ellipsis so the control stays a fixed, glanceable width no matter how many
// pages there are.
function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className={cn("text-2xl leading-none font-semibold", tone)}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

// ---- Revenue filter ----

type RevenueOp = "any" | "gt" | "lt" | "eq" | "between";

const REVENUE_OP_LABELS: Record<RevenueOp, string> = {
  any: "Any",
  gt: "Greater than",
  lt: "Less than",
  eq: "Equal to",
  between: "Between",
};

export function AccountsList({
  accounts,
  initialSearch,
  onNavigate,
}: {
  accounts: AccountListItem[];
  initialSearch: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = React.useState(initialSearch);

  // Search runs server-side (name match happens in the Supabase query, not
  // client-side filtering below) -- debounced so we're not re-fetching the
  // whole list on every keystroke.
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const query = search ? `?q=${encodeURIComponent(search)}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [search, router, pathname]);
  const [selectedOwners, setSelectedOwners] = React.useState<Set<string>>(new Set());
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all_time");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [revenueOp, setRevenueOp] = React.useState<RevenueOp>("any");
  const [revenueValue, setRevenueValue] = React.useState("");
  const [revenueValue2, setRevenueValue2] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortKey>("name");
  const [page, setPage] = React.useState(1);

  const ownerOptions = React.useMemo(() => {
    const named = Array.from(new Set(accounts.map((a) => a.ownedBy).filter((o): o is string => !!o))).sort();
    return accounts.some((a) => !a.ownedBy) ? [...named, UNASSIGNED] : named;
  }, [accounts]);

  const withRevenue = accounts.filter((a) => a.totalRevenue !== null && a.totalRevenue > 0).length;
  const owners = new Set(accounts.map((a) => a.ownedBy).filter(Boolean)).size;

  const dateRange = datePresetRange(datePreset, customStart, customEnd);
  const revenueValueNum = Number(revenueValue);
  const revenueValue2Num = Number(revenueValue2);

  const filtered = accounts
    .filter((a) => selectedOwners.size === 0 || selectedOwners.has(a.ownedBy ?? UNASSIGNED))
    .filter((a) => {
      if (!dateRange.start && !dateRange.end) return true;
      const t = new Date(a.updatedAt).getTime();
      if (dateRange.start && t < new Date(`${dateRange.start}T00:00:00.000Z`).getTime()) return false;
      if (dateRange.end && t > new Date(`${dateRange.end}T23:59:59.999Z`).getTime()) return false;
      return true;
    })
    .filter((a) => {
      if (revenueOp === "any") return true;
      // Revenue not on file is neither "greater than" nor "less than" anything
      // knowable — excluded from every operator rather than treated as $0.
      if (a.totalRevenue === null) return false;
      if (revenueOp === "gt") return Number.isFinite(revenueValueNum) ? a.totalRevenue > revenueValueNum : true;
      if (revenueOp === "lt") return Number.isFinite(revenueValueNum) ? a.totalRevenue < revenueValueNum : true;
      if (revenueOp === "eq") return Number.isFinite(revenueValueNum) ? a.totalRevenue === revenueValueNum : true;
      // between
      if (!Number.isFinite(revenueValueNum) || !Number.isFinite(revenueValue2Num)) return true;
      const lo = Math.min(revenueValueNum, revenueValue2Num);
      const hi = Math.max(revenueValueNum, revenueValue2Num);
      return a.totalRevenue >= lo && a.totalRevenue <= hi;
    })
    .sort((a, b) => {
      if (sortBy === "revenue") return (b.totalRevenue ?? -1) - (a.totalRevenue ?? -1);
      return a.companyName.localeCompare(b.companyName);
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const paged = filtered.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleOwner(owner: string) {
    setSelectedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(owner)) next.delete(owner);
      else next.add(owner);
      return next;
    });
    setPage(1);
  }

  function updateDatePreset(value: DatePreset) {
    setDatePreset(value);
    setPage(1);
  }

  function updateRevenueOp(value: RevenueOp) {
    setRevenueOp(value);
    setPage(1);
  }

  function updateSortBy(value: SortKey) {
    setSortBy(value);
    setPage(1);
  }

  const dateActive = datePreset !== "all_time";
  const revenueActive = revenueOp !== "any";

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

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("bg-card", selectedOwners.size > 0 && "border-primary/50 text-primary")}>
                Owner{selectedOwners.size > 0 ? ` (${selectedOwners.size})` : ""}
                <ChevronDown className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Owner</span>
                {selectedOwners.size > 0 && (
                  <button
                    onClick={() => {
                      setSelectedOwners(new Set());
                      setPage(1);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                {ownerOptions.length === 0 && <p className="px-1.5 py-1 text-sm text-muted-foreground">No owners on file.</p>}
                {ownerOptions.map((o) => (
                  <label
                    key={o}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox checked={selectedOwners.has(o)} onCheckedChange={() => toggleOwner(o)} />
                    {o}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={datePreset} onValueChange={(v) => updateDatePreset(v as DatePreset)}>
            <SelectTrigger className={cn("w-40 bg-card", dateActive && "border-primary/50 text-primary")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESET_LABELS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <>
              <UkDateInput
                value={customStart}
                onChange={(v) => {
                  setCustomStart(v);
                  setPage(1);
                }}
                className="w-32 bg-card"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <UkDateInput
                value={customEnd}
                onChange={(v) => {
                  setCustomEnd(v);
                  setPage(1);
                }}
                className="w-32 bg-card"
              />
            </>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("bg-card", revenueActive && "border-primary/50 text-primary")}>
                Revenue{revenueActive ? ` ${REVENUE_OP_LABELS[revenueOp]}` : ""}
                <ChevronDown className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Revenue</span>
                {revenueActive && (
                  <button
                    onClick={() => {
                      updateRevenueOp("any");
                      setRevenueValue("");
                      setRevenueValue2("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <Select value={revenueOp} onValueChange={(v) => updateRevenueOp(v as RevenueOp)}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(REVENUE_OP_LABELS) as [RevenueOp, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {revenueOp !== "any" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="$"
                    value={revenueValue}
                    onChange={(e) => {
                      setRevenueValue(e.target.value);
                      setPage(1);
                    }}
                    className="bg-card"
                  />
                  {revenueOp === "between" && (
                    <>
                      <span className="text-sm text-muted-foreground">and</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        value={revenueValue2}
                        onChange={(e) => {
                          setRevenueValue2(e.target.value);
                          setPage(1);
                        }}
                        className="bg-card"
                      />
                    </>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select value={sortBy} onValueChange={(v) => updateSortBy(v as SortKey)}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="revenue">Sort: Revenue</SelectItem>
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
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No accounts match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((a) => (
                  <TableRow
                    key={a.companyId}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      onNavigate();
                      router.push(`/accounts?company=${a.companyId}`);
                    }}
                  >
                    <TableCell className="font-medium">{a.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">{a.ownedBy ?? UNASSIGNED}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(a.totalRevenue, a.revenueCurrencyCode ?? "USD", 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatDate(a.updatedAt)}</TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 -translate-x-1 text-muted-foreground/0 transition-all group-hover:translate-x-0 group-hover:text-primary" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {(effectivePage - 1) * PAGE_SIZE + 1}–{Math.min(effectivePage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={effectivePage <= 1}
              onClick={() => setPage(effectivePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            {pageNumbers(effectivePage, pageCount).map((p, i) =>
              p === "ellipsis" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-current={p === effectivePage ? "page" : undefined}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors",
                    p === effectivePage
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={effectivePage >= pageCount}
              onClick={() => setPage(effectivePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
