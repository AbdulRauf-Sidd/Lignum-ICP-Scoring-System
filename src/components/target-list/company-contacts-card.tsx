"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Loader2, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/types";
import type { ContactRow, ContactStatus } from "@/lib/data/contacts";
import { findContacts, bulkRedeemContacts } from "@/app/(dashboard)/contacts/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export function CompanyContactsCard({ company, contacts }: { company: Company; contacts: ContactRow[] }) {
  const router = useRouter();
  const [finding, setFinding] = React.useState(false);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const listedIds = contacts.filter((c) => c.status === "listed").map((c) => c.id);

  async function handleFindContacts() {
    setFinding(true);
    try {
      await findContacts(company.id, company.domain);
      toast.success(`Searching contacts for ${company.name}`, { description: "This can take a moment — refresh to see results." });
      router.refresh();
    } catch (err) {
      toast.error("Failed to find contacts", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setFinding(false);
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
        description: "Refresh in a moment to see revealed emails and phones.",
      });
      router.refresh();
    } catch (err) {
      toast.error("Failed to enrich", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Contacts ({contacts.length})</CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleFindContacts} disabled={finding}>
            {finding ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            Find contacts
          </Button>
          {listedIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => redeem("bulk", contacts.filter((c) => listedIds.includes(c.id)))}
              disabled={pendingKey !== null}
            >
              {pendingKey === "bulk" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Redeem all ({listedIds.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No contacts listed yet — click &quot;Find contacts&quot; to search Cognism for people at {company.name}.
          </p>
        ) : (
          contacts.map((c) => {
            const contactKey = `contact:${c.id}`;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.title}
                    {c.seniority ? ` (${c.seniority})` : ""}
                  </p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {c.email && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="size-3" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {c.phone}
                      </span>
                    )}
                    {!c.email && !c.phone && (
                      <span className="text-xs text-muted-foreground">
                        {c.status === "listed" ? "Redeem to reveal" : "No contact details on file"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status !== "listed" && (
                    <Badge variant="outline" className={cn("gap-1.5 border-transparent text-[10px]", CONTACT_STATUS_STYLES[c.status])}>
                      {c.status === "in_process" && <Loader2 className="size-3 animate-spin" />}
                      {CONTACT_STATUS_LABELS[c.status]}
                    </Badge>
                  )}
                  {c.status === "listed" && (
                    <Button variant="outline" size="sm" onClick={() => redeem(contactKey, [c])} disabled={pendingKey !== null}>
                      {pendingKey === contactKey ? <Loader2 className="size-3.5 animate-spin" /> : "Redeem"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
