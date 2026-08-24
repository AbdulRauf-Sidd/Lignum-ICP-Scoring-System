"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SCORE_CATEGORY_LABELS } from "@/lib/constants";
import { formatUsdCompact, formatNumber } from "@/lib/format";
import type { IcpProfileRow, SectorTaxonomyRow } from "@/lib/data/icp-profiles";
import type { ModelSettingsRow } from "@/lib/data/model-settings";
import {
  saveIcpProfile,
  deleteIcpProfile,
  setSectorTaxonomyActive,
  saveModelSettings,
  type ModelSettingsInput,
} from "@/app/(dashboard)/admin/config/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WEIGHT_KEYS = [
  "weight_icp_fit",
  "weight_scale_footprint",
  "weight_hiring_growth",
  "weight_financial_viability",
] as const;

type WeightKey = (typeof WEIGHT_KEYS)[number];

const CATEGORY_LABEL_BY_WEIGHT_KEY: Record<WeightKey, string> = {
  weight_icp_fit: SCORE_CATEGORY_LABELS.icp_fit,
  weight_scale_footprint: SCORE_CATEGORY_LABELS.scale_footprint,
  weight_hiring_growth: SCORE_CATEGORY_LABELS.hiring_growth,
  weight_financial_viability: SCORE_CATEGORY_LABELS.financial_viability,
};

const WEIGHT_COLORS: Record<WeightKey, string> = {
  weight_icp_fit: "var(--primary)",
  weight_scale_footprint: "#10b981",
  weight_hiring_growth: "#0ea5e9",
  weight_financial_viability: "#8b5cf6",
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

interface Band {
  min: number;
  max: number;
  score: number;
}

function parseBands(json: string): Band[] | null {
  try {
    const val = JSON.parse(json);
    if (!Array.isArray(val)) return null;
    if (!val.every((b) => b && typeof b === "object" && typeof b.min === "number" && typeof b.max === "number" && typeof b.score === "number")) {
      return null;
    }
    return val as Band[];
  } catch {
    return null;
  }
}

function formatBandLabel(band: Band, index: number, arr: Band[], kind: "currency" | "number"): string {
  const fmt = (n: number) => (kind === "currency" ? formatUsdCompact(n) : formatNumber(n));
  if (index === arr.length - 1 && band.max >= 1_000_000_000) return `${fmt(band.min)} and above`;
  if (index === 0 && band.min === 0) return `Below ${fmt(band.max)}`;
  return `${fmt(band.min)} – ${fmt(band.max)}`;
}

function BandEditor({
  label,
  hint,
  value,
  onChange,
  disabled,
  kind,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  kind: "currency" | "number";
}) {
  const bands = parseBands(value);

  function updateBand(index: number, patch: Partial<Band>) {
    if (!bands) return;
    onChange(JSON.stringify(bands.map((b, i) => (i === index ? { ...b, ...patch } : b))));
  }

  function removeBand(index: number) {
    if (!bands) return;
    onChange(JSON.stringify(bands.filter((_, i) => i !== index)));
  }

  function addBand() {
    const base = bands ?? [];
    const last = base[base.length - 1];
    onChange(JSON.stringify([...base, { min: last?.max ?? 0, max: (last?.max ?? 0) + 1_000_000, score: 50 }]));
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {bands === null ? (
        <div className="space-y-1.5">
          <textarea
            className="min-h-24 w-full rounded-md border bg-transparent p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-destructive">Not a valid band list — editing as raw JSON.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {bands.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">No bands yet.</p>}
          {bands.map((band, i) => (
            <div key={i} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", i > 0 && "border-t")}>
              <div className="flex flex-1 items-center gap-1.5">
                <Input
                  type="number"
                  className="h-8 w-24"
                  value={band.min}
                  disabled={disabled}
                  onChange={(e) => updateBand(i, { min: Number(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  className="h-8 w-24"
                  value={band.max}
                  disabled={disabled}
                  onChange={(e) => updateBand(i, { max: Number(e.target.value) })}
                />
                <span className="ml-1 text-xs text-muted-foreground">{formatBandLabel(band, i, bands, kind)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-16"
                  value={band.score}
                  disabled={disabled}
                  onChange={(e) => updateBand(i, { score: Number(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">score</span>
                <Button variant="ghost" size="icon" className="size-8" disabled={disabled} onClick={() => removeBand(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={addBand}
          >
            <Plus className="size-3.5" /> Add band
          </button>
        </div>
      )}
    </div>
  );
}

function toSettingsInput(row: ModelSettingsRow): ModelSettingsInput {
  return {
    tier_a_min: row.tier_a_min,
    tier_b_min: row.tier_b_min,
    contact_pull_on_demand: row.contact_pull_on_demand,
    indicative_price_per_credit: row.indicative_price_per_credit,
    re_pull_after_days: row.re_pull_after_days,
    gbp_to_usd_rate: row.gbp_to_usd_rate,
    eur_to_usd_rate: row.eur_to_usd_rate,
    health_weight_qualitative: row.health_weight_qualitative,
    health_weight_talent: row.health_weight_talent,
    health_weight_adverse: row.health_weight_adverse,
    review_reminder_days: row.review_reminder_days,
  };
}

export function ConfigWorkspace({
  profiles,
  taxonomy,
  settings,
}: {
  profiles: IcpProfileRow[];
  taxonomy: SectorTaxonomyRow[];
  settings: ModelSettingsRow;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() => profiles.map(rowToDraft));
  const [activeTab, setActiveTab] = React.useState<string>(drafts[0]?.clientKey ?? "");
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [pendingSectorId, setPendingSectorId] = React.useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = React.useState<ModelSettingsInput>(() => toSettingsInput(settings));
  const [savingSettings, setSavingSettings] = React.useState(false);

  const [syncedSettings, setSyncedSettings] = React.useState(settings);
  if (settings !== syncedSettings) {
    setSyncedSettings(settings);
    setSettingsDraft(toSettingsInput(settings));
  }

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
        const next = checked ? Array.from(new Set([...d.target_sectors, sector])) : d.target_sectors.filter((s2) => s2 !== sector);
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

  function updateSettings(patch: Partial<ModelSettingsInput>) {
    setSettingsDraft((prev) => ({ ...prev, ...patch }));
  }

  const healthWeightSum =
    settingsDraft.health_weight_qualitative + settingsDraft.health_weight_talent + settingsDraft.health_weight_adverse;

  async function saveSettings() {
    if (settingsDraft.tier_a_min <= settingsDraft.tier_b_min) {
      toast.error("Tier A threshold must be higher than Tier B.");
      return;
    }
    if (healthWeightSum !== 100) {
      toast.error("Account health weights must sum to 100", { description: `Currently ${healthWeightSum}.` });
      return;
    }
    setSavingSettings(true);
    try {
      await saveModelSettings(settingsDraft);
      toast.success("Settings saved", { description: "Applies on the next score or re-score." });
      router.refresh();
    } catch (err) {
      toast.error("Failed to save settings", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSettings(false);
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

  const activeDraft = drafts.find((d) => d.clientKey === activeTab) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent>
          <p className="text-sm font-semibold">The model is config, not code.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Weights, bands and target sectors are set per ICP. Changes apply on the next score or re-score, with no
            new API spend.
          </p>
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Per-profile settings</p>

        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No ICP profiles yet. Add one to start scoring against real weights.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex flex-nowrap items-center gap-2.5 overflow-x-auto pb-1">
              {drafts.map((d) => {
                const active = activeTab === d.clientKey;
                return (
                  <button
                    key={d.clientKey}
                    type="button"
                    onClick={() => setActiveTab(d.clientKey)}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-xs font-bold",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {(d.icp_name || "?").charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{d.icp_name || "Untitled"}</span>
                      {!d.id && <span className="text-[11px] text-muted-foreground">new — unsaved</span>}
                    </span>
                  </button>
                );
              })}
              <Button variant="outline" size="sm" className="shrink-0" onClick={addProfile}>
                <Plus /> New ICP profile
              </Button>
            </div>

            {activeDraft &&
              (() => {
                const d = activeDraft;
                const sum = sumFor(d);
                const valid = sum === 100;
                const isPending = pendingKey === d.clientKey;
                return (
                  <div className="flex flex-col gap-6">
                    <Card>
                      <CardHeader className="flex-row items-start justify-between">
                        <div>
                          <CardTitle>Category weights · {d.icp_name || "Untitled"}</CardTitle>
                          <CardDescription>How the four scoring categories combine into a total score.</CardDescription>
                        </div>
                        <Badge variant="outline" className={cn("gap-1 border-transparent shrink-0", valid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive")}>
                          {valid ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                          Total {sum} / 100
                        </Badge>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">ICP name</Label>
                          <Input
                            value={d.icp_name}
                            onChange={(e) => updateDraft(d.clientKey, { icp_name: e.target.value })}
                            disabled={isPending}
                          />
                        </div>
                        {WEIGHT_KEYS.map((key) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="h-2.5 w-1.5 shrink-0 rounded-full" style={{ background: WEIGHT_COLORS[key] }} />
                            <Label className="w-44 shrink-0 text-sm font-normal">{CATEGORY_LABEL_BY_WEIGHT_KEY[key]}</Label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={d[key]}
                              disabled={isPending}
                              onChange={(e) => updateDraft(d.clientKey, { [key]: Number(e.target.value) } as Partial<Draft>)}
                              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-current"
                              style={{ color: WEIGHT_COLORS[key] }}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={d[key]}
                              disabled={isPending}
                              onChange={(e) => updateDraft(d.clientKey, { [key]: Number(e.target.value) } as Partial<Draft>)}
                              className="h-8 w-16 shrink-0 tabular-nums"
                            />
                            <span className="w-3 shrink-0 text-xs text-muted-foreground">%</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Target sectors</CardTitle>
                        <CardDescription>Which sectors this ICP profile matches against.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {distinctSectors.map((sector) => {
                            const checked = d.target_sectors.includes(sector);
                            return (
                              <button
                                key={sector}
                                type="button"
                                onClick={() => toggleSector(d.clientKey, sector, !checked)}
                                disabled={isPending}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                  checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                                )}
                              >
                                {sector}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Revenue band → score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BandEditor
                            label="Revenue bands (USD)"
                            hint="Annual revenue mapped to a scale & footprint sub-score."
                            value={d.revenue_bands_usd}
                            onChange={(v) => updateDraft(d.clientKey, { revenue_bands_usd: v })}
                            disabled={isPending}
                            kind="currency"
                          />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Headcount band → score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BandEditor
                            label="Headcount bands"
                            hint="Employee count mapped to a scale & footprint sub-score."
                            value={d.headcount_bands}
                            onChange={(v) => updateDraft(d.clientKey, { headcount_bands: v })}
                            disabled={isPending}
                            kind="number"
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Fit rules</CardTitle>
                        <CardDescription>
                          Raw JSON, parsed by the n8n Scoring Engine — the shape isn&apos;t fixed on this side, so it&apos;s edited directly.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          className="min-h-32 w-full rounded-md border bg-transparent p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={d.fit_rules}
                          onChange={(e) => updateDraft(d.clientKey, { fit_rules: e.target.value })}
                          disabled={isPending}
                        />
                        {!jsonIsValid(d.fit_rules) && <p className="mt-1.5 text-xs text-destructive">Not valid JSON</p>}
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className={cn("gap-1 border-transparent", valid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive")}>
                        {valid ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                        Sum: {sum} / 100
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => remove(d)} disabled={isPending}>
                          <Trash2 /> Delete
                        </Button>
                        <Button onClick={() => save(d)} disabled={!valid || isPending}>
                          {isPending && <Loader2 className="animate-spin" />}
                          Save {d.icp_name || "profile"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </>
        )}
      </div>

      <div>
        <p className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Sector taxonomy</p>
        <Card>
          <CardContent className="p-0">
            {taxonomyBySector.size === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No sector taxonomy configured yet.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {Array.from(taxonomyBySector.entries()).map(([sector, rows]) => (
                  <div key={sector}>
                    <p className="bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{sector}</p>
                    <div className="flex flex-col divide-y">
                      {rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <span className={cn("text-sm", !row.active && "text-muted-foreground line-through")}>{row.sub_sector}</span>
                          <button
                            type="button"
                            onClick={() => toggleActive(row, !row.active)}
                            disabled={pendingSectorId === row.id}
                            className="shrink-0"
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                "cursor-pointer border-transparent",
                                row.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.active ? "Active" : "Inactive"}
                            </Badge>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Shared base · all profiles</p>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tier thresholds</CardTitle>
              <CardDescription>Total score maps to a tier. Shown with confidence so a thin-data Tier A is visible.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <span className="h-full bg-slate-400" style={{ width: `${settingsDraft.tier_b_min}%` }} />
                <span className="h-full bg-primary" style={{ width: `${settingsDraft.tier_a_min - settingsDraft.tier_b_min}%` }} />
                <span className="h-full bg-emerald-500" style={{ width: `${100 - settingsDraft.tier_a_min}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <Label className="text-sm font-normal">Tier A ≥</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-20"
                    value={settingsDraft.tier_a_min}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ tier_a_min: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                  <Label className="text-sm font-normal">Tier B ≥</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-20"
                    value={settingsDraft.tier_b_min}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ tier_b_min: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-2.5 shrink-0 rounded-full bg-slate-400" />
                  Tier C below {settingsDraft.tier_b_min}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Contact pull rule</CardTitle>
                <CardDescription>On demand keeps contact-credit spend to accounts the team actually opens.</CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={settingsDraft.contact_pull_on_demand}
                  disabled={savingSettings}
                  onCheckedChange={(v) => updateSettings({ contact_pull_on_demand: v })}
                />
                <span className="text-sm text-muted-foreground">{settingsDraft.contact_pull_on_demand ? "On demand" : "Automatic"}</span>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrichment run settings</CardTitle>
              <CardDescription>Used to estimate cost before an enrichment run, and to avoid re-pulling fresh records.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Indicative price per credit</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="h-8 w-24"
                    placeholder="—"
                    value={settingsDraft.indicative_price_per_credit ?? ""}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ indicative_price_per_credit: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to hide the £ figure</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Re-pull after</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-20"
                    value={settingsDraft.re_pull_after_days}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ re_pull_after_days: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Currency &amp; exchange rates</CardTitle>
              <CardDescription>All revenue is shown in US dollars. Source figures in other currencies are converted at these rates.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">£1 =</span>
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-8 w-24"
                  value={settingsDraft.gbp_to_usd_rate}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ gbp_to_usd_rate: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">€1 =</span>
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-8 w-24"
                  value={settingsDraft.eur_to_usd_rate}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ eur_to_usd_rate: Number(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted-foreground">US-domiciled companies are already in USD.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Account health score</CardTitle>
                <CardDescription>
                  How live-client health is weighted. Applied to the Accounts view. Adverse events subtract from the
                  blended qualitative + talent score.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 border-transparent shrink-0",
                  healthWeightSum === 100 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
                )}
              >
                {healthWeightSum === 100 ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                Total {healthWeightSum}%
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  { key: "health_weight_qualitative" as const, label: "Qualitative ratings", color: "var(--primary)" },
                  { key: "health_weight_talent" as const, label: "Talent & retention", color: "#10b981" },
                  { key: "health_weight_adverse" as const, label: "Adverse-events penalty", color: "#ef4444" },
                ]
              ).map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="h-2.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <Label className="w-44 shrink-0 text-sm font-normal">{label}</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) } as Partial<ModelSettingsInput>)}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-current"
                    style={{ color }}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) } as Partial<ModelSettingsInput>)}
                    className="h-8 w-16 shrink-0 tabular-nums"
                  />
                  <span className="w-3 shrink-0 text-xs text-muted-foreground">%</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 border-t pt-4">
                <Label className="text-sm font-normal text-muted-foreground">Review reminder after</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-20"
                  value={settingsDraft.review_reminder_days}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ review_reminder_days: Number(e.target.value) })}
                />
                <span className="text-sm text-muted-foreground">days without a client-scorecard review</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings && <Loader2 className="animate-spin" />}
              Save settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
