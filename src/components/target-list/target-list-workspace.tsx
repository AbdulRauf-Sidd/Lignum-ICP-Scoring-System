"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Archive, ArchiveRestore, Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { ScoreRing } from "@/components/shared/score-display";
import { TierBadge, MatchFlagBadge } from "@/components/shared/badges";
import { formatUsdCompact, formatNumber, formatDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SortKey = "score" | "confidence" | "name" | "enrichedAt";
type ExportedFilter = "all" | "exported" | "not_exported";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function TargetListWorkspace({ companies }: { companies: Company[] }) {
  const scoredCompanies = companies;
  const [tab, setTab] = React.useState<string>(ICP_NAMES[0]);
  const [sector, setSector] = React.useState<string>("all");
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

  const subSectorOptions = sector === "all" ? [] : SECTORS.find((s) => s.sector === sector)?.subSectors ?? [];

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
    .filter((c) => c.icp === tab)
    .filter((c) => sector === "all" || c.sector === sector)
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
    sector !== "all",
    subSector !== "all",
    tier !== "all",
    exportedFilter !== "all",
    search !== "",
    enrichedAtStart !== "",
    enrichedAtEnd !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setSector("all");
    setSubSector("all");
    setTier("all");
    setExportedFilter("all");
    setSearch("");
    setEnrichedAtStart("");
    setEnrichedAtEnd("");
    setPage(1);
  }

  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList className="flex-wrap">
          {ICP_NAMES.map((name) => (
            <TabsTrigger key={name} value={name}>
              {name}
              <Badge variant="secondary" className="ml-1.5 h-5 px-1 text-[10px]">
                {scoredCompanies.filter((c) => c.icp === name && !archived.has(c.id)).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="relative w-full max-w-56">
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
          <FilterSelect
            label="Sector"
            value={sector}
            onChange={(v) => {
              setSector(v);
              setSubSector("all");
              setPage(1);
            }}
            options={[{ value: "all", label: "All sectors" }, ...SECTORS.map((s) => ({ value: s.sector, label: s.sector }))]}
          />
          <FilterSelect
            label="Sub-sector"
            value={subSector}
            onChange={(v) => {
              setSubSector(v);
              setPage(1);
            }}
            disabled={sector === "all"}
            options={[{ value: "all", label: "All sub-sectors" }, ...subSectorOptions.map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            label="Tier"
            value={tier}
            onChange={(v) => {
              setTier(v as "all" | "A" | "B" | "C");
              setPage(1);
            }}
            options={[
              { value: "all", label: "All tiers" },
              { value: "A", label: "Tier A" },
              { value: "B", label: "Tier B" },
              { value: "C", label: "Tier C" },
            ]}
          />
          <FilterSelect
            label="Exported"
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
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Enriched at</Label>
            <div className="flex items-center gap-1.5">
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
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(v) => {
                setShowArchived(v);
                setPage(1);
              }}
            />
            <Label htmlFor="show-archived" className="text-sm font-normal text-muted-foreground">
              Show archived
            </Label>
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X /> Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Company" active={sortKey === "name"} desc={sortDesc} onClick={() => toggleSort("name")} />
              <TableHead>Sector / sub-sector</TableHead>
              <SortableHead label="Score" active={sortKey === "score"} desc={sortDesc} onClick={() => toggleSort("score")} />
              <TableHead>Tier</TableHead>
              <SortableHead label="Confidence" active={sortKey === "confidence"} desc={sortDesc} onClick={() => toggleSort("confidence")} />
              <TableHead>Match</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Headcount</TableHead>
              <SortableHead label="Enriched" active={sortKey === "enrichedAt"} desc={sortDesc} onClick={() => toggleSort("enrichedAt")} />
              <TableHead>Exported</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <TargetListRow
                key={c.id}
                company={c}
                archived={archived.has(c.id)}
                onToggleArchive={() => toggleArchive(c.id)}
              />
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  No companies match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

function TargetListRow({
  company,
  archived,
  onToggleArchive,
}: {
  company: Company;
  archived: boolean;
  onToggleArchive: () => void;
}) {
  return (
    <TableRow className={cn(archived && "opacity-50")}>
      <TableCell>
        <Link href={`/target-list/${company.id}`} className="font-medium hover:underline">
          {company.name}
        </Link>
        <p className="text-xs text-muted-foreground">{company.domain}</p>
      </TableCell>
      <TableCell>
        <p className="text-sm">{company.sector}</p>
        <p className="text-xs text-muted-foreground">{company.subSector}</p>
      </TableCell>
      <TableCell>
        <ScoreRing score={company.score} size={38} />
      </TableCell>
      <TableCell>
        <TierBadge tier={company.tier} />
      </TableCell>
      <TableCell className="tabular-nums">{company.confidence}%</TableCell>
      <TableCell>
        <MatchFlagBadge flag={company.matchFlag} />
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{formatUsdCompact(company.revenueUsd)}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{formatNumber(company.headcount)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(company.lastEnrichedAt)}</TableCell>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-44">
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
