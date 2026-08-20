"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Mail, Phone, Search, Sparkles, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { ScoreRing } from "@/components/shared/score-display";
import { TierBadge } from "@/components/shared/badges";
import type { Company } from "@/lib/types";
import type { ContactRow, ContactStatus, DetailSource, EmailQuality } from "@/lib/data/contacts";
import { findContacts, bulkRedeemContacts } from "@/app/(dashboard)/contacts/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SOURCES: DetailSource[] = ["cognism", "syntax_match", "apollo", "prospeo"];

const CONTACT_STATUS_STYLES: Record<ContactStatus, string> = {
  listed: "bg-muted text-muted-foreground",
  in_process: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  redeemed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  listed: "Listed",
  in_process: "In process",
  redeemed: "Redeemed",
  failed: "Failed",
};

export function ContactsWorkspace({ companies, contacts }: { companies: Company[]; contacts: ContactRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyFilter = searchParams.get("company");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = React.useState<"score" | "tier">("score");
  const [qualityFilter, setQualityFilter] = React.useState<"all" | NonNullable<EmailQuality>>("all");
  const [sourceFilter, setSourceFilter] = React.useState<"all" | DetailSource>("all");
  const [findingCompanyId, setFindingCompanyId] = React.useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = React.useState(false);

  const groups = companies
    .filter((c) => !companyFilter || c.id === companyFilter)
    .map((company) => ({
      company,
      contacts: contacts
        .filter((ct) => ct.company_id === company.id)
        .filter((ct) => qualityFilter === "all" || ct.email_quality === qualityFilter)
        .filter((ct) => sourceFilter === "all" || ct.email_source === sourceFilter || ct.phone_source === sourceFilter),
    }))
    .sort((a, b) => {
      if (sortBy === "score") return (b.company.score ?? 0) - (a.company.score ?? 0);
      const tierRank = { A: 0, B: 1, C: 2 } as const;
      return (tierRank[a.company.tier ?? "C"] ?? 3) - (tierRank[b.company.tier ?? "C"] ?? 3);
    });

  const selectableIds = groups.flatMap((g) => g.contacts.filter((c) => c.status === "listed").map((c) => c.id));
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(companyId: string, ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function handleFindContacts(company: Company) {
    setFindingCompanyId(company.id);
    try {
      await findContacts(company.id, company.domain);
      toast.success(`Searching contacts for ${company.name}`, { description: "This can take a moment — refresh to see results." });
      router.refresh();
    } catch (err) {
      toast.error("Failed to find contacts", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setFindingCompanyId(null);
    }
  }

  async function handleBulkRedeem() {
    const selectedContacts = contacts.filter((c) => selected.has(c.id));
    const missingRedeemId = selectedContacts.find((c) => !c.cognism_redeem_id);
    if (missingRedeemId) {
      toast.error("Can't redeem", { description: `${missingRedeemId.name} has no Cognism redeem id on record.` });
      return;
    }

    setIsRedeeming(true);
    try {
      await bulkRedeemContacts(
        selectedContacts.map((c) => ({ contactId: c.id, redeemId: c.cognism_redeem_id as string, companyId: c.company_id })),
      );
      toast.success(`Redeeming ${selectedContacts.length} contact${selectedContacts.length === 1 ? "" : "s"}`, {
        description: "Refresh in a moment to see revealed emails and phones.",
      });
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error("Failed to redeem contacts", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsRedeeming(false);
    }
  }

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sort groups by</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "score" | "tier")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email quality</Label>
            <Select value={qualityFilter} onValueChange={(v) => setQualityFilter(v as typeof qualityFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {companyFilter && (
            <Badge variant="outline" className="gap-1.5">
              Filtered to one company
              <a href="/contacts" className="ml-1">
                <X className="size-3" />
              </a>
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all" />
              <Label htmlFor="select-all" className="text-sm font-normal text-muted-foreground">
                Select all ({selectableIds.length})
              </Label>
            </div>
            <Button onClick={handleBulkRedeem} disabled={selected.size === 0 || isRedeeming}>
              {isRedeeming ? <Loader2 className="size-4 animate-spin" /> : <Sparkles />}
              Bulk enrich ({selected.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        {groups.map(({ company, contacts: groupContacts }) => {
          const ids = groupContacts.filter((c) => c.status === "listed").map((c) => c.id);
          const groupAllSelected = ids.length > 0 && ids.every((id) => selected.has(id));
          const isFinding = findingCompanyId === company.id;
          return (
            <Card key={company.id}>
              <CardContent className="pt-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ids.length > 0 && (
                      <Checkbox checked={groupAllSelected} onCheckedChange={() => toggleGroup(company.id, ids)} />
                    )}
                    <ScoreRing score={company.score} size={34} />
                    <div>
                      <p className="text-sm font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.sector} · {company.subSector}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleFindContacts(company)} disabled={isFinding}>
                      {isFinding ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                      Find contacts
                    </Button>
                    <TierBadge tier={company.tier} />
                  </div>
                </div>
                {groupContacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No contacts yet — click &quot;Find contacts&quot; to search Cognism for people at {company.name}.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupContacts.map((ct) => (
                          <TableRow key={ct.id}>
                            <TableCell>
                              {ct.status === "listed" && (
                                <Checkbox checked={selected.has(ct.id)} onCheckedChange={() => toggleOne(ct.id)} />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{ct.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {ct.title}
                              {ct.seniority && <span className="ml-1.5 text-xs">({ct.seniority})</span>}
                            </TableCell>
                            <TableCell>
                              {ct.email ? (
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Mail className="size-3.5 text-muted-foreground" /> {ct.email}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Redeem to reveal</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {ct.phone ? (
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Phone className="size-3.5 text-muted-foreground" /> {ct.phone}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn("gap-1.5 border-transparent", CONTACT_STATUS_STYLES[ct.status])}
                              >
                                {ct.status === "in_process" && <Loader2 className="size-3 animate-spin" />}
                                {CONTACT_STATUS_LABELS[ct.status]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {groups.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No scored companies yet — contacts show up here once a company is approved to the target list.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
