"use client";

import * as React from "react";
import {
  UploadCloud,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ICP_PROFILES, COMPANIES } from "@/lib/mock/data";
import { StatusBadge } from "@/components/shared/badges";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StagedRow {
  id: string;
  name: string;
  domain: string;
  issue: "missing_name" | "missing_domain" | "malformed_domain" | null;
}

type LiveStatus = "queued" | "enriching" | "triage" | "scored" | "failed" | "insufficient_data";

interface LiveCompany {
  id: string;
  name: string;
  domain: string;
  status: LiveStatus;
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function validateRow(name: string, domain: string): StagedRow["issue"] {
  if (!name.trim()) return "missing_name";
  if (!domain.trim()) return "missing_domain";
  if (!DOMAIN_RE.test(domain.trim())) return "malformed_domain";
  return null;
}

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return `row-${Date.now()}-${rowIdCounter}`;
}

const ISSUE_LABEL: Record<NonNullable<StagedRow["issue"]>, string> = {
  missing_name: "Missing company name",
  missing_domain: "Missing domain",
  malformed_domain: "Malformed domain",
};

const inFlightCompanies = COMPANIES.filter((c) => c.status === "queued" || c.status === "enriching").slice(0, 8);

export function ImportWorkspace() {
  const [rows, setRows] = React.useState<StagedRow[]>([]);
  const [manualName, setManualName] = React.useState("");
  const [manualDomain, setManualDomain] = React.useState("");
  const [icp, setIcp] = React.useState<string>("");
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [liveCompanies, setLiveCompanies] = React.useState<LiveCompany[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r.issue === null);
  const issueRows = rows.filter((r) => r.issue !== null);

  function addRow(name: string, domain: string) {
    setRows((prev) => [...prev, { id: nextRowId(), name, domain, issue: validateRow(name, domain) }]);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let added = 0;
      lines.forEach((line, idx) => {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (idx === 0 && /company|domain|name/i.test(line)) return; // header row
        const [name = "", domain = ""] = cells;
        if (!name && !domain) return;
        addRow(name, domain);
        added += 1;
      });
      toast.success(`Imported ${added} rows from ${file.name}`);
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
    if (!manualName.trim() && !manualDomain.trim()) return;
    addRow(manualName, manualDomain);
    setManualName("");
    setManualDomain("");
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const readyEstimate = Math.max(0, Math.round(validRows.length * 0.78));
  const skippedEstimate = validRows.length - readyEstimate;

  function startRun() {
    setReviewOpen(false);
    const live: LiveCompany[] = validRows.map((r) => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      status: "queued",
    }));
    setLiveCompanies(live);
    setRows([]);

    live.forEach((c, i) => {
      const startDelay = 400 + i * 220;
      window.setTimeout(() => {
        setLiveCompanies((prev) => prev?.map((x) => (x.id === c.id ? { ...x, status: "enriching" } : x)) ?? prev);
      }, startDelay);

      window.setTimeout(() => {
        const roll = Math.random();
        const final: LiveStatus =
          roll < 0.15
            ? "insufficient_data"
            : roll < 0.28
              ? "triage"
              : roll < 0.34
                ? "failed"
                : "scored";
        setLiveCompanies((prev) => prev?.map((x) => (x.id === c.id ? { ...x, status: final } : x)) ?? prev);
      }, startDelay + 1400 + i * 90);
    });
  }

  const liveDone = liveCompanies?.every((c) => c.status !== "queued" && c.status !== "enriching") ?? false;
  const liveProgress = liveCompanies
    ? Math.round(
        (liveCompanies.filter((c) => c.status !== "queued" && c.status !== "enriching").length /
          liveCompanies.length) *
          100,
      )
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Add companies</CardTitle>
          <CardDescription>Company name is recommended; domain is mandatory.</CardDescription>
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
            <CardTitle>2. Staged rows</CardTitle>
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
                      <TableCell className={cn(!row.name.trim() && "italic text-muted-foreground")}>
                        {row.name.trim() || "—"}
                      </TableCell>
                      <TableCell className={cn(!row.domain.trim() && "italic text-muted-foreground")}>
                        {row.domain.trim() || "—"}
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
            <CardTitle>3. Select ICP & run</CardTitle>
            <CardDescription>An ICP is required for the whole batch before it can run.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {issueRows.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Fix or remove flagged rows</AlertTitle>
                <AlertDescription>
                  {issueRows.length} row{issueRows.length === 1 ? "" : "s"} cannot run until fixed or removed.
                </AlertDescription>
              </Alert>
            )}
            <div className="max-w-xs space-y-1.5">
              <Label>ICP for this batch</Label>
              <Select value={icp} onValueChange={setIcp}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an ICP" />
                </SelectTrigger>
                <SelectContent>
                  {ICP_PROFILES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                disabled={!icp || validRows.length === 0 || issueRows.length > 0}
                onClick={() => setReviewOpen(true)}
              >
                Review run ({validRows.length} companies)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm this run</DialogTitle>
            <DialogDescription>
              The validation gate checks each company with a free Cognism enrich call before any paid redeem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <ReviewStat label="Companies to process" value={validRows.length} />
            <ReviewStat label="Estimated ready" value={readyEstimate} />
            <ReviewStat label="Estimated skipped" value={skippedEstimate} sublabel="insufficient data" />
            <ReviewStat label="Creditsafe reports" value={readyEstimate} sublabel="native units only" />
          </div>
          <p className="text-xs text-muted-foreground">
            Cognism credits: up to {readyEstimate} (worst case one per company). No cost figure is shown, as
            real cost depends on your contract and bundles.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startRun}>Run batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {liveCompanies && (
        <Card>
          <CardHeader>
            <CardTitle>Run status</CardTitle>
            <CardDescription>
              {liveDone ? "Run complete." : "Processing — statuses update live."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Progress value={liveProgress} className="flex-1" />
              <span className="text-sm tabular-nums text-muted-foreground">{liveProgress}%</span>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveCompanies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.domain}</TableCell>
                      <TableCell>
                        <LiveStatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>In-flight from previous runs</CardTitle>
          <CardDescription>Companies already queued or enriching before this session.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Imported by</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inFlightCompanies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.sector}</TableCell>
                    <TableCell className="text-muted-foreground">{c.importedBy}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewStat({ label, value, sublabel }: { label: string; value: number; sublabel?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

const LIVE_STATUS_STYLES: Record<LiveStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  enriching: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  triage: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  scored: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
  insufficient_data: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  queued: "Queued",
  enriching: "Enriching",
  triage: "In triage",
  scored: "Scored",
  failed: "Failed",
  insufficient_data: "Skipped — insufficient data",
};

function LiveStatusBadge({ status }: { status: LiveStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", LIVE_STATUS_STYLES[status])}>
      {(status === "queued" || status === "enriching") && <Loader2 className="size-3 animate-spin" />}
      {LIVE_STATUS_LABELS[status]}
    </Badge>
  );
}
