"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SCORE_CATEGORY_LABELS } from "@/lib/constants";
import type { IcpProfileRow, SectorTaxonomyRow } from "@/lib/data/icp-profiles";
import { saveIcpProfile, deleteIcpProfile, setSectorTaxonomyActive } from "@/app/(dashboard)/admin/config/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WEIGHT_KEYS = [
  "weight_icp_fit",
  "weight_scale_footprint",
  "weight_hiring_growth",
  "weight_financial_viability",
] as const;

const CATEGORY_LABEL_BY_WEIGHT_KEY: Record<(typeof WEIGHT_KEYS)[number], string> = {
  weight_icp_fit: SCORE_CATEGORY_LABELS.icp_fit,
  weight_scale_footprint: SCORE_CATEGORY_LABELS.scale_footprint,
  weight_hiring_growth: SCORE_CATEGORY_LABELS.hiring_growth,
  weight_financial_viability: SCORE_CATEGORY_LABELS.financial_viability,
};

type Draft = Omit<IcpProfileRow, "id"> & { id: string | null; clientKey: string };

function rowToDraft(row: IcpProfileRow): Draft {
  return { ...row, clientKey: row.id };
}

function blankDraft(): Draft {
  const clientKey = `new-${Math.random().toString(36).slice(2)}`;
  return {
    id: null,
    clientKey,
    icp_name: "New ICP",
    weight_icp_fit: 25,
    weight_scale_footprint: 25,
    weight_hiring_growth: 25,
    weight_financial_viability: 25,
    target_sectors: [],
    revenue_bands_usd: "[]",
    headcount_bands: "[]",
    fit_rules: "[]",
  };
}

export function ConfigWorkspace({
  profiles,
  taxonomy,
}: {
  profiles: IcpProfileRow[];
  taxonomy: SectorTaxonomyRow[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() => profiles.map(rowToDraft));
  const [activeTab, setActiveTab] = React.useState<string>(drafts[0]?.clientKey ?? "");
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [pendingSectorId, setPendingSectorId] = React.useState<string | null>(null);

  // Reset local drafts when the server gives us fresh rows (after a
  // save/delete triggers revalidatePath + router.refresh()) — adjusting
  // state during render rather than in an effect avoids an extra render pass.
  const [syncedProfiles, setSyncedProfiles] = React.useState(profiles);
  if (profiles !== syncedProfiles) {
    setSyncedProfiles(profiles);
    setDrafts(profiles.map(rowToDraft));
  }

  const distinctSectors = React.useMemo(
    () => Array.from(new Set(taxonomy.map((t) => t.sector))),
    [taxonomy],
  );

  function updateDraft(clientKey: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.clientKey === clientKey ? { ...d, ...patch } : d)));
  }

  function sumFor(draft: Draft) {
    return WEIGHT_KEYS.reduce((sum, k) => sum + (draft[k] || 0), 0);
  }

  function addProfile() {
    const draft = blankDraft();
    setDrafts((prev) => [...prev, draft]);
    setActiveTab(draft.clientKey);
  }

  function toggleSector(clientKey: string, sector: string, checked: boolean) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.clientKey !== clientKey) return d;
        const next = checked ? Array.from(new Set([...d.target_sectors, sector])) : d.target_sectors.filter((s) => s !== sector);
        return { ...d, target_sectors: next };
      }),
    );
  }

  function jsonIsValid(value: string) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  async function save(draft: Draft) {
    const sum = sumFor(draft);
    if (sum !== 100) {
      toast.error("Weights must sum to 100", { description: `${draft.icp_name} currently sums to ${sum}.` });
      return;
    }
    for (const [label, value] of [
      ["Revenue bands", draft.revenue_bands_usd],
      ["Headcount bands", draft.headcount_bands],
      ["Fit rules", draft.fit_rules],
    ] as const) {
      if (!jsonIsValid(value)) {
        toast.error(`${label} is not valid JSON`);
        return;
      }
    }

    setPendingKey(draft.clientKey);
    try {
      const { id } = await saveIcpProfile({
        id: draft.id,
        icp_name: draft.icp_name,
        weight_icp_fit: draft.weight_icp_fit,
        weight_scale_footprint: draft.weight_scale_footprint,
        weight_hiring_growth: draft.weight_hiring_growth,
        weight_financial_viability: draft.weight_financial_viability,
        target_sectors: draft.target_sectors,
        revenue_bands_usd: draft.revenue_bands_usd,
        headcount_bands: draft.headcount_bands,
        fit_rules: draft.fit_rules,
      });
      toast.success(`${draft.icp_name} saved`, { description: "Applies on next score or re-score." });
      if (!draft.id) setActiveTab(id);
      router.refresh();
    } catch (err) {
      toast.error("Failed to save ICP profile", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPendingKey(null);
    }
  }

  async function remove(draft: Draft) {
    if (!draft.id) {
      // Never saved — just drop the local draft.
      setDrafts((prev) => prev.filter((d) => d.clientKey !== draft.clientKey));
      setActiveTab((cur) => (cur === draft.clientKey ? (drafts[0]?.clientKey ?? "") : cur));
      return;
    }
    if (!window.confirm(`Delete ${draft.icp_name}? This can't be undone.`)) return;

    setPendingKey(draft.clientKey);
    try {
      await deleteIcpProfile(draft.id);
      toast.success(`${draft.icp_name} deleted`);
      router.refresh();
    } catch (err) {
      toast.error("Failed to delete ICP profile", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPendingKey(null);
    }
  }

  async function toggleActive(row: SectorTaxonomyRow, active: boolean) {
    setPendingSectorId(row.id);
    try {
      await setSectorTaxonomyActive(row.id, active);
      router.refresh();
    } catch (err) {
      toast.error("Failed to update sector taxonomy", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPendingSectorId(null);
    }
  }

  const taxonomyBySector = React.useMemo(() => {
    const map = new Map<string, SectorTaxonomyRow[]>();
    for (const row of taxonomy) {
      const list = map.get(row.sector) ?? [];
      list.push(row);
      map.set(row.sector, list);
    }
    return map;
  }, [taxonomy]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Per-ICP weights</CardTitle>
            <CardDescription>Weights must sum to 100 for each ICP before saving.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addProfile}>
            <Plus className="size-4" /> New ICP profile
          </Button>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No ICP profiles yet. Add one to start scoring against real weights.
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap">
                {drafts.map((d) => (
                  <TabsTrigger key={d.clientKey} value={d.clientKey}>
                    {d.icp_name || "Untitled"}
                    {!d.id && (
                      <Badge variant="outline" className="ml-1.5 border-transparent bg-muted px-1 text-[10px]">
                        new
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {drafts.map((d) => {
                const sum = sumFor(d);
                const valid = sum === 100;
                const isPending = pendingKey === d.clientKey;
                return (
                  <TabsContent key={d.clientKey} value={d.clientKey} className="mt-4 flex flex-col gap-5">
                    <div className="space-y-1.5">
                      <Label>ICP name</Label>
                      <Input
                        value={d.icp_name}
                        onChange={(e) => updateDraft(d.clientKey, { icp_name: e.target.value })}
                        disabled={isPending}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {WEIGHT_KEYS.map((key) => (
                        <div key={key} className="space-y-1.5">
                          <Label>{CATEGORY_LABEL_BY_WEIGHT_KEY[key]}</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={d[key]}
                              onChange={(e) => updateDraft(d.clientKey, { [key]: Number(e.target.value) } as Partial<Draft>)}
                              className="pr-8"
                              disabled={isPending}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label>Target sectors</Label>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {distinctSectors.map((sector) => (
                          <label key={sector} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={d.target_sectors.includes(sector)}
                              onCheckedChange={(checked) => toggleSector(d.clientKey, sector, checked === true)}
                              disabled={isPending}
                            />
                            {sector}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Revenue bands (JSON)</Label>
                        <Textarea
                          value={d.revenue_bands_usd}
                          onChange={(e) => updateDraft(d.clientKey, { revenue_bands_usd: e.target.value })}
                          className="min-h-32 font-mono text-xs"
                          disabled={isPending}
                        />
                        {!jsonIsValid(d.revenue_bands_usd) && (
                          <p className="text-xs text-destructive">Not valid JSON.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Headcount bands (JSON)</Label>
                        <Textarea
                          value={d.headcount_bands}
                          onChange={(e) => updateDraft(d.clientKey, { headcount_bands: e.target.value })}
                          className="min-h-32 font-mono text-xs"
                          disabled={isPending}
                        />
                        {!jsonIsValid(d.headcount_bands) && (
                          <p className="text-xs text-destructive">Not valid JSON.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fit rules (JSON)</Label>
                        <Textarea
                          value={d.fit_rules}
                          onChange={(e) => updateDraft(d.clientKey, { fit_rules: e.target.value })}
                          className="min-h-32 font-mono text-xs"
                          disabled={isPending}
                        />
                        {!jsonIsValid(d.fit_rules) && <p className="text-xs text-destructive">Not valid JSON.</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 border-transparent",
                          valid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {valid ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                        Sum: {sum} / 100
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => remove(d)} disabled={isPending}>
                          <Trash2 className="size-4" /> Delete
                        </Button>
                        <Button onClick={() => save(d)} disabled={!valid || isPending}>
                          {isPending && <Loader2 className="size-4 animate-spin" />}
                          Save {d.icp_name || "profile"}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sector taxonomy</CardTitle>
          <CardDescription>Inactive sub-sectors are excluded from classification going forward.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {Array.from(taxonomyBySector.entries()).map(([sector, rows], i) => (
            <div key={sector}>
              {i > 0 && <Separator className="mb-5" />}
              <p className="mb-2 text-sm font-medium">{sector}</p>
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                    <span className={cn("text-sm", !row.active && "text-muted-foreground line-through")}>
                      {row.sub_sector}
                    </span>
                    <Switch
                      checked={row.active}
                      onCheckedChange={(checked) => toggleActive(row, checked)}
                      disabled={pendingSectorId === row.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {taxonomyBySector.size === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No sector taxonomy configured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
