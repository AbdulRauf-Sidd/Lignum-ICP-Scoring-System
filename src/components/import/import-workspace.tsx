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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
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

export function ImportWorkspace() {
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
      <Card>
        <CardHeader>
          <CardTitle>1. Add companies</CardTitle>
          <CardDescription>
            Company name is recommended; domain is mandatory. Each row is checked as you add it — fix or remove
            anything flagged before you can run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="csv">
            <TabsList>
              <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              <TabsTrigger value="manual">Add manually</TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="mt-4">
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center"
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
            </TabsContent>
            <TabsContent value="manual" className="mt-4">
              <form onSubmit={handleManualAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="manual-name">Company name</Label>
                  <Input
                    id="manual-name"
                    placeholder="e.g. Apex Cooling Systems"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Rows to send ({rows.length})</CardTitle>
            <CardDescription>
              {validRows.length} valid · {issueRows.length} flagged for fix or removal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className={!row.name ? "italic text-muted-foreground" : undefined}>
                        {row.name || "—"}
                      </TableCell>
                      <TableCell className={!row.domain ? "italic text-muted-foreground" : undefined}>
                        {row.domain || "—"}
                      </TableCell>
                      <TableCell>
                        {row.issue ? (
                          <Badge variant="outline" className="gap-1 border-transparent bg-destructive/10 text-destructive">
                            <AlertCircle className="size-3" /> {ISSUE_LABEL[row.issue]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" /> Valid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Run</CardTitle>
            <CardDescription>
              Sector and sub-sector are assigned automatically during classification — nothing to pick here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {issueRows.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>
                  {issueRows.length} row{issueRows.length === 1 ? "" : "s"} flagged — fix or remove before running.
                </AlertTitle>
              </Alert>
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
