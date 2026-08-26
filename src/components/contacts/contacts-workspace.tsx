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
import { Label } from "@/components/ui/label";
import { TierBadge, SectorBadge } from "@/components/shared/badges";
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

const AVATAR_STYLES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % mod;
}

function Avatar({ id, name, className }: { id: string; name: string; className?: string }) {
  const style = AVATAR_STYLES[hashIndex(id, AVATAR_STYLES.length)];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md text-xs font-bold", style, className)}>
      {initials(name)}
    </span>
  );
}

// `seniority` is unpopulated on every real contact today — inferred from the
// real job title instead of leaving the pill blank everywhere.
function deriveSeniority(title: string | null): string | null {
  if (!title) return null;
  if (/\b(chief|chef|ceo|cfo|coo|cto|cmo|president|founder|owner|partner)\b/i.test(title)) return "C-Suite";
  if (/\bvice president|\bvp\b/i.test(title)) return "VP";
  if (/\bhead of\b/i.test(title)) return "Head";
  if (/\bdirector\b/i.test(title)) return "Director";
  if (/\bmanager\b/i.test(title)) return "Manager";
  return null;
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ContactsWorkspace({ companies, contacts }: { companies: Company[]; contacts: ContactRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyFilter = searchParams.get("company");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = React.useState<"score" | "tier" | "name">("score");
  const [qualityFilter, setQualityFilter] = React.useState<"all" | NonNullable<EmailQuality>>("all");
  const [sourceFilter, setSourceFilter] = React.useState<"all" | DetailSource>("all");
  const [findingCompanyId, setFindingCompanyId] = React.useState<string | null>(null);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

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
      if (sortBy === "name") return a.company.name.localeCompare(b.company.name);
      if (sortBy === "score") return (b.company.score ?? 0) - (a.company.score ?? 0);
      const tierRank = { A: 0, B: 1, C: 2 } as const;
      return (tierRank[a.company.tier ?? "C"] ?? 3) - (tierRank[b.company.tier ?? "C"] ?? 3);
    });

  const selectableIds = groups.flatMap((g) => g.contacts.filter((c) => c.status === "listed").map((c) => c.id));
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const allContacts = companyFilter ? contacts.filter((c) => c.company_id === companyFilter) : contacts;
  const enrichedCount = allContacts.filter((c) => c.status === "redeemed").length;

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
      toast.success(`Searching contacts for ${company.name}`, { description: "This can take a moment to complete." });
      router.refresh();
    } catch (err) {
      toast.error("Failed to find contacts", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setFindingCompanyId(null);
    }
  }

  async function redeem(key: string, items: ContactRow[]) {
    const missingRedeemId = items.find((c) => !c.cognism_redeem_id);
    if (missingRedeemId) {
      toast.error("Can't enrich", { description: `${missingRedeemId.name} has no Cognism redeem id on record.` });
      return;
    }
    setPendingKey(key);
    try {
      await bulkRedeemContacts(items.map((c) => ({ contactId: c.id, redeemId: c.cognism_redeem_id as string, companyId: c.company_id })));
      toast.success(`Enriching ${items.length} contact${items.length === 1 ? "" : "s"}`, {
        description: "Revealed emails and phones will appear automatically once it's done.",
      });
      setSelected((prev) => {
        const next = new Set(prev);
        items.forEach((c) => next.delete(c.id));
        return next;
      });
      router.refresh();
    } catch (err) {
      toast.error("Failed to enrich", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Sort</span>
          <PillGroup
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "score", label: "Score" },
              { value: "tier", label: "Tier" },
              { value: "name", label: "Name" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Email quality</span>
          <PillGroup
            value={qualityFilter}
            onChange={setQualityFilter}
            options={[
              { value: "all", label: "All" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger className="h-8 w-36">
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
          <span className="text-xs text-muted-foreground">
            {enrichedCount} of {allContacts.length} enriched
          </span>
          <div className="flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all" />
            <Label htmlFor="select-all" className="text-sm font-normal text-muted-foreground">
              Select all ({selectableIds.length})
            </Label>
          </div>
          <Button
            onClick={() => redeem("bulk", contacts.filter((c) => selected.has(c.id)))}
            disabled={selected.size === 0 || pendingKey !== null}
          >
            {pendingKey === "bulk" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles />}
            Enrich selected ({selected.size})
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map(({ company, contacts: groupContacts }) => {
          const ids = groupContacts.filter((c) => c.status === "listed").map((c) => c.id);
          const groupAllSelected = ids.length > 0 && ids.every((id) => selected.has(id));
          const isFinding = findingCompanyId === company.id;
          const groupEnrichedCount = groupContacts.filter((c) => c.status === "redeemed").length;
          const groupKey = `group:${company.id}`;
          return (
            <Card key={company.id}>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar id={company.id} name={company.name} className="size-9 text-sm" />
                    <div>
                      <p className="text-base font-semibold">{company.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <TierBadge tier={company.tier} />
                        <span className="text-xs text-muted-foreground">
                          score {company.score !== null ? Math.round(company.score) : "—"}
                        </span>
                        <SectorBadge sector={company.sector} className="text-[11px]" />
                        <span className="text-xs text-muted-foreground">{company.subSector}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {groupContacts.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {groupEnrichedCount} of {groupContacts.length} enriched
                      </span>
                    )}
                    {ids.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => toggleGroup(company.id, ids)}>
                        {groupAllSelected ? "Deselect group" : "Select group"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleFindContacts(company)} disabled={isFinding}>
                      {isFinding ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                      Find contacts
                    </Button>
                    {ids.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => redeem(groupKey, groupContacts.filter((c) => ids.includes(c.id)))}
                        disabled={pendingKey !== null}
                      >
                        {pendingKey === groupKey ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                        Enrich all
                      </Button>
                    )}
                  </div>
                </div>
                {groupContacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No contacts yet — click &quot;Find contacts&quot; to search Cognism for people at {company.name}.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    {groupContacts.map((ct, i) => {
                      const contactKey = `contact:${ct.id}`;
                      const seniority = ct.seniority ?? deriveSeniority(ct.title);
                      return (
                        <div
                          key={ct.id}
                          className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3.5", i > 0 && "border-t")}
                        >
                          <div className="w-5 shrink-0">
                            {ct.status === "listed" && (
                              <Checkbox checked={selected.has(ct.id)} onCheckedChange={() => toggleOne(ct.id)} />
                            )}
                          </div>
                          <div className="flex min-w-56 flex-1 items-center gap-2.5">
                            <Avatar id={ct.id} name={ct.name} className="size-8 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{ct.name}</p>
                              <p className="text-xs text-muted-foreground">{ct.title}</p>
                            </div>
                          </div>
                          {seniority && (
                            <Badge variant="outline" className="shrink-0 text-[10px] font-medium text-muted-foreground">
                              {seniority}
                            </Badge>
                          )}
                          <div className="min-w-40 flex-1">
                            {ct.email ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <Mail className="size-3.5 text-muted-foreground" /> {ct.email}
                              </span>
                            ) : ct.status === "listed" ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="size-3.5" /> •••••@{company.domain}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="size-3.5" /> — no email on file
                              </span>
                            )}
                          </div>
                          <div className="w-36 shrink-0">
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="size-3.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">DIR</span>
                              {ct.phone ? (
                                ct.phone
                              ) : ct.status === "listed" ? (
                                <span className="text-muted-foreground">••• ••• ••••</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="size-3.5 opacity-0" />
                              <span className="text-[10px]">MOB</span> —
                            </span>
                          </div>
                          {ct.status !== "listed" && (
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 gap-1.5 border-transparent", CONTACT_STATUS_STYLES[ct.status])}
                            >
                              {ct.status === "in_process" && <Loader2 className="size-3 animate-spin" />}
                              {CONTACT_STATUS_LABELS[ct.status]}
                            </Badge>
                          )}
                          <div className="w-20 shrink-0 text-right">
                            {ct.status === "listed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => redeem(contactKey, [ct])}
                                disabled={pendingKey !== null}
                              >
                                {pendingKey === contactKey ? <Loader2 className="size-3.5 animate-spin" /> : "Enrich"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
