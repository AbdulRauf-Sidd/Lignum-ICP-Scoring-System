import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  GitMerge,
  HelpCircle,
  Users,
  XCircle,
  Clock,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getHomeStats, getLastRun, getRecentActivity } from "@/lib/mock/derived";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/constants";

export default function HomePage() {
  const stats = getHomeStats();
  const lastRun = getLastRun();
  const activity = getRecentActivity();

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
    stats.pendingContactsCount > 0 && {
      icon: Users,
      count: stats.pendingContactsCount,
      label: "contacts are listed but not yet redeemed",
      detail: "Select and bulk-enrich to reveal email and phone.",
      href: "/contacts",
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
        <StatCard icon={TrendingDown} label="Scored this week" value={stats.scoredThisWeekCount} href="/target-list" />
        <StatCard icon={Users} label="Contacts to redeem" value={stats.pendingContactsCount} href="/contacts" />
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
                <div>
                  <p className="text-sm font-medium capitalize">
                    {lastRun.runType.replace("_", " ")} run
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(lastRun.createdAt)}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Run by</span>
                  <span className="font-medium">{lastRun.runBy}</span>
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
            <div className="flex flex-col divide-y">
              {activity.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
                </div>
              ))}
            </div>
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
