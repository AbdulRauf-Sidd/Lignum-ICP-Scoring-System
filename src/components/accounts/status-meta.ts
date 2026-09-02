// `active_accounts.status` is free text — this maps whatever real values show
// up to a consistent color so new statuses (Prospect, Churned, etc. per the
// original ask) still get something sensible instead of falling through to
// grey. Only "Active Account" exists in the data today.
export function statusMeta(status: string): { badge: string; dot: string; border: string } {
  const s = status.toLowerCase();
  if (s.includes("active"))
    return { badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", border: "border-l-emerald-500" };
  if (s.includes("prospect"))
    return { badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400", dot: "bg-sky-500", border: "border-l-sky-500" };
  if (s.includes("churn")) return { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive", border: "border-l-destructive" };
  if (s.includes("hold"))
    return { badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500", border: "border-l-amber-500" };
  return { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40", border: "border-l-muted-foreground/40" };
}
