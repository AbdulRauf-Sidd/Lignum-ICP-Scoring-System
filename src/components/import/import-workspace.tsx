"use client";

import * as React from "react";
import {
  UploadCloud,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { StatusBadge, TriageReasonBadge } from "@/components/shared/badges";
import type { FailedCompany } from "@/lib/data/companies";
import type { IcpProfileRow } from "@/lib/data/icp-profiles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RowIssue = "missing_name" | "missing_domain" | "malformed_domain";

interface Row {
  id: string;
  name: string;
  domain: string;
  issues: RowIssue[];
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function getRowIssues(name: string, domain: string): RowIssue[] {
  const issues: RowIssue[] = [];
  if (!name.trim()) issues.push("missing_name");
  if (!domain.trim()) issues.push("missing_domain");
  else if (!DOMAIN_RE.test(domain.trim())) issues.push("malformed_domain");
  return issues;
}

const ISSUE_LABEL: Record<RowIssue, string> = {
  missing_name: "Missing name",
  missing_domain: "Missing domain",
  malformed_domain: "Malformed domain",
};

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return `row-${Date.now()}-${rowIdCounter}`;
}

type SubmitResult =
  | { kind: "success"; raw: unknown }
  | { kind: "error"; message: string; details?: unknown };

export function ImportWorkspace({
  scoredThisWeekCount,
  queue,
  profiles,
}: {
  scoredThisWeekCount: number;
  queue: FailedCompany[];
  profiles: IcpProfileRow[];
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [manualName, setManualName] = React.useState("");
  const [manualDomain, setManualDomain] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);
  const [selectedIcpId, setSelectedIcpId] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function addRow(name: string, domain: string) {
    if (!name.trim() && !domain.trim()) return;
    const trimmedName = name.trim();
    const trimmedDomain = domain.trim();
    setRows((prev) => [
      ...prev,
      { id: nextRowId(), name: trimmedName, domain: trimmedDomain, issues: getRowIssues(trimmedName, trimmedDomain) },
    ]);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let added = 0;
      let flagged = 0;
      lines.forEach((line, idx) => {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (idx === 0 && /company|domain|name/i.test(line)) return; // header row
        const [name = "", domain = ""] = cells;
        if (!name && !domain) return;
        if (getRowIssues(name, domain).length > 0) flagged += 1;
        addRow(name, domain);
        added += 1;
      });
      toast.success(`Parsed ${added} rows from ${file.name}`, {
        description: flagged > 0 ? `${flagged} row${flagged === 1 ? "" : "s"} flagged — fix or remove before running.` : "All rows look valid.",
      });
    };
    reader.readAsText(file);
  }

  function downloadSample() {
    const csv = "company name,domain\nApex Cooling Systems,apexcoolingsystems.com\nNorthgate Precast,northgateprecast.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim() || !manualDomain.trim()) {
      setManualError("Enter both a company name and a domain before adding.");
      return;
    }
    setManualError(null);
    addRow(manualName, manualDomain);
    setManualName("");
    setManualDomain("");
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRowDomain(id: string, domain: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, domain, issues: getRowIssues(r.name, domain) } : r)));
  }

  function updateRowName(id: string, name: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name, issues: getRowIssues(name, r.domain) } : r)));
  }

  const validRows = rows.filter((r) => r.issues.length === 0);
  const issueRows = rows.filter((r) => r.issues.length > 0);
  const selectedIcp = profiles.find((p) => p.id === selectedIcpId) ?? null;

  const queuedCount = queue.filter((c) => c.status === "queued").length;
  const enrichingCount = queue.filter((c) => c.status === "enriching").length;
  const failedInQueueCount = queue.filter((c) => c.status === "failed").length;
  const activeQueueCount = queuedCount + enrichingCount;

  async function runBatch() {
    if (!selectedIcp) return;
    setReviewOpen(false);
    setSubmitting(true);
    setResult(null);

    const payload = {
      icp_name: selectedIcp.icp_name,
      rows: validRows.map((r) => ({ name: r.name, domain: r.domain })),
    };

    try {
      const res = await fetch("/api/import/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setResult({ kind: "error", message: body.error ?? "The batch could not be sent.", details: body.details });
        toast.error("Batch failed", { description: body.error ?? "Check the details below." });
      } else {
        setResult({ kind: "success", raw: body.result });
        toast.success("Enrichment started");
        setRows([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setResult({ kind: "error", message: `Request failed: ${message}` });
      toast.error("Request failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-4 text-muted-foreground" /> Upload a CSV
            </CardTitle>
            <CardDescription>Bulk add. Columns: company name, domain (both required).</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drag and drop a CSV file here</p>
                <p className="text-xs text-muted-foreground">Columns: company name, domain</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet /> Choose file
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={downloadSample}>
                  <Download /> Sample CSV
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4 text-muted-foreground" /> Add manually
            </CardTitle>
            <CardDescription>Single company. The pipeline resolves the rest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualAdd} className="flex h-full flex-col justify-center gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-name">
                  Company name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manual-name"
                  placeholder="e.g. Apex Cooling Systems"
                  value={manualName}
                  onChange={(e) => {
                    setManualName(e.target.value);
                    if (manualError) setManualError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-domain">
                  Domain <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manual-domain"
                  placeholder="e.g. apexcoolingsystems.com"
                  value={manualDomain}
                  onChange={(e) => {
                    setManualDomain(e.target.value);
                    if (manualError) setManualError(null);
                  }}
                />
              </div>
              <Button type="submit">
                <Plus /> Add to batch
              </Button>
              {manualError && <p className="text-center text-xs text-destructive">{manualError}</p>}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ICP profile <span className="text-destructive">*</span>
          </CardTitle>
          <CardDescription>
            Choose the ICP this batch will be scored against. Sector and sub-sector are still assigned
            automatically during classification, but every company in this batch is scored against the one
            profile picked here — a batch can&apos;t run without one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No ICP profiles configured yet — set them up in Model config.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {profiles.map((p) => {
                const selected = p.id === selectedIcpId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedIcpId(p.id)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors",
                      selected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-xs font-bold",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {(p.icp_name || "?").charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.icp_name || "Untitled"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        ICP {p.weight_icp_fit}% · Scale {p.weight_scale_footprint}% · Hiring {p.weight_hiring_growth}% ·
                        Financial {p.weight_financial_viability}%
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5">
              Review & run
              <span className="text-sm font-normal text-muted-foreground">{rows.length} in the queue</span>
              <Badge variant="outline" className="border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {validRows.length} ready
              </Badge>
              {issueRows.length > 0 && (
                <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                  {issueRows.length} flagged
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
              <div className="flex flex-col gap-4">
                {issueRows.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="mb-2 text-sm font-medium text-destructive">Fix the name/domain or remove these before running</p>
                    <div className="flex flex-col gap-2">
                      {issueRows.map((row) => (
                        <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
                          <Input
                            value={row.name}
                            onChange={(e) => updateRowName(row.id, e.target.value)}
                            placeholder="Company name"
                            className="h-8 min-w-32 flex-1"
                          />
                          <Input
                            value={row.domain}
                            onChange={(e) => updateRowDomain(row.id, e.target.value)}
                            placeholder="domain.com"
                            className="h-8 flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={() => removeRow(row.id)}>
                            Remove
                          </Button>
                          <p className="w-full text-xs text-destructive">
                            {row.issues.map((i) => ISSUE_LABEL[i]).join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validRows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border">
                    {validRows.map((row, i) => (
                      <div key={row.id} className={cn("flex items-center gap-2 px-3 py-2", i > 0 && "border-t")}>
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {row.name || <span className="text-muted-foreground italic">Unnamed</span>}
                          <span className="ml-1.5 text-muted-foreground">{row.domain}</span>
                        </span>
                        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeRow(row.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 lg:border-l lg:pl-6">
                <Button
                  className="w-full"
                  disabled={validRows.length === 0 || issueRows.length > 0 || !selectedIcp || submitting}
                  onClick={() => setReviewOpen(true)}
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  Run enrichment
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {issueRows.length > 0
                    ? "Fix the flagged rows to enable the run"
                    : !selectedIcp
                      ? "Choose an ICP profile above to enable the run"
                      : `${validRows.length} row${validRows.length === 1 ? "" : "s"} will be sent`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Enrichment queue</CardTitle>
            <CardDescription>
              {queuedCount} queued · {enrichingCount} enriching · {failedInQueueCount} failed · {scoredThisWeekCount} scored this week
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1.5 border-transparent bg-muted text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", activeQueueCount > 0 ? "bg-primary" : "bg-muted-foreground/40")} />
            {activeQueueCount > 0 ? `${activeQueueCount} in queue` : "Idle — nothing running"}
          </Badge>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing queued right now.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {queue.map((c, i) => (
                <div key={c.id} className={cn("flex items-center justify-between gap-3 px-3 py-2.5", i > 0 && "border-t")}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.domain}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.status === "failed" && <TriageReasonBadge reason={c.triageReason} />}
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start enrichment for this batch?</DialogTitle>
            <DialogDescription>
              This will kick off enrichment for {validRows.length} compan{validRows.length === 1 ? "y" : "ies"},
              scored against <strong>{selectedIcp?.icp_name ?? "the selected ICP"}</strong>. It can take a few
              minutes — you can track progress in the queue below.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runBatch} disabled={!selectedIcp}>
              Start enrichment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.kind === "success" ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> Batch sent
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-destructive" /> Batch failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.kind === "success" ? (
              <p className="text-sm text-muted-foreground">
                Enrichment has started. You can follow progress in the queue below — this can take a few minutes
                per company.
              </p>
            ) : (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{result.message}</AlertTitle>
              </Alert>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Technical details</summary>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border bg-muted/40 p-3">
                {JSON.stringify(result.kind === "success" ? result.raw : result.details, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
