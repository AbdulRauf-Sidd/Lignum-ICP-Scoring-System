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
import { StatusBadge } from "@/components/shared/badges";
import type { FlaggedCompany } from "@/lib/data/companies";
import type { IcpProfileRow } from "@/lib/data/icp-profiles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RowIssue = "missing_domain" | "malformed_domain" | null;

interface Row {
  id: string;
  name: string;
  domain: string;
  issue: RowIssue;
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function validateDomain(domain: string): RowIssue {
  if (!domain.trim()) return "missing_domain";
  if (!DOMAIN_RE.test(domain.trim())) return "malformed_domain";
  return null;
}

const ISSUE_LABEL: Record<NonNullable<RowIssue>, string> = {
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

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className={`text-2xl font-semibold leading-none ${tone ?? ""}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

export function ImportWorkspace({
  inProgressCount,
  failedCount,
  scoredThisWeekCount,
  queue,
  profiles,
}: {
  inProgressCount: number;
  failedCount: number;
  scoredThisWeekCount: number;
  queue: FlaggedCompany[];
  profiles: IcpProfileRow[];
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [manualName, setManualName] = React.useState("");
  const [manualDomain, setManualDomain] = React.useState("");
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function addRow(name: string, domain: string) {
    if (!name.trim() && !domain.trim()) return;
    const trimmedDomain = domain.trim();
    setRows((prev) => [
      ...prev,
      { id: nextRowId(), name: name.trim(), domain: trimmedDomain, issue: validateDomain(trimmedDomain) },
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
        if (validateDomain(domain)) flagged += 1;
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
    addRow(manualName, manualDomain);
    setManualName("");
    setManualDomain("");
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRowDomain(id: string, domain: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, domain, issue: validateDomain(domain) } : r)));
  }

  const validRows = rows.filter((r) => r.issue === null);
  const issueRows = rows.filter((r) => r.issue !== null);

  async function runBatch() {
    setReviewOpen(false);
    setSubmitting(true);
    setResult(null);

    const payload = {
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
        toast.success("Batch sent to n8n");
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="In progress" value={inProgressCount} tone="text-primary" />
        <StatTile label="Failed" value={failedCount} tone={failedCount > 0 ? "text-destructive" : undefined} />
        <StatTile label="Scored this week" value={scoredThisWeekCount} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>Columns: company name, domain. Each row is checked as you add it.</CardDescription>
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
            <CardTitle>Add manually</CardTitle>
            <CardDescription>Domain is mandatory; company name is recommended.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualAdd} className="flex h-full flex-col justify-center gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-name">Company name</Label>
                <Input
                  id="manual-name"
                  placeholder="e.g. Apex Cooling Systems"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-domain">Domain</Label>
                <Input
                  id="manual-domain"
                  placeholder="e.g. apexcoolingsystems.com"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                />
              </div>
              <Button type="submit">
                <Plus /> Add company
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ICP profiles</CardTitle>
          <CardDescription>
            Sector and sub-sector are assigned automatically during classification — every company is scored
            against whichever of these it best fits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No ICP profiles configured yet — set them up in Model config.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-heading text-xs font-bold text-muted-foreground">
                    {(p.icp_name || "?").charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.icp_name || "Untitled"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.target_sectors.length > 0 ? p.target_sectors.join(", ") : "No target sectors set"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & run</CardTitle>
            <CardDescription>
              {rows.length} in this batch · {validRows.length} ready · {issueRows.length} flagged
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {issueRows.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="mb-2 text-sm font-medium text-destructive">Fix the domain or remove these before running</p>
                <div className="flex flex-col gap-2">
                  {issueRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
                      <div className="min-w-32">
                        <p className={cn("text-sm", !row.name && "text-muted-foreground italic")}>{row.name || "—"}</p>
                        <p className="text-xs text-destructive">{ISSUE_LABEL[row.issue as NonNullable<RowIssue>]}</p>
                      </div>
                      <Input
                        value={row.domain}
                        onChange={(e) => updateRowDomain(row.id, e.target.value)}
                        placeholder="domain.com"
                        className="h-8 flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => removeRow(row.id)}>
                        Remove
                      </Button>
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

            <div>
              <Button
                disabled={validRows.length === 0 || issueRows.length > 0 || submitting}
                onClick={() => setReviewOpen(true)}
              >
                {submitting && <Loader2 className="animate-spin" />}
                Upload & run ({validRows.length} rows)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Enrichment queue</CardTitle>
            <CardDescription>Companies currently queued, enriching, or failed.</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1.5 border-transparent bg-muted text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", queue.length > 0 ? "bg-primary" : "bg-muted-foreground/40")} />
            {queue.length > 0 ? `${queue.length} in queue` : "Idle — nothing running"}
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
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this batch to n8n?</DialogTitle>
            <DialogDescription>
              {validRows.length} validated row{validRows.length === 1 ? "" : "s"} will be sent as JSON to run the
              enrichment pipeline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runBatch}>Upload & run</Button>
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
            {result.kind === "error" && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{result.message}</AlertTitle>
              </Alert>
            )}
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Raw response from n8n</p>
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                {JSON.stringify(result.kind === "success" ? result.raw : result.details, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
