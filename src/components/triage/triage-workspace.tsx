"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { GitMerge, HelpCircle, AlertTriangle, Check, X, MapPin, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { COMPANIES } from "@/lib/mock/data";
import { SECTORS } from "@/lib/constants";
import { ScoreBar } from "@/components/shared/score-display";
import { MatchFlagBadge } from "@/components/shared/badges";
import type { Company, TriageReason } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Resolution = "pending" | "approved" | "rejected";

const REASON_META: Record<
  NonNullable<TriageReason>,
  { label: string; icon: typeof GitMerge; description: string }
> = {
  entity_ambiguous: {
    label: "Entity ambiguous",
    icon: GitMerge,
    description: "The match score didn't clear the threshold, or several strong candidates exist.",
  },
  low_confidence_sector: {
    label: "Low-confidence sector",
    icon: HelpCircle,
    description: "The classifier's confidence fell below the approval threshold.",
  },
  icp_no_match: {
    label: "ICP no-match",
    icon: AlertTriangle,
    description: "Scored, but contradicts this batch's ICP fit rules.",
  },
};

export function TriageWorkspace() {
  const searchParams = useSearchParams();
  const initialReason = searchParams.get("reason") as TriageReason | null;

  const [items] = React.useState<Company[]>(() => COMPANIES.filter((c) => c.status === "triage"));
  const [resolutions, setResolutions] = React.useState<Record<string, Resolution>>({});
  const [edits, setEdits] = React.useState<Record<string, { sector: string; subSector: string }>>({});
  const [candidateSelections, setCandidateSelections] = React.useState<Record<string, string>>({});
  const [filter, setFilter] = React.useState<"all" | NonNullable<TriageReason>>(
    initialReason ?? "all",
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filtered = items.filter((c) => filter === "all" || c.triageReason === filter);

  // Derived rather than synced via effect: falls back to the first item in
  // the current filter whenever the explicit selection isn't in view.
  const effectiveSelectedId = filtered.some((c) => c.id === selectedId) ? selectedId : (filtered[0]?.id ?? null);

  const counts = {
    all: items.length,
    entity_ambiguous: items.filter((c) => c.triageReason === "entity_ambiguous").length,
    low_confidence_sector: items.filter((c) => c.triageReason === "low_confidence_sector").length,
    icp_no_match: items.filter((c) => c.triageReason === "icp_no_match").length,
  };

  const selected = items.find((c) => c.id === effectiveSelectedId) ?? null;

  function approve(company: Company) {
    setResolutions((prev) => ({ ...prev, [company.id]: "approved" }));
    toast.success(`${company.name} approved`, {
      description: "Moved to the target list.",
    });
    selectNext(company.id);
  }

  function reject(company: Company) {
    setResolutions((prev) => ({ ...prev, [company.id]: "rejected" }));
    toast(`${company.name} rejected`, { description: "Remains in triage for further review." });
  }

  function confirmEntity(company: Company) {
    const candidateId = candidateSelections[company.id];
    if (!candidateId) {
      toast.error("Select a candidate entity first");
      return;
    }
    setResolutions((prev) => ({ ...prev, [company.id]: "approved" }));
    toast.success(`Entity confirmed for ${company.name}`, {
      description: "The run will continue with the confirmed company.",
    });
    selectNext(company.id);
  }

  function selectNext(currentId: string) {
    const remaining = filtered.filter((c) => c.id !== currentId && resolutions[c.id] !== "approved");
    setSelectedId(remaining[0]?.id ?? null);
  }

  return (
    <div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="entity_ambiguous">Entity ambiguous ({counts.entity_ambiguous})</TabsTrigger>
          <TabsTrigger value="low_confidence_sector">Low-confidence sector ({counts.low_confidence_sector})</TabsTrigger>
          <TabsTrigger value="icp_no_match">ICP no-match ({counts.icp_no_match})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nothing in this queue. You&apos;re all caught up.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <ScrollArea className="h-[calc(100svh-260px)] rounded-lg border">
            <div className="flex flex-col divide-y">
              {filtered.map((c) => {
                const resolution = resolutions[c.id] ?? "pending";
                const meta = c.triageReason ? REASON_META[c.triageReason] : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-accent",
                      effectiveSelectedId === c.id && "bg-accent",
                      resolution === "approved" && "opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {resolution === "approved" && (
                        <Badge variant="outline" className="border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Approved
                        </Badge>
                      )}
                      {resolution === "rejected" && (
                        <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                          Rejected
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.domain}</p>
                    {meta && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <meta.icon className="size-3.5" />
                        {meta.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div>
            {selected ? (
              <TriageDetail
                key={selected.id}
                company={selected}
                resolution={resolutions[selected.id] ?? "pending"}
                edit={edits[selected.id]}
                onEditChange={(sector, subSector) =>
                  setEdits((prev) => ({ ...prev, [selected.id]: { sector, subSector } }))
                }
                candidateSelection={candidateSelections[selected.id]}
                onCandidateSelect={(id) =>
                  setCandidateSelections((prev) => ({ ...prev, [selected.id]: id }))
                }
                onApprove={() => approve(selected)}
                onReject={() => reject(selected)}
                onConfirmEntity={() => confirmEntity(selected)}
              />
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Select a company from the list.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TriageDetail({
  company,
  resolution,
  edit,
  onEditChange,
  candidateSelection,
  onCandidateSelect,
  onApprove,
  onReject,
  onConfirmEntity,
}: {
  company: Company;
  resolution: Resolution;
  edit?: { sector: string; subSector: string };
  onEditChange: (sector: string, subSector: string) => void;
  candidateSelection?: string;
  onCandidateSelect: (id: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onConfirmEntity: () => void;
}) {
  const meta = company.triageReason ? REASON_META[company.triageReason] : null;
  const sector = edit?.sector ?? company.proposedSector ?? "";
  const subSector = edit?.subSector ?? company.proposedSubSector ?? "";
  const subSectorOptions = SECTORS.find((s) => s.sector === sector)?.subSectors ?? [];
  const resolved = resolution !== "pending";

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{company.name}</h2>
            <p className="text-sm text-muted-foreground">{company.domain} · {company.country}</p>
          </div>
          {meta && (
            <Badge variant="outline" className="gap-1.5 border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <meta.icon className="size-3.5" /> {meta.label}
            </Badge>
          )}
        </div>

        {meta && <p className="-mt-3 text-sm text-muted-foreground">{company.oneLineReason}</p>}

        <Separator />

        {company.triageReason === "entity_ambiguous" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Which company is this?</p>
            <div className="flex flex-col gap-2">
              {company.candidateEntities.map((cand) => (
                <button
                  key={cand.id}
                  disabled={resolved}
                  onClick={() => onCandidateSelect(cand.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    candidateSelection === cand.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                    resolved && "opacity-60",
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
                      <span className="capitalize">source: {cand.source}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {cand.matchScore}% match
                  </Badge>
                </button>
              ))}
            </div>
            {!resolved && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onReject}>
                  <X /> Reject
                </Button>
                <Button onClick={onConfirmEntity}>
                  <Check /> Confirm & continue run
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Select
                  disabled={resolved}
                  value={sector}
                  onValueChange={(v) => onEditChange(v, SECTORS.find((s) => s.sector === v)?.subSectors[0] ?? "")}
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
                <Select disabled={resolved} value={subSector} onValueChange={(v) => onEditChange(sector, v)}>
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

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Classification confidence <span className="font-medium text-foreground">{company.classificationConfidence}%</span>
              </span>
              <span className="text-muted-foreground">
                ICP <span className="font-medium text-foreground">{company.icp}</span>
              </span>
              <span className="text-muted-foreground">
                Match flag <MatchFlagBadge flag={company.matchFlag} />
              </span>
            </div>

            {company.score !== null && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Score breakdown</p>
                  <p className="text-lg font-semibold">{company.score}<span className="text-sm text-muted-foreground"> / 100</span></p>
                </div>
                <div className="flex flex-col gap-3">
                  {company.scoringBreakdown.map((cat) => (
                    <ScoreBar key={cat.key} label={cat.label} subScore={cat.subScore} weight={cat.weight} contribution={cat.contribution} excluded={cat.excluded} />
                  ))}
                </div>
              </div>
            )}

            {!resolved && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onReject}>
                  <X /> Reject
                </Button>
                <Button onClick={onApprove}>
                  <Check /> Approve
                </Button>
              </div>
            )}
            {resolved && (
              <p className="text-sm text-muted-foreground">
                {resolution === "approved" ? "Approved — now on the target list." : "Rejected — remains in triage."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
