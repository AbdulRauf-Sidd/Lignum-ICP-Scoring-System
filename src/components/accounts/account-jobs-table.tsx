"use client";

import * as React from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { getJobCandidates, type JobCandidate } from "@/app/(dashboard)/accounts/actions";
import type { AccountJob } from "@/lib/data/accounts";
import { cn } from "@/lib/utils";

const ACTIVITY_META: Record<string, { label: string; className: string }> = {
  moved_to_cv_sent: { label: "CV sent", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  client_interview: { label: "Client interview", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  moved_to_placed: { label: "Placed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function activityMeta(key: string): { label: string; className: string } {
  return ACTIVITY_META[key] ?? { label: key.replace(/_/g, " "), className: "bg-muted text-muted-foreground" };
}

function feeDisplay(job: AccountJob): string {
  if (job.fee === null) return "—";
  if (job.feeTypeKey === "percentage") return `${job.fee}%`;
  const amount = formatCurrency(job.fee, job.feeCurrencyCode ?? "USD");
  return job.feeTypeKey ? `${amount} (${job.feeTypeKey})` : amount;
}

export function AccountJobsTable({ jobs, companyId }: { jobs: AccountJob[]; companyId: number }) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [candidatesByJob, setCandidatesByJob] = React.useState<Record<number, JobCandidate[]>>({});
  const [loadingJobId, setLoadingJobId] = React.useState<number | null>(null);

  async function toggle(jobId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });

    if (!candidatesByJob[jobId]) {
      setLoadingJobId(jobId);
      try {
        const candidates = await getJobCandidates(jobId, companyId);
        setCandidatesByJob((prev) => ({ ...prev, [jobId]: candidates }));
      } finally {
        setLoadingJobId(null);
      }
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Job title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No jobs on record for this account.
                  </TableCell>
                </TableRow>
              )}
              {jobs.map((job) => {
                const isOpen = expanded.has(job.jobId);
                const candidates = candidatesByJob[job.jobId];
                return (
                  <React.Fragment key={job.jobId}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(job.jobId)}>
                      <TableCell>
                        <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell className="font-medium">{job.jobTitle}</TableCell>
                      <TableCell>
                        {job.jobType ? (
                          <Badge variant="outline" className="border-transparent bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            {job.jobType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.jobCategory ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{job.salary ?? "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          job.fee === null
                            ? "text-muted-foreground"
                            : job.feeTypeKey === "percentage"
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {feeDisplay(job)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatDate(job.publishedAt)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="px-4 py-3 pl-11">
                            {loadingJobId === job.jobId && !candidates ? (
                              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" /> Loading candidates…
                              </div>
                            ) : !candidates || candidates.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">No candidates on record for this job.</p>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {candidates.map((c) => (
                                  <div key={c.candidateId} className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Candidate #{c.personId}</span>
                                      <span className="text-xs text-muted-foreground">added {formatDate(c.addedAt)}</span>
                                    </div>
                                    {c.events.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">No activity logged.</p>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {c.events.map((e) => {
                                          const meta = activityMeta(e.activityKey);
                                          return (
                                            <Badge key={e.eventId} variant="outline" className={cn("border-transparent text-[11px]", meta.className)}>
                                              {meta.label} · {formatDate(e.createdAt)}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
