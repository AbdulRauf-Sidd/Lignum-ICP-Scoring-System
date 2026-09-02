"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Archive, ArchiveRestore, ChevronRight, Search, TriangleAlert, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ICP_NAMES, SECTORS } from "@/lib/constants";
import { getIcpAvatarClass } from "@/lib/icp-colors";
import { ScoreBar, ScoreRing } from "@/components/shared/score-display";
import { TierBadge, MatchFlagBadge, SectorBadge } from "@/components/shared/badges";
import { formatUsdCompact, formatNumber, formatDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SortKey = "score" | "confidence" | "name" | "enrichedAt";
type ExportedFilter = "all" | "exported" | "not_exported";
type View = "scorecard" | "detail";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

interface IcpStats {
  count: number;
  avgScore: number | null;
  tierA: number;
  tierB: number;
  tierC: number;
  weak: number;
}

function computeStats(list: Company[]): IcpStats {
  const count = list.length;
  const scores = list.map((c) => c.score).filter((s): s is number => s !== null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return {
    count,
    avgScore,
    tierA: list.filter((c) => c.tier === "A").length,
    tierB: list.filter((c) => c.tier === "B").length,
    tierC: list.filter((c) => c.tier === "C").length,
    weak: list.filter((c) => c.matchFlag === "weak" || c.matchFlag === "no_match").length,
  };
}

export function TargetListWorkspace({ companies }: { companies: Company[] }) {
  const scoredCompanies = companies;
  const [tab, setTab] = React.useState<string>("all");
  const [view, setView] = React.useState<View>("scorecard");
  const [subSector, setSubSector] = React.useState<string>("all");
  const [tier, setTier] = React.useState<"all" | "A" | "B" | "C">("all");
  const [exportedFilter, setExportedFilter] = React.useState<ExportedFilter>("all");
  const [search, setSearch] = React.useState("");
  const [enrichedAtStart, setEnrichedAtStart] = React.useState("");
  const [enrichedAtEnd, setEnrichedAtEnd] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("score");
  const [sortDesc, setSortDesc] = React.useState(true);
  const [archived, setArchived] = React.useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const subSectorOptions = tab === "all" ? [] : SECTORS.find((s) => s.sector === tab)?.subSectors ?? [];

  const notArchived = React.useMemo(
    () => scoredCompanies.filter((c) => showArchived || !archived.has(c.id)),
    [scoredCompanies, archived, showArchived],
  );

  const icpStats = React.useMemo(() => {
    const byIcp = new Map<string, IcpStats>();
    for (const name of ICP_NAMES) {
      byIcp.set(name, computeStats(notArchived.filter((c) => c.icp === name)));
    }
    byIcp.set("all", computeStats(notArchived));
    return byIcp;
  }, [notArchived]);

  const activeStats = icpStats.get(tab) ?? computeStats([]);

  function toggleArchive(id: string) {
    setArchived((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Restored from archive");
      } else {
        next.add(id);
        toast("Archived");
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const enrichedStartMs = enrichedAtStart ? new Date(enrichedAtStart).getTime() : null;
  const enrichedEndMs = enrichedAtEnd ? new Date(enrichedAtEnd).getTime() + DAY_MS - 1 : null;

  const filtered = scoredCompanies
    .filter((c) => tab === "all" || c.icp === tab)
    .filter((c) => subSector === "all" || c.subSector === subSector)
    .filter((c) => tier === "all" || c.tier === tier)
    .filter((c) => (exportedFilter === "all" ? true : exportedFilter === "exported" ? c.exported : !c.exported))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => (showArchived ? true : !archived.has(c.id)))
    .filter((c) => {
      if (enrichedStartMs === null && enrichedEndMs === null) return true;
      if (!c.lastEnrichedAt) return false;
      const t = new Date(c.lastEnrichedAt).getTime();
      if (enrichedStartMs !== null && t < enrichedStartMs) return false;
      if (enrichedEndMs !== null && t > enrichedEndMs) return false;
      return true;
    });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "score") cmp = (a.score ?? 0) - (b.score ?? 0);
    if (sortKey === "confidence") cmp = (a.confidence ?? 0) - (b.confidence ?? 0);
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    if (sortKey === "enrichedAt") cmp = (a.lastEnrichedAt ? new Date(a.lastEnrichedAt).getTime() : 0) - (b.lastEnrichedAt ? new Date(b.lastEnrichedAt).getTime() : 0);
    return sortDesc ? -cmp : cmp;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const paged = sorted.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  const activeFilterCount = [
    subSector !== "all",
    tier !== "all",
    exportedFilter !== "all",
    search !== "",
    enrichedAtStart !== "",
    enrichedAtEnd !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setSubSector("all");
    setTier("all");
    setExportedFilter("all");
    setSearch("");
    setEnrichedAtStart("");
    setEnrichedAtEnd("");
    setPage(1);
  }

  const columnCount = view === "scorecard" ? 14 : 13;

  return (
    <div>
      {/* ICP profile tabs — bordered tiles with count, avg score and a tier split bar */}
      <Card className="mb-4">
      <CardContent className="flex flex-nowrap gap-2.5 overflow-x-auto">
        {[...ICP_NAMES, "all"].map((name) => {
          const stats = icpStats.get(name) ?? computeStats([]);
          const active = tab === name;
          const isAll = name === "all";
          const tierTotal = stats.tierA + stats.tierB + stats.tierC || 1;
          return (
            <button
              key={name}
              onClick={() => {
                setTab(name);
                setSubSector("all");
                setPage(1);
              }}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-xs font-bold",
                  isAll
                    ? active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    : getIcpAvatarClass(name),
                )}
              >
                {isAll ? "Σ" : name.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{isAll ? "All profiles" : name}</span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {stats.count} {!isAll && stats.avgScore !== null && `· avg ${stats.avgScore}`}
                  </span>
                  {!isAll && stats.count > 0 && (
                    <span className="flex h-1 w-14 overflow-hidden rounded-full">
                      <span className="h-full bg-emerald-500" style={{ width: `${(stats.tierA / tierTotal) * 100}%` }} />
                      <span className="h-full bg-primary" style={{ width: `${(stats.tierB / tierTotal) * 100}%` }} />
                      <span className="h-full bg-slate-400" style={{ width: `${(stats.tierC / tierTotal) * 100}%` }} />
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </CardContent>
      </Card>

      {/* Stat tiles for the active profile */}
      <Card className="mb-4">
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label={tab === "all" ? "All accounts" : "In this profile"} value={activeStats.count} sublabel={tab === "all" ? undefined : tab} />
        <StatTile label="Tier A" value={activeStats.tierA} tone="text-emerald-600 dark:text-emerald-400" sublabel="priority" />
        <StatTile label="Tier B" value={activeStats.tierB} tone="text-primary" sublabel="qualify" />
        <StatTile label="Avg ICP score" value={activeStats.avgScore ?? "—"} sublabel="of 100" />
        <StatTile label="Weak matches" value={activeStats.weak} tone={activeStats.weak > 0 ? "text-destructive" : undefined} sublabel="review" />
      </CardContent>
      </Card>

      <Card className="mb-4">
      <CardContent className="flex flex-col gap-3">
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setView("scorecard")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "scorecard" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Scorecard
          </button>
          <button
            onClick={() => setView("detail")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "detail" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Full detail
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-muted/40 p-1">
          {(
            [
              { value: "all" as const, label: "All", count: activeStats.count },
              { value: "A" as const, label: "A", count: activeStats.tierA },
              { value: "B" as const, label: "B", count: activeStats.tierB },
              { value: "C" as const, label: "C", count: activeStats.tierC },
            ]
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTier(t.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium tabular-nums transition-colors",
                tier === t.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} {t.count}
            </button>
          ))}
        </div>

        <FilterSelect
          label="Sub-sector"
          hideLabel
          width="w-40"
          value={subSector}
          onChange={(v) => {
            setSubSector(v);
            setPage(1);
          }}
          disabled={tab === "all"}
          options={[{ value: "all", label: "All sub-sectors" }, ...subSectorOptions.map((s) => ({ value: s, label: s }))]}
        />

        <div className="relative w-40 shrink-0">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search company"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(v) => {
                setShowArchived(v);
                setPage(1);
              }}
            />
            <Label htmlFor="show-archived" className="whitespace-nowrap text-sm font-normal text-muted-foreground">
              Show archived
            </Label>
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {sorted.length} of {activeStats.count} in {tab === "all" ? "all profiles" : tab}
          </span>
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
        <FilterSelect
          label="Exported"
          width="w-32"
          value={exportedFilter}
          onChange={(v) => {
            setExportedFilter(v as ExportedFilter);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "exported", label: "Exported" },
            { value: "not_exported", label: "Not exported" },
          ]}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <Label className="whitespace-nowrap text-xs text-muted-foreground">Enriched</Label>
          <Input
            type="date"
            className="w-36"
            value={enrichedAtStart}
            onChange={(e) => {
              setEnrichedAtStart(e.target.value);
              setPage(1);
            }}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-36"
            value={enrichedAtEnd}
            onChange={(e) => {
              setEnrichedAtEnd(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0 text-muted-foreground">
            <X /> Clear filters
          </Button>
        )}
      </div>
      </CardContent>
      </Card>

      <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableHead label="Company" active={sortKey === "name"} desc={sortDesc} onClick={() => toggleSort("name")} />
              <TableHead>Sector</TableHead>
              {view === "scorecard" ? (
                <>
                  <TableHead>ICP</TableHead>
                  <TableHead>Scale</TableHead>
                  <TableHead>Hiring</TableHead>
                  <TableHead>Financial</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Headcount</TableHead>
                </>
              )}
              <SortableHead label="Sector confidence" active={sortKey === "confidence"} desc={sortDesc} onClick={() => toggleSort("confidence")} />
              <SortableHead label="Score" active={sortKey === "score"} desc={sortDesc} onClick={() => toggleSort("score")} />
              <TableHead>Tier</TableHead>
              <SortableHead label="Enriched" active={sortKey === "enrichedAt"} desc={sortDesc} onClick={() => toggleSort("enrichedAt")} />
              <TableHead>Match</TableHead>
              <TableHead>Exported</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <TargetListRow
                key={c.id}
                company={c}
                view={view}
                archived={archived.has(c.id)}
                onToggleArchive={() => toggleArchive(c.id)}
                expanded={expandedIds.has(c.id)}
                onToggleExpand={() => toggleExpand(c.id)}
                columnCount={columnCount}
              />
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-10 text-center text-sm text-muted-foreground">
                  No companies match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      </Card>

      {sorted.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(effectivePage - 1) * PAGE_SIZE + 1}–{Math.min(effectivePage * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={effectivePage <= 1}
              onClick={() => setPage(effectivePage - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {effectivePage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={effectivePage >= pageCount}
              onClick={() => setPage(effectivePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const AVATAR_STYLES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % mod;
}

function CompanyAvatar({ id, name }: { id: string; name: string }) {
  const style = AVATAR_STYLES[hashIndex(id, AVATAR_STYLES.length)];
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold", style)}>
      {initials(name)}
    </span>
  );
}

function StatTile({
  label,
  value,
  tone,
  sublabel,
}: {
  label: string;
  value: number | string;
  tone?: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className={cn("text-2xl font-semibold leading-none", tone)}>{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        {sublabel && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-muted-foreground normal-case">
            {sublabel}
          </span>
        )}
      </p>
    </div>
  );
}

function CategoryMeter({ category }: { category: Company["scoringBreakdown"][number] | undefined }) {
  if (!category || category.excluded || category.subScore === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium tabular-nums">{category.subScore}</span>
      <span className="block h-1 w-14 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${category.subScore}%` }} />
      </span>
    </div>
  );
}

function TargetListRow({
  company,
  view,
  archived,
  onToggleArchive,
  expanded,
  onToggleExpand,
  columnCount,
}: {
  company: Company;
  view: View;
  archived: boolean;
  onToggleArchive: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  columnCount: number;
}) {
  const byKey = new Map(company.scoringBreakdown.map((c) => [c.key, c]));
  return (
    <>
      <TableRow className={cn(archived && "opacity-50")}>
        <TableCell>
          <button
            onClick={onToggleExpand}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={expanded ? "Hide scorecard" : "Show scorecard"}
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        </TableCell>
        <TableCell>
        <div className="flex items-center gap-2.5">
          <CompanyAvatar id={company.id} name={company.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={`/target-list/${company.id}`} className="truncate font-medium hover:underline">
                {company.name}
              </Link>
              {(company.matchFlag === "weak" || company.matchFlag === "no_match") && (
                <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{company.domain}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <SectorBadge sector={company.icp} />
        <p className="mt-1 text-xs text-muted-foreground">
          {company.sector}
          {company.subSector ? ` · ${company.subSector}` : ""}
        </p>
      </TableCell>
      {view === "scorecard" ? (
        <>
          <TableCell>
            <CategoryMeter category={byKey.get("icp_fit")} />
          </TableCell>
          <TableCell>
            <CategoryMeter category={byKey.get("scale_footprint")} />
          </TableCell>
          <TableCell>
            <CategoryMeter category={byKey.get("hiring_growth")} />
          </TableCell>
          <TableCell>
            <CategoryMeter category={byKey.get("financial_viability")} />
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="tabular-nums text-muted-foreground">{formatUsdCompact(company.revenueUsd)}</TableCell>
          <TableCell className="tabular-nums text-muted-foreground">{formatNumber(company.headcount)}</TableCell>
        </>
      )}
      <TableCell className="tabular-nums">{company.confidence}%</TableCell>
      <TableCell>
        <ScoreRing score={company.score} size={38} />
      </TableCell>
      <TableCell>
        <TierBadge tier={company.tier} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(company.lastEnrichedAt)}</TableCell>
      <TableCell>
        <MatchFlagBadge flag={company.matchFlag} />
      </TableCell>
      <TableCell>
        {company.exported ? (
          <Badge variant="outline" className="border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400">
            Exported
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon" onClick={onToggleArchive} title={archived ? "Restore" : "Archive"}>
            {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className={cn(archived && "opacity-50")}>
          <TableCell colSpan={columnCount} className="bg-muted/30 p-0">
            <div className="flex flex-col gap-3 px-6 py-4">
              <p className="text-sm text-muted-foreground">{company.oneLineReason}</p>
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
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function SortableHead({
  label,
  active,
  desc,
  onClick,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button onClick={onClick} className={cn("flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        <ArrowUpDown className={cn("size-3", active && !desc && "rotate-180", "transition-transform")} />
      </button>
    </TableHead>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  width = "w-36",
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  width?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {!hideLabel && <Label className="whitespace-nowrap text-xs text-muted-foreground">{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={width} aria-label={hideLabel ? label : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
