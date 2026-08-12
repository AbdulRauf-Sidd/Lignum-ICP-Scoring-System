import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CompanyStatus, MatchFlag, Tier } from "@/lib/types";

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

const TIER_STYLES: Record<NonNullable<Tier>, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  B: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  C: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
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
