import Link from "next/link";
import { ArrowRight, ListChecks, GitMerge, HelpCircle, Loader2, XCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHomeStats } from "@/lib/data/companies";
import { getRecentUsageRuns } from "@/lib/data/usage";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/constants";

// Pipeline counts and recent runs change as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, recentRuns] = await Promise.all([getHomeStats(), getRecentUsageRuns(8)]);
  const lastRun = recentRuns[0] ?? null;

  const actionItems = [
    stats.entityAmbiguousCount > 0 && {
      icon: GitMerge,
      count: stats.entityAmbiguousCount,
      label: "companies have an ambiguous entity match",
      detail: "Confirm the right company before the run can continue.",
      href: "/triage?reason=entity_ambiguous",
    },
    stats.lowConfidenceCount > 0 && {
      icon: HelpCircle,
      count: stats.lowConfidenceCount,
      label: "companies have a low-confidence sector",
      detail: "Approve, edit or reject the proposed classification.",
      href: "/triage?reason=low_confidence_sector",
    },
  ].filter(Boolean) as { icon: typeof GitMerge; count: number; label: string; detail: string; href: string }[];

  return (
    <div>
      <PageHeader
        title={`Good afternoon, ${CURRENT_USER.name.split(" ")[0]}`}
        description="A summary of what needs your attention, generated from your recent runs."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ListChecks} label="Awaiting triage" value={stats.triageCount} href="/triage" />
        <StatCard icon={Clock} label="Scored this week" value={stats.scoredThisWeekCount} href="/target-list" />
        <StatCard icon={Loader2} label="In progress" value={stats.inProgressCount} href="/import" />
        <StatCard icon={XCircle} label="Failed enrichments" value={stats.failedCount} href="/import" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Do this next</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {actionItems.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing needs your attention right now.
              </p>
            )}
            {actionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {item.count} {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" /> Last run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastRun ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{lastRun.run_type.replace("_", " ")} run</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(lastRun.started_at)}</p>
                  </div>
                  <Badge variant={lastRun.status === "in_progress" ? "secondary" : "outline"} className="capitalize">
                    {lastRun.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Run by</span>
                  <span className="font-medium">{lastRun.run_by ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Companies</span>
                  <span className="font-medium">{lastRun.companyCount}</span>
                </div>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link href="/usage">View usage log</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium capitalize">
                        {run.run_type.replace("_", " ")} run{run.run_by ? ` by ${run.run_by}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.companyCount} {run.companyCount === 1 ? "company" : "companies"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(run.started_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center gap-3 px-4 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
