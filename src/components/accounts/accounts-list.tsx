"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
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
import { type DatePreset, DATE_PRESET_LABELS } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

type SortKey = "name" | "owner" | "revenue" | "cvCost" | "interviewCost" | "updated";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Company",
  owner: "Owner",
  revenue: "Revenue",
  cvCost: "CV Cost",
  interviewCost: "Interview Cost",
  updated: "Updated",
};

// Which figure the numeric filter applies to.
type MetricView = "revenue" | "cvCost" | "interviewCost";

const METRIC_VIEW_LABELS: Record<MetricView, string> = {
  revenue: "Revenue",
  cvCost: "CV Cost",
  interviewCost: "Interview Cost",
};

function metricValue(a: AccountListItem, view: MetricView): number | null {
  if (view === "revenue") return a.totalRevenue;
  if (view === "cvCost") return a.cvCost;
  return a.interviewCost;
}

function SortableHead({
  label,
  active,
  desc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {label}
        <ArrowUpDown className={cn("size-3 transition-transform", active && !desc && "rotate-180")} />
      </button>
    </TableHead>
  );
}

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

// ---- Metric (Revenue / CV Cost / Interview Cost) filter ----

type MetricOp = "any" | "gt" | "lt" | "eq" | "between";

const METRIC_OP_LABELS: Record<MetricOp, string> = {
  any: "Any",
  gt: "Greater than",
  lt: "Less than",
  eq: "Equal to",
  between: "Between",
};

export function AccountsList({
  accounts,
  initialSearch,
  initialDate,
  onNavigate,
}: {
  accounts: AccountListItem[];
  initialSearch: string;
  initialDate: { preset: DatePreset; customStart: string; customEnd: string };
  onNavigate: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = React.useState(initialSearch);

  const [selectedOwners, setSelectedOwners] = React.useState<Set<string>>(new Set());
  const [datePreset, setDatePreset] = React.useState<DatePreset>(initialDate.preset);
  const [customStart, setCustomStart] = React.useState(initialDate.customStart);
  const [customEnd, setCustomEnd] = React.useState(initialDate.customEnd);

  // Search and the date range both run server-side (name match, and revenue /
  // CVs / interviews scoped to the range, happen in the Supabase queries) —
  // synced to the URL. Search is debounced so we're not re-fetching the whole
  // list on every keystroke; a date change goes through quickly.
  const query = React.useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (datePreset !== "all_time") params.set("range", datePreset);
    if (datePreset === "custom") {
      if (customStart) params.set("from", customStart);
      if (customEnd) params.set("to", customEnd);
    }
    return params.toString();
  }, [search, datePreset, customStart, customEnd]);

  // `appliedQuery` is the URL last pushed; `dataQuery` is the one the current
  // `accounts` were actually fetched for. They differ while a request is in
  // flight, and `query` differs from `dataQuery` from the moment a filter
  // changes — that whole gap is "loading".
  const [appliedQuery, setAppliedQuery] = React.useState(query);
  const [dataQuery, setDataQuery] = React.useState(query);
  const lastSearchRef = React.useRef(initialSearch);
  React.useEffect(() => {
    if (query === appliedQuery) return;
    const searchChanged = search !== lastSearchRef.current;
    lastSearchRef.current = search;
    const timeout = setTimeout(
      () => {
        setAppliedQuery(query);
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      },
      searchChanged ? 1000 : 300,
    );
    return () => clearTimeout(timeout);
  }, [query, appliedQuery, search, router, pathname]);

  // `accounts` is a fresh array every time the server sends new data, so that
  // (not a transition flag, which resolves early) marks the fetch as done.
  // Adjusted during render so there's no extra visible frame.
  const [prevAccounts, setPrevAccounts] = React.useState(accounts);
  if (accounts !== prevAccounts) {
    setPrevAccounts(accounts);
    setDataQuery(appliedQuery);
  }
  const loading = query !== dataQuery;

  const [view, setView] = React.useState<MetricView>("revenue");
  const [metricOp, setMetricOp] = React.useState<MetricOp>("any");
  const [metricFilterValue, setMetricFilterValue] = React.useState("");
  const [metricFilterValue2, setMetricFilterValue2] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortKey>("name");
  const [sortDesc, setSortDesc] = React.useState(false);
  const [page, setPage] = React.useState(1);

  // Text columns start A→Z, numeric/date columns start highest/newest first.
  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDesc((d) => !d);
    } else {
      setSortBy(key);
      setSortDesc(key !== "name" && key !== "owner");
    }
    setPage(1);
  }

  // A threshold tied to one metric's scale (e.g. revenue > 100,000) doesn't
  // carry meaning to another (CV cost is a very different scale) — clear it
  // rather than silently reinterpreting the number against the new metric.
  function updateView(next: MetricView) {
    setView(next);
    setMetricOp("any");
    setMetricFilterValue("");
    setMetricFilterValue2("");
    setPage(1);
  }

  const ownerOptions = React.useMemo(() => {
    const named = Array.from(new Set(accounts.map((a) => a.ownedBy).filter((o): o is string => !!o))).sort();
    return accounts.some((a) => !a.ownedBy) ? [...named, UNASSIGNED] : named;
  }, [accounts]);

  const withRevenue = accounts.filter((a) => a.totalRevenue !== null && a.totalRevenue > 0).length;
  const owners = new Set(accounts.map((a) => a.ownedBy).filter(Boolean)).size;

  const metricValueNum = Number(metricFilterValue);
  const metricValue2Num = Number(metricFilterValue2);

  const filtered = accounts
    .filter((a) => selectedOwners.size === 0 || selectedOwners.has(a.ownedBy ?? UNASSIGNED))
    .filter((a) => {
      if (metricOp === "any") return true;
      const value = metricValue(a, view);
      // Not on file is neither "greater than" nor "less than" anything
      // knowable — excluded from every operator rather than treated as 0.
      if (value === null) return false;
      if (metricOp === "gt") return Number.isFinite(metricValueNum) ? value > metricValueNum : true;
      if (metricOp === "lt") return Number.isFinite(metricValueNum) ? value < metricValueNum : true;
      if (metricOp === "eq") return Number.isFinite(metricValueNum) ? value === metricValueNum : true;
      // between
      if (!Number.isFinite(metricValueNum) || !Number.isFinite(metricValue2Num)) return true;
      const lo = Math.min(metricValueNum, metricValue2Num);
      const hi = Math.max(metricValueNum, metricValue2Num);
      return value >= lo && value <= hi;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.companyName.localeCompare(b.companyName);
      else if (sortBy === "owner") cmp = (a.ownedBy ?? UNASSIGNED).localeCompare(b.ownedBy ?? UNASSIGNED);
      else if (sortBy === "updated") cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else {
        // Not on file sorts below every real figure in either direction.
        const av = metricValue(a, sortBy);
        const bv = metricValue(b, sortBy);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        cmp = av - bv;
      }
      return sortDesc ? -cmp : cmp;
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

  function updateMetricOp(value: MetricOp) {
    setMetricOp(value);
    setPage(1);
  }

  const dateActive = datePreset !== "all_time";
  const metricFilterActive = metricOp !== "any";

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
              <Button variant="outline" className={cn("bg-card", metricFilterActive && "border-primary/50 text-primary")}>
                {METRIC_VIEW_LABELS[view]}
                {metricFilterActive ? ` ${METRIC_OP_LABELS[metricOp]}` : ""}
                <ChevronDown className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{METRIC_VIEW_LABELS[view]}</span>
                {metricFilterActive && (
                  <button
                    onClick={() => {
                      updateMetricOp("any");
                      setMetricFilterValue("");
                      setMetricFilterValue2("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <Select value={view} onValueChange={(v) => updateView(v as MetricView)}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(METRIC_VIEW_LABELS) as [MetricView, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={metricOp} onValueChange={(v) => updateMetricOp(v as MetricOp)}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(METRIC_OP_LABELS) as [MetricOp, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {metricOp !== "any" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="$"
                    value={metricFilterValue}
                    onChange={(e) => {
                      setMetricFilterValue(e.target.value);
                      setPage(1);
                    }}
                    className="bg-card"
                  />
                  {metricOp === "between" && (
                    <>
                      <span className="text-sm text-muted-foreground">and</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        value={metricFilterValue2}
                        onChange={(e) => {
                          setMetricFilterValue2(e.target.value);
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

          <Select value={sortBy} onValueChange={(v) => {
              if (v !== sortBy) toggleSort(v as SortKey);
            }}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  Sort: {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="bg-card"
            onClick={() => setSortDesc((d) => !d)}
            aria-label={sortDesc ? "Sorted descending" : "Sorted ascending"}
            title={sortDesc ? "Descending" : "Ascending"}
          >
            <ArrowUpDown className={cn("size-3.5 transition-transform", !sortDesc && "rotate-180")} />
          </Button>
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {loading && <Loader2 className="size-4 animate-spin text-primary" aria-label="Loading" role="status" />}
            {filtered.length} of {accounts.length}
          </span>
        </CardContent>
      </Card>

      <Card className={cn("relative transition-opacity", loading && "pointer-events-none opacity-50")}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
          </div>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Company" active={sortBy === "name"} desc={sortDesc} onClick={() => toggleSort("name")} />
                  <SortableHead label="Owner" active={sortBy === "owner"} desc={sortDesc} onClick={() => toggleSort("owner")} />
                  <SortableHead label="Revenue" className="text-right" active={sortBy === "revenue"} desc={sortDesc} onClick={() => toggleSort("revenue")} />
                  <SortableHead label="CV Cost" className="text-right" active={sortBy === "cvCost"} desc={sortDesc} onClick={() => toggleSort("cvCost")} />
                  <SortableHead label="Interview Cost" className="text-right" active={sortBy === "interviewCost"} desc={sortDesc} onClick={() => toggleSort("interviewCost")} />
                  <SortableHead label="Updated" className="text-right" active={sortBy === "updated"} desc={sortDesc} onClick={() => toggleSort("updated")} />
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
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
                    <TableCell className="text-right tabular-nums">{formatCurrency(a.totalRevenue, "GBP", 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(a.cvCost, "GBP", 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(a.interviewCost, "GBP", 0)}</TableCell>
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
