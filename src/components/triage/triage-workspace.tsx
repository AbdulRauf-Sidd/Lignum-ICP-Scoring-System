"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X, MapPin, Globe, Loader2, TriangleAlert, CheckCheck, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS } from "@/lib/constants";
import { ScoreRing } from "@/components/shared/score-display";
import { TierBadge, SectorBadge } from "@/components/shared/badges";
import { formatUsdCompact, formatNumber } from "@/lib/format";
import type { Company, TriageReason } from "@/lib/types";
import type { IcpProfileRow } from "@/lib/data/icp-profiles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  approveCompany,
  rejectCompany,
  confirmEntityResolution,
  rescoreAndApproveCompany,
} from "@/app/(dashboard)/triage/actions";

type Resolution = "pending" | "approved" | "rejected" | "resolving";

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
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold", style)}>
      {initials(name)}
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  creditsafe: "Creditsafe",
  creditsafe_website_only: "Creditsafe — website match",
  creditsafe_name_only: "Creditsafe — name match",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

const MATCH_STRATEGY_LABELS: Record<string, string> = {
  website_only: "No exact name + website match — closest candidate found by website alone.",
  name_only: "No exact name + website match — closest candidate found by name alone.",
};

// Needs the same human confirmation flow as entity_ambiguous — either several
// candidates to pick between, or a single fallback-found candidate that still
// wasn't corroborated by both signals together.
function needsEntityConfirmation(company: Company): boolean {
  return company.triageReason === "entity_ambiguous" || company.triageReason === "creditsafe_fallback_match";
}

// All the chips shown on a card — includes the routine "why it's here" reason,
// which alone shouldn't block a bulk approve (see isFlagged below).
function getWarnings(company: Company): string[] {
  const warnings: string[] = [];
  if (company.triageReason === "entity_ambiguous") {
    warnings.push(`${company.candidateEntities.length} candidate match${company.candidateEntities.length === 1 ? "" : "es"}`);
  }
  if (company.triageReason === "creditsafe_fallback_match") {
    warnings.push("Fallback match — needs confirmation");
  }
  if (company.triageReason === "low_confidence_sector") {
    warnings.push("Low classification confidence");
  }
  if (company.matchFlag === "weak") warnings.push("Weak ICP match");
  if (company.matchFlag === "no_match") warnings.push("No ICP match");
  return warnings;
}

// A genuine concern beyond the routine triage reason — entity ambiguity (and a
// fallback-only match) always needs a human pick, and a weak/no match is worth
// a second look before approving.
function isFlagged(company: Company): boolean {
  return needsEntityConfirmation(company) || company.matchFlag === "weak" || company.matchFlag === "no_match";
}

export function TriageWorkspace({ companies, profiles }: { companies: Company[]; profiles: IcpProfileRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialReason = searchParams.get("reason") as TriageReason | null;

  const items = companies;
  const [resolutions, setResolutions] = React.useState<Record<string, Resolution>>({});
  const priorTriageReasonsRef = React.useRef<Record<string, TriageReason>>({});

  // "resolving" is set once, right when a resolve is confirmed, and only ever
  // means anything until the async n8n reprocessing actually finishes. Polling
  // refreshes `companies` on a timer, but that alone never clears this flag —
  // reconcile it here: once a company either leaves the triage list (moved on
  // to scored/failed) or comes back with a different triage reason than it had
  // when we set the flag, the reprocessing is done and the flag is stale.
  React.useEffect(() => {
    setResolutions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, resolution] of Object.entries(prev)) {
        if (resolution !== "resolving") continue;
        const company = companies.find((c) => c.id === id);
        const priorReason = priorTriageReasonsRef.current[id];
        if (!company || company.triageReason !== priorReason) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const reasons: Record<string, TriageReason> = {};
    for (const c of companies) reasons[c.id] = c.triageReason;
    priorTriageReasonsRef.current = reasons;
  }, [companies]);
  const [edits, setEdits] = React.useState<Record<string, { sector: string; subSector: string; icpName: string }>>({});
  const [candidateSelections, setCandidateSelections] = React.useState<Record<string, string>>({});
  const [filter, setFilter] = React.useState<"all" | NonNullable<TriageReason>>(
    initialReason ?? "all",
  );
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = React.useState(false);
  const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());

  function toggleEditing(id: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = items.filter((c) => filter === "all" || c.triageReason === filter);

  const counts = {
    all: items.length,
    entity_ambiguous: items.filter((c) => c.triageReason === "entity_ambiguous").length,
    creditsafe_fallback_match: items.filter((c) => c.triageReason === "creditsafe_fallback_match").length,
    low_confidence_sector: items.filter((c) => c.triageReason === "low_confidence_sector").length,
  };

  const unresolved = items.filter((c) => (resolutions[c.id] ?? "pending") === "pending");
  const flaggedCount = unresolved.filter(isFlagged).length;
  const clearItems = unresolved.filter((c) => !isFlagged(c));

  // Sub-sector is informational only, so editing it alone can save
  // instantly. Sector and ICP both feed the score directly, so changing
  // either needs a real rescore before the company can be treated as
  // approved — see rescoreAndApproveCompany's comment for why.
  function needsRescore(company: Company, sector: string, icpName: string) {
    return sector !== company.sector || icpName !== company.icp;
  }

  async function approveOne(company: Company) {
    const edit = edits[company.id];
    const sector = edit?.sector ?? company.proposedSector ?? company.sector;
    const subSector = edit?.subSector ?? company.proposedSubSector ?? company.subSector;
    const icpName = edit?.icpName ?? company.icp;

    if (needsRescore(company, sector, icpName)) {
      await rescoreAndApproveCompany(company.id, { sector, subSector, icpName });
      setResolutions((prev) => ({ ...prev, [company.id]: "resolving" }));
      toast.success(`Rescoring ${company.name} against ${icpName}`, {
        description: "Will move to the target list automatically once the new score is in.",
      });
      return;
    }

    await approveCompany(company.id, sector, subSector);
    setResolutions((prev) => ({ ...prev, [company.id]: "approved" }));
    toast.success(`${company.name} approved`, { description: "Moved to the target list." });
  }

  async function approve(company: Company) {
    setPendingId(company.id);
    try {
      await approveOne(company);
      router.refresh();
    } catch (err) {
      toast.error("Approve failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setPendingId(null);
    }
  }

  async function reject(company: Company) {
    setPendingId(company.id);
    try {
      await rejectCompany(company.id);
      setResolutions((prev) => ({ ...prev, [company.id]: "rejected" }));
      toast(`${company.name} rejected`);
      router.refresh();
    } catch (err) {
      toast.error("Reject failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setPendingId(null);
    }
  }

  async function confirmEntity(company: Company) {
    const candidateId = candidateSelections[company.id];
    const candidate = company.candidateEntities.find((c) => c.id === candidateId);
    if (!candidate) {
      setEditingIds((prev) => new Set(prev).add(company.id));
      toast.error("Select a candidate entity first", { description: "Click a candidate below, then confirm." });
      return;
    }
    setPendingId(company.id);
    try {
      await confirmEntityResolution(company.id, {
        creditsafeCompanyId: candidate.id,
        cognismCompanyId: candidate.cognismId,
      });
      setResolutions((prev) => ({ ...prev, [company.id]: "resolving" }));
      toast.success(`Entity confirmed for ${company.name}`, {
        description: "Reprocessing — it'll return to triage for approval once scoring finishes, or leave the queue if nothing else needs review.",
      });
      router.refresh();
    } catch (err) {
      toast.error("Couldn't confirm entity", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setPendingId(null);
    }
  }

  async function bulkApproveClear() {
    setBulkApproving(true);
    try {
      for (const company of clearItems) {
        await approveOne(company);
      }
      toast.success(`Approved ${clearItems.length} clear account${clearItems.length === 1 ? "" : "s"}`, {
        description: "Moved to the target list.",
      });
      router.refresh();
    } catch (err) {
      toast.error("Bulk approve failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setBulkApproving(false);
    }
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-full min-h-8 w-1 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-semibold">Holding area — nothing reaches the target list until you approve it</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each account was scored on the last run. Check the proposed sector and any flags, then approve, edit
                or reject. <span className="font-medium text-foreground">{unresolved.length} awaiting review</span> ·{" "}
                {flaggedCount} flagged · {clearItems.length} clear.
              </p>
            </div>
          </div>
          <Button onClick={bulkApproveClear} disabled={clearItems.length === 0 || bulkApproving} className="shrink-0">
            {bulkApproving ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            Approve {clearItems.length} clear
          </Button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { key: "all" as const, label: "Total in triage", count: counts.all },
            { key: "entity_ambiguous" as const, label: "Entity ambiguous", count: counts.entity_ambiguous },
            { key: "creditsafe_fallback_match" as const, label: "Fallback match", count: counts.creditsafe_fallback_match },
            { key: "low_confidence_sector" as const, label: "Low-confidence sector", count: counts.low_confidence_sector },
          ]
        ).map((tile) => (
          <button
            key={tile.key}
            onClick={() => setFilter(tile.key)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition-colors",
              filter === tile.key ? "border-primary bg-primary/5" : "hover:bg-accent",
            )}
          >
            <p className="text-2xl font-semibold leading-none">{tile.count}</p>
            <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{tile.label}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nothing in this queue. You&apos;re all caught up.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((c) => (
            <TriageCard
              key={c.id}
              company={c}
              profiles={profiles}
              resolution={resolutions[c.id] ?? "pending"}
              edit={edits[c.id]}
              onEditChange={(sector, subSector, icpName) =>
                setEdits((prev) => ({ ...prev, [c.id]: { sector, subSector, icpName } }))
              }
              candidateSelection={candidateSelections[c.id]}
              onCandidateSelect={(id) => setCandidateSelections((prev) => ({ ...prev, [c.id]: id }))}
              onApprove={() => approve(c)}
              onReject={() => reject(c)}
              onConfirmEntity={() => confirmEntity(c)}
              isPending={pendingId === c.id}
              editing={editingIds.has(c.id)}
              onToggleEdit={() => toggleEditing(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TriageCard({
  company,
  profiles,
  resolution,
  edit,
  onEditChange,
  candidateSelection,
  onCandidateSelect,
  onApprove,
  onReject,
  onConfirmEntity,
  isPending,
  editing,
  onToggleEdit,
}: {
  company: Company;
  profiles: IcpProfileRow[];
  resolution: Resolution;
  edit?: { sector: string; subSector: string; icpName: string };
  onEditChange: (sector: string, subSector: string, icpName: string) => void;
  candidateSelection?: string;
  onCandidateSelect: (id: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onConfirmEntity: () => void;
  isPending: boolean;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const sector = edit?.sector ?? company.proposedSector ?? "";
  const subSector = edit?.subSector ?? company.proposedSubSector ?? "";
  const icpName = edit?.icpName ?? company.icp ?? "";
  const subSectorOptions = SECTORS.find((s) => s.sector === sector)?.subSectors ?? [];
  const resolved = resolution !== "pending";

  const warnings = getWarnings(company);
  const flagged = isFlagged(company) && !resolved;

  return (
    <Card className={cn(flagged && "border-amber-500/50")}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyAvatar id={company.id} name={company.name} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{company.name}</h3>
                <span className="text-sm text-muted-foreground">{company.domain}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <SectorBadge sector={sector || company.sector} />
                {subSector && <span className="text-xs text-muted-foreground">{subSector}</span>}
                <Badge variant="outline" className="border-transparent bg-muted text-[11px] text-muted-foreground">
                  Sector {company.classificationConfidence ?? "—"}%
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatUsdCompact(company.revenueUsd)} rev · {formatNumber(company.headcount)} staff
                {company.country ? ` · ${company.country}` : ""}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Score</p>
              <div className="mt-1 flex items-center gap-1.5">
                <ScoreRing score={company.score} size={30} />
                <TierBadge tier={company.tier} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Confidence</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {company.confidence !== null ? `${company.confidence}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {warnings.map((w) => (
              <Badge key={w} variant="outline" className="gap-1 border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-3" /> {w}
              </Badge>
            ))}
          </div>
        )}

        {resolution === "approved" && (
          <Badge variant="outline" className="w-fit border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Approved — now on the target list
          </Badge>
        )}
        {resolution === "resolving" && (
          <Badge variant="outline" className="w-fit gap-1 border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Loader2 className="size-3 animate-spin" /> Reprocessing — will return to triage if it still needs review
          </Badge>
        )}
        {resolution === "rejected" && (
          <Badge variant="outline" className="w-fit border-transparent bg-destructive/10 text-destructive">
            Rejected
          </Badge>
        )}

        {!resolved && editing && needsEntityConfirmation(company) && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Which company is this?</p>
            {company.triageReason === "creditsafe_fallback_match" && company.creditsafeMatchStrategy && (
              <p className="text-xs text-muted-foreground">
                {MATCH_STRATEGY_LABELS[company.creditsafeMatchStrategy] ?? "Matched via a fallback search — please confirm."}
              </p>
            )}
            {company.candidateEntities.map((cand) => (
              <button
                key={cand.id}
                disabled={isPending}
                onClick={() => onCandidateSelect(cand.id)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  candidateSelection === cand.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{cand.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="size-3" /> {cand.domain}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" /> {cand.location}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="border-transparent bg-sky-500/10 text-[10px] text-sky-600 dark:text-sky-400">
                      {sourceLabel(cand.source)}
                    </Badge>
                    {cand.cognismName ? (
                      <Badge variant="outline" className="border-transparent bg-violet-500/10 text-[10px] text-violet-600 dark:text-violet-400">
                        Cognism: {cand.cognismName}
                        {cand.cognismMatchScore !== null ? ` (${cand.cognismMatchScore}%)` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground">
                        No Cognism match
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {cand.matchScore}% match
                </Badge>
              </button>
            ))}
          </div>
        )}

        {!resolved && editing && !needsEntityConfirmation(company) && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Select
                  disabled={isPending}
                  value={sector}
                  onValueChange={(v) =>
                    onEditChange(v, SECTORS.find((s) => s.sector === v)?.subSectors[0] ?? "", icpName)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.sector} value={s.sector}>
                        {s.sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sub-sector</Label>
                <Select disabled={isPending} value={subSector} onValueChange={(v) => onEditChange(sector, v, icpName)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subSectorOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ICP profile</Label>
              <Select disabled={isPending} value={icpName} onValueChange={(v) => onEditChange(sector, subSector, v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an ICP profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.icp_name}>
                      {p.icp_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(sector !== company.sector || icpName !== company.icp) && (
                <p className="text-xs text-muted-foreground">Changing sector or ICP will trigger a rescore on accept.</p>
              )}
            </div>
          </div>
        )}

        {!resolved && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              {needsEntityConfirmation(company) ? (
                <Button size="sm" onClick={onConfirmEntity} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Check />} Confirm & continue run
                </Button>
              ) : (
                <Button size="sm" onClick={onApprove} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onToggleEdit} disabled={isPending}>
                <Pencil /> {editing ? "Done" : "Edit"}
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={onReject} disabled={isPending}>
              <X /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
