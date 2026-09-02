import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getIcpBadgeClass } from "@/lib/icp-colors";
import type { CompanyStatus, MatchFlag, Tier, TriageReason } from "@/lib/types";

const STATUS_STYLES: Record<CompanyStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  enriching: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  triage: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  scored: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<CompanyStatus, string> = {
  queued: "Queued",
  enriching: "Enriching",
  triage: "In triage",
  scored: "Scored",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const TRIAGE_REASON_LABELS: Partial<Record<NonNullable<TriageReason>, string>> = {
  insufficient_data: "Insufficient data",
  no_icp_profile: "No ICP profile",
  processing_error: "Processing error",
  entity_ambiguous: "Entity ambiguous",
  creditsafe_fallback_match: "Fallback match",
  low_confidence_sector: "Low-confidence sector",
  rejected: "Rejected",
};

export function TriageReasonBadge({ reason }: { reason: TriageReason }) {
  if (!reason) return null;
  return (
    <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground">
      {TRIAGE_REASON_LABELS[reason] ?? reason}
    </Badge>
  );
}

const TIER_STYLES: Record<NonNullable<Tier>, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  B: "bg-primary/15 text-primary",
  C: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export function TierBadge({ tier }: { tier: Tier }) {
  if (!tier) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("w-8 justify-center border-transparent font-semibold", TIER_STYLES[tier])}>
      {tier}
    </Badge>
  );
}

const MATCH_STYLES: Record<MatchFlag, string> = {
  match: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  weak: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  no_match: "bg-destructive/10 text-destructive",
};

const MATCH_LABELS: Record<MatchFlag, string> = {
  match: "Match",
  weak: "Weak",
  no_match: "No match",
};

export function MatchFlagBadge({ flag }: { flag: MatchFlag | null }) {
  if (!flag) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", MATCH_STYLES[flag])}>
      {MATCH_LABELS[flag]}
    </Badge>
  );
}

export function SectorBadge({ sector, className }: { sector: string | null; className?: string }) {
  if (!sector) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", getIcpBadgeClass(sector), className)}>
      {sector}
    </Badge>
  );
}
