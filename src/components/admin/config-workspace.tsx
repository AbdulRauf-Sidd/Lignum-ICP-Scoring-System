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
import { getIcpAvatarClass } from "@/lib/icp-colors";
import { formatUsdCompact, formatNumber } from "@/lib/format";
import type { IcpProfileRow, SectorTaxonomyRow } from "@/lib/data/icp-profiles";
import type { ModelSettingsRow } from "@/lib/data/model-settings";
import {
  saveIcpProfile,
  deleteIcpProfile,
  setSectorTaxonomyActive,
  createSectorTaxonomyEntry,
  saveModelSettings,
  type ModelSettingsInput,
} from "@/app/(dashboard)/admin/config/actions";
import { useUnsavedChangesGuard } from "@/components/layout/unsaved-changes-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WEIGHT_KEYS = [
  "weight_icp_fit",
  "weight_scale_footprint",
  "weight_hiring_growth",
  "weight_financial_viability",
  "weight_credit_risk",
] as const;

type WeightKey = (typeof WEIGHT_KEYS)[number];

const CATEGORY_LABEL_BY_WEIGHT_KEY: Record<WeightKey, string> = {
  weight_icp_fit: SCORE_CATEGORY_LABELS.icp_fit,
  weight_scale_footprint: SCORE_CATEGORY_LABELS.scale_footprint,
  weight_hiring_growth: SCORE_CATEGORY_LABELS.hiring_growth,
  weight_financial_viability: SCORE_CATEGORY_LABELS.financial_viability,
  weight_credit_risk: SCORE_CATEGORY_LABELS.credit_risk,
};

const WEIGHT_COLORS: Record<WeightKey, string> = {
  weight_icp_fit: "var(--primary)",
  weight_scale_footprint: "#10b981",
  weight_hiring_growth: "#0ea5e9",
  weight_financial_viability: "#8b5cf6",
  weight_credit_risk: "#ef4444",
};

const SCORECARD_WEIGHT_KEYS = [
  "health_weight_relationship_strength",
  "health_weight_delivery_satisfaction",
  "health_weight_growth_potential",
  "health_weight_payment_reliability",
  "health_weight_strategic_fit",
] as const;

type ScorecardWeightKey = (typeof SCORECARD_WEIGHT_KEYS)[number];

const SCORECARD_WEIGHT_LABELS: Record<ScorecardWeightKey, string> = {
  health_weight_relationship_strength: "Relationship strength",
  health_weight_delivery_satisfaction: "Delivery satisfaction",
  health_weight_growth_potential: "Growth potential",
  health_weight_payment_reliability: "Payment reliability",
  health_weight_strategic_fit: "Strategic fit",
};

const SCORECARD_WEIGHT_COLORS: Record<ScorecardWeightKey, string> = {
  health_weight_relationship_strength: "var(--primary)",
  health_weight_delivery_satisfaction: "#10b981",
  health_weight_growth_potential: "#0ea5e9",
  health_weight_payment_reliability: "#8b5cf6",
  health_weight_strategic_fit: "#f59e0b",
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
    weight_icp_fit: 20,
    weight_scale_footprint: 20,
    weight_hiring_growth: 20,
    weight_financial_viability: 20,
    weight_credit_risk: 20,
    target_sectors: [],
    revenue_bands_usd: "[]",
    headcount_bands: "[]",
    hiring_growth_bands: "[]",
    credit_risk_bands: "[]",
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

type BandKind = "currency" | "number" | "percent" | "years";

function formatBandLabel(band: Band, index: number, arr: Band[], kind: BandKind): string {
  const fmt = (n: number) => {
    if (kind === "currency") return formatUsdCompact(n);
    if (kind === "percent") return `${formatNumber(n)}%`;
    if (kind === "years") return `${formatNumber(n)} yrs`;
    return formatNumber(n);
  };
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
  kind: BandKind;
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

interface FitRule {
  id: string;
  description: string;
  flag: string;
}

function parseFitRules(json: string): FitRule[] | null {
  try {
    const val = JSON.parse(json);
    if (!Array.isArray(val)) return null;
    if (
      !val.every(
        (r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.description === "string" && typeof r.flag === "string",
      )
    ) {
      return null;
    }
    return val as FitRule[];
  } catch {
    return null;
  }
}

function newRuleId(): string {
  return `rule_${Math.random().toString(36).slice(2, 10)}`;
}

// Fit rules define a profile: each row is a plain-English REQUIREMENT the
// company is expected to meet. An LLM (fed the company's Creditsafe/Cognism
// data in n8n) judges whether each company satisfies it -- no fixed
// field/operator syntax, since the model can reason over any signal present
// in the enrichment data. A hard requirement the company does NOT meet
// flags it as a weak / wrong-ICP match and subtracts from its ICP fit
// score; a soft signal not met subtracts less.
// Rotated across empty rows so "+ Add rule" doesn't always suggest the same
// field — each example points at a different piece of data the LLM actually
// sees (headcount, revenue, credit score, HQ location, legal history,
// ownership), so users get a sense of the range of rules they can write.
const FIT_RULE_EXAMPLES = [
  "Company has more than 400 employees",
  "Company's annual revenue exceeds $50 million",
  "Company's credit rating is at least 70/100",
  "Company is headquartered in the United States",
  "Company has no active bankruptcy or lawsuits",
  "Company is privately owned, not publicly traded",
];

function FitRuleEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const rules = parseFitRules(value);

  function commit(next: FitRule[]) {
    onChange(JSON.stringify(next));
  }

  function updateDescription(index: number, description: string) {
    if (!rules) return;
    commit(rules.map((r, i) => (i === index ? { ...r, description } : r)));
  }

  function updateHard(index: number, hard: boolean) {
    if (!rules) return;
    commit(rules.map((r, i) => (i === index ? { ...r, flag: hard ? "no_match" : "weak" } : r)));
  }

  function removeRule(index: number) {
    if (!rules) return;
    commit(rules.filter((_, i) => i !== index));
  }

  function addRule() {
    commit([...(rules ?? []), { id: newRuleId(), description: "", flag: "weak" }]);
  }

  return (
    <div className="space-y-2">
      {rules === null ? (
        <div className="space-y-1.5">
          <textarea
            className="min-h-24 w-full rounded-md border bg-transparent p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-destructive">Not a valid rule list — editing as raw JSON.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {rules.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">No fit rules yet.</p>}
          {rules.map((rule, i) => {
            const hard = rule.flag === "no_match";
            return (
              <div key={rule.id} className={cn("flex items-center gap-3 px-3 py-2.5", i > 0 && "border-t")}>
                <Input
                  value={rule.description}
                  disabled={disabled}
                  onChange={(e) => updateDescription(i, e.target.value)}
                  placeholder={`e.g. ${FIT_RULE_EXAMPLES[i % FIT_RULE_EXAMPLES.length]}`}
                  className="h-8 flex-1 text-xs"
                />
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 gap-1 border-transparent text-[10px] whitespace-nowrap",
                    hard ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                  )}
                >
                  {hard ? "Hard requirement" : "Soft signal"}
                </Badge>
                <Switch checked={hard} disabled={disabled} onCheckedChange={(v) => updateHard(i, v)} />
                <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={disabled} onClick={() => removeRule(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={addRule}
          >
            <Plus className="size-3.5" /> Add rule
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
    soft_rule_penalty: row.soft_rule_penalty,
    hard_rule_penalty: row.hard_rule_penalty,
    contact_pull_on_demand: row.contact_pull_on_demand,
    cv_cost: row.cv_cost,
    interview_cost: row.interview_cost,
    auto_repull_enabled: row.auto_repull_enabled,
    re_pull_after_days: row.re_pull_after_days,
    gbp_to_usd_rate: row.gbp_to_usd_rate,
    eur_to_usd_rate: row.eur_to_usd_rate,
    health_weight_qualitative: row.health_weight_qualitative,
    health_weight_talent: row.health_weight_talent,
    health_weight_adverse: row.health_weight_adverse,
    health_weight_relationship_strength: row.health_weight_relationship_strength,
    health_weight_delivery_satisfaction: row.health_weight_delivery_satisfaction,
    health_weight_growth_potential: row.health_weight_growth_potential,
    health_weight_payment_reliability: row.health_weight_payment_reliability,
    health_weight_strategic_fit: row.health_weight_strategic_fit,
    headcount_change_bands: row.headcount_change_bands,
    attrition_bands: row.attrition_bands,
    tenure_bands: row.tenure_bands,
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
  const [addingSubSectorFor, setAddingSubSectorFor] = React.useState<string | null>(null);
  const [newSubSectorName, setNewSubSectorName] = React.useState("");
  const [addingNewSector, setAddingNewSector] = React.useState(false);
  const [newSectorName, setNewSectorName] = React.useState("");
  const [newSectorSubSectorName, setNewSectorSubSectorName] = React.useState("");
  const [creatingTaxonomy, setCreatingTaxonomy] = React.useState(false);
  const [settingsDraft, setSettingsDraft] = React.useState<ModelSettingsInput>(() => toSettingsInput(settings));
  const [savingSettings, setSavingSettings] = React.useState(false);

  function draftEquals(a: Draft, b: Draft) {
    return (
      a.icp_name === b.icp_name &&
      a.weight_icp_fit === b.weight_icp_fit &&
      a.weight_scale_footprint === b.weight_scale_footprint &&
      a.weight_hiring_growth === b.weight_hiring_growth &&
      a.weight_financial_viability === b.weight_financial_viability &&
      a.weight_credit_risk === b.weight_credit_risk &&
      JSON.stringify(a.target_sectors) === JSON.stringify(b.target_sectors) &&
      a.revenue_bands_usd === b.revenue_bands_usd &&
      a.headcount_bands === b.headcount_bands &&
      a.hiring_growth_bands === b.hiring_growth_bands &&
      a.credit_risk_bands === b.credit_risk_bands &&
      a.fit_rules === b.fit_rules
    );
  }

  // The background AutoRefresh poll calls router.refresh() every 5s, which
  // re-runs the server component and hands this a brand-new `profiles`/
  // `settings` array reference every time -- even when nothing changed. Only
  // accept that fresh data if there's nothing unsaved locally; otherwise an
  // in-progress edit (e.g. a just-added fit rule that hasn't been saved yet)
  // would get silently wiped within 5 seconds.
  const [syncedSettings, setSyncedSettings] = React.useState(settings);
  if (settings !== syncedSettings) {
    const settingsDirtyNow = JSON.stringify(settingsDraft) !== JSON.stringify(toSettingsInput(syncedSettings));
    setSyncedSettings(settings);
    if (!settingsDirtyNow) {
      setSettingsDraft(toSettingsInput(settings));
    }
  }

  const [syncedProfiles, setSyncedProfiles] = React.useState(profiles);
  if (profiles !== syncedProfiles) {
    const draftsDirtyNow = drafts.some((d) => {
      if (!d.id) return true;
      const original = syncedProfiles.find((p) => p.id === d.id);
      return !original || !draftEquals(d, rowToDraft(original));
    });
    setSyncedProfiles(profiles);
    if (!draftsDirtyNow) {
      setDrafts(profiles.map(rowToDraft));
    }
  }

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

  function jsonIsValid(value: string) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  const dirtyDrafts = drafts.filter((d) => {
    if (!d.id) return true; // new, never saved
    const original = syncedProfiles.find((p) => p.id === d.id);
    return !original || !draftEquals(d, rowToDraft(original));
  });

  // Returns whether the save actually succeeded, so the nav-away guard below
  // knows whether it's safe to navigate or whether to stay put on failure.
  async function save(draft: Draft): Promise<boolean> {
    const sum = sumFor(draft);
    if (sum !== 100) {
      toast.error("Weights must sum to 100", { description: `${draft.icp_name} currently sums to ${sum}.` });
      return false;
    }
    for (const [label, value] of [
      ["Revenue bands", draft.revenue_bands_usd],
      ["Headcount bands", draft.headcount_bands],
      ["Hiring & growth bands", draft.hiring_growth_bands],
      ["Credit risk bands", draft.credit_risk_bands],
      ["Fit rules", draft.fit_rules],
    ] as const) {
      if (!jsonIsValid(value)) {
        toast.error(`${label} is not valid JSON`);
        return false;
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
        weight_credit_risk: draft.weight_credit_risk,
        target_sectors: draft.target_sectors,
        revenue_bands_usd: draft.revenue_bands_usd,
        headcount_bands: draft.headcount_bands,
        hiring_growth_bands: draft.hiring_growth_bands,
        credit_risk_bands: draft.credit_risk_bands,
        fit_rules: draft.fit_rules,
      });
      toast.success(`${draft.icp_name} saved`, { description: "Applies on next score or re-score." });

      // Update the local "last known server state" baseline immediately,
      // rather than waiting for router.refresh()'s round-trip to bring fresh
      // props back — otherwise the dirty-check (and the nav-away guard) keep
      // seeing stale synced data for the moment between save and refresh
      // landing, and incorrectly still think there's something unsaved.
      const savedRow: IcpProfileRow = {
        id,
        icp_name: draft.icp_name,
        weight_icp_fit: draft.weight_icp_fit,
        weight_scale_footprint: draft.weight_scale_footprint,
        weight_hiring_growth: draft.weight_hiring_growth,
        weight_financial_viability: draft.weight_financial_viability,
        weight_credit_risk: draft.weight_credit_risk,
        target_sectors: draft.target_sectors,
        revenue_bands_usd: draft.revenue_bands_usd,
        headcount_bands: draft.headcount_bands,
        hiring_growth_bands: draft.hiring_growth_bands,
        credit_risk_bands: draft.credit_risk_bands,
        fit_rules: draft.fit_rules,
      };
      setSyncedProfiles((prev) => (prev.some((p) => p.id === id) ? prev.map((p) => (p.id === id ? savedRow : p)) : [...prev, savedRow]));
      if (!draft.id) {
        setDrafts((prev) => prev.map((d) => (d.clientKey === draft.clientKey ? { ...d, id } : d)));
        setActiveTab(id);
      }
      router.refresh();
      return true;
    } catch (err) {
      toast.error("Failed to save ICP profile", { description: err instanceof Error ? err.message : undefined });
      return false;
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

  const scorecardWeightSum = SCORECARD_WEIGHT_KEYS.reduce((sum, k) => sum + (settingsDraft[k] || 0), 0);

  const settingsDirty = JSON.stringify(settingsDraft) !== JSON.stringify(toSettingsInput(syncedSettings));

  async function saveSettings(): Promise<boolean> {
    if (settingsDraft.tier_a_min <= settingsDraft.tier_b_min) {
      toast.error("Tier A threshold must be higher than Tier B.");
      return false;
    }
    if (settingsDraft.hard_rule_penalty < settingsDraft.soft_rule_penalty) {
      toast.error("Hard requirement penalty must be at least as large as the soft signal penalty.");
      return false;
    }
    if (healthWeightSum !== 100) {
      toast.error("Account health weights must sum to 100", { description: `Currently ${healthWeightSum}.` });
      return false;
    }
    if (scorecardWeightSum !== 100) {
      toast.error("Client scorecard weights must sum to 100", { description: `Currently ${scorecardWeightSum}.` });
      return false;
    }
    setSavingSettings(true);
    try {
      await saveModelSettings(settingsDraft);
      toast.success("Settings saved", { description: "Applies on the next score or re-score." });
      // Same reasoning as save() above -- update the local baseline now
      // rather than waiting for router.refresh() to bring it back.
      setSyncedSettings((prev) => ({ ...prev, ...settingsDraft, updated_at: new Date().toISOString() }));
      router.refresh();
      return true;
    } catch (err) {
      toast.error("Failed to save settings", { description: err instanceof Error ? err.message : undefined });
      return false;
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveAllAndClearGuard(): Promise<boolean> {
    let ok = true;
    for (const d of dirtyDrafts) {
      if (!(await save(d))) ok = false;
    }
    if (settingsDirty) {
      if (!(await saveSettings())) ok = false;
    }
    return ok;
  }

  useUnsavedChangesGuard(dirtyDrafts.length > 0 || settingsDirty, saveAllAndClearGuard);

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

  async function addSubSector(sector: string, subSector: string) {
    const trimmed = subSector.trim();
    if (!trimmed) {
      toast.error("Sub-sector name is required");
      return;
    }
    const existing = taxonomyBySector.get(sector) ?? [];
    if (existing.some((r) => r.sub_sector.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That sub-sector already exists", { description: `${sector} already has "${trimmed}".` });
      return;
    }
    setCreatingTaxonomy(true);
    try {
      await createSectorTaxonomyEntry(sector, trimmed);
      toast.success(`${trimmed} added to ${sector}`);
      setAddingSubSectorFor(null);
      setNewSubSectorName("");
      router.refresh();
    } catch (err) {
      toast.error("Failed to add sub-sector", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreatingTaxonomy(false);
    }
  }

  async function addNewSector() {
    const sector = newSectorName.trim();
    const subSector = newSectorSubSectorName.trim();
    if (!sector || !subSector) {
      toast.error("Both a sector name and its first sub-sector are required");
      return;
    }
    if (taxonomyBySector.has(sector)) {
      toast.error("That sector already exists", { description: `Add sub-sectors to the existing "${sector}" group instead.` });
      return;
    }
    setCreatingTaxonomy(true);
    try {
      await createSectorTaxonomyEntry(sector, subSector);
      toast.success(`${sector} added`);
      setAddingNewSector(false);
      setNewSectorName("");
      setNewSectorSubSectorName("");
      router.refresh();
    } catch (err) {
      toast.error("Failed to add sector", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreatingTaxonomy(false);
    }
  }

  const activeDraft = drafts.find((d) => d.clientKey === activeTab) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent>
          <p className="text-sm font-semibold">The model is config, not code.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Two independent models live on this page — <strong>ICP fit</strong> (per-profile scoring for the Target
            List) and <strong>Account Health</strong> (global, powers the Accounts module). They share nothing except
            this page; each has its own weights and applies on its own schedule.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border border-primary/25 bg-primary/[0.025] p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-2.5">
        <Badge className="border-transparent bg-primary text-primary-foreground">ICP Fit</Badge>
        <h2 className="text-sm font-semibold">Per-profile scoring model</h2>
        <span className="text-xs text-muted-foreground">— applies to Target List scoring only</span>
      </div>

      <div className="flex flex-col gap-8">
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
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {drafts.map((d) => {
                const active = activeTab === d.clientKey;
                return (
                  <button
                    key={d.clientKey}
                    type="button"
                    onClick={() => setActiveTab(d.clientKey)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors",
                      active ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-xs font-bold",
                        getIcpAvatarClass(d.icp_name),
                      )}
                    >
                      {(d.icp_name || "?").charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{d.icp_name || "Untitled"}</p>
                      {!d.id && <p className="text-[11px] text-muted-foreground">new — unsaved</p>}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={addProfile}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
              >
                <Plus className="size-3.5" /> New ICP profile
              </button>
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
                          <CardDescription>How the five scoring categories combine into a total score.</CardDescription>
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

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Revenue band → score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BandEditor
                            label="Revenue bands (USD)"
                            hint="Annual revenue mapped to a financial viability sub-score."
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
                      <Card>
                        <CardHeader>
                          <CardTitle>Hiring & growth band → score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BandEditor
                            label="Hiring & growth bands"
                            hint="Recent hiring-event count (last 180 days) mapped to a hiring & growth sub-score."
                            value={d.hiring_growth_bands}
                            onChange={(v) => updateDraft(d.clientKey, { hiring_growth_bands: v })}
                            disabled={isPending}
                            kind="number"
                          />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Credit risk band → score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BandEditor
                            label="Credit risk bands"
                            hint="Creditsafe's risk score (0-100) mapped to a credit risk sub-score."
                            value={d.credit_risk_bands}
                            onChange={(v) => updateDraft(d.clientKey, { credit_risk_bands: v })}
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
                          Describe a requirement in plain English — an LLM reads the company&apos;s Creditsafe and
                          Cognism data and checks whether each company meets it. A hard requirement that&apos;s{" "}
                          <em>not</em> met flags the company as a weak / wrong-ICP match and subtracts the hard
                          penalty from ICP fit below; a soft signal not met subtracts the soft penalty instead.
                          The LLM only sees: revenue, headcount, a short company description, headquarters/location,
                          registered address, turnover, country, and credit score — write rules against these, not
                          fields outside this list.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FitRuleEditor
                          value={d.fit_rules}
                          onChange={(v) => updateDraft(d.clientKey, { fit_rules: v })}
                          disabled={isPending}
                        />
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
                      {addingSubSectorFor === sector ? (
                        <div className="flex items-center gap-2 px-4 py-2.5">
                          <Input
                            autoFocus
                            value={newSubSectorName}
                            onChange={(e) => setNewSubSectorName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addSubSector(sector, newSubSectorName);
                              if (e.key === "Escape") {
                                setAddingSubSectorFor(null);
                                setNewSubSectorName("");
                              }
                            }}
                            placeholder="New sub-sector name"
                            className="h-8 flex-1 text-sm"
                            disabled={creatingTaxonomy}
                          />
                          <Button size="sm" onClick={() => addSubSector(sector, newSubSectorName)} disabled={creatingTaxonomy}>
                            {creatingTaxonomy && <Loader2 className="animate-spin" />}
                            Add
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAddingSubSectorFor(null);
                              setNewSubSectorName("");
                            }}
                            disabled={creatingTaxonomy}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSubSectorFor(sector);
                            setNewSubSectorName("");
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                        >
                          <Plus className="size-3.5" /> Add sub-sector
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {addingNewSector ? (
              <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center">
                <Input
                  autoFocus
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  placeholder="New sector name"
                  className="h-8 flex-1 text-sm"
                  disabled={creatingTaxonomy}
                />
                <Input
                  value={newSectorSubSectorName}
                  onChange={(e) => setNewSectorSubSectorName(e.target.value)}
                  placeholder="First sub-sector"
                  className="h-8 flex-1 text-sm"
                  disabled={creatingTaxonomy}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addNewSector} disabled={creatingTaxonomy}>
                    {creatingTaxonomy && <Loader2 className="animate-spin" />}
                    Add sector
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingNewSector(false);
                      setNewSectorName("");
                      setNewSectorSubSectorName("");
                    }}
                    disabled={creatingTaxonomy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingNewSector(true)}
                className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                <Plus className="size-3.5" /> Add new sector
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Shared across all ICP profiles</p>

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
            <CardHeader>
              <CardTitle>Fit rule penalties</CardTitle>
              <CardDescription>
                How much a violated fit rule subtracts from ICP fit — a hard requirement costs more than a soft
                signal, and either can force the whole company down to a weak or no-match tier.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Soft signal penalty</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-20"
                    value={settingsDraft.soft_rule_penalty}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ soft_rule_penalty: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">points off ICP fit</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hard requirement penalty</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-20"
                    value={settingsDraft.hard_rule_penalty}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ hard_rule_penalty: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">points off ICP fit</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>Automatic re-pull</CardTitle>
                  <CardDescription>
                    When enabled, every company is automatically re-enriched once its data is older than the
                    interval below — without needing a new import.
                  </CardDescription>
                </div>
                <Switch
                  checked={settingsDraft.auto_repull_enabled}
                  disabled={savingSettings}
                  onCheckedChange={(v) => updateSettings({ auto_repull_enabled: v })}
                />
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Re-pull after</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={settingsDraft.re_pull_after_days}
                      disabled={savingSettings || !settingsDraft.auto_repull_enabled}
                      onChange={(e) => updateSettings({ re_pull_after_days: Number(e.target.value) })}
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CV cost</CardTitle>
                <CardDescription>Reference cost per CV submitted, for account pricing.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CV cost</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-8 w-24"
                      placeholder="—"
                      value={settingsDraft.cv_cost ?? ""}
                      disabled={savingSettings}
                      onChange={(e) => updateSettings({ cv_cost: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interview cost</CardTitle>
                <CardDescription>Reference cost per first interview, for account pricing.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Interview cost</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-8 w-24"
                      placeholder="—"
                      value={settingsDraft.interview_cost ?? ""}
                      disabled={savingSettings}
                      onChange={(e) =>
                        updateSettings({ interview_cost: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
      </section>

      <section className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.04] p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-2.5">
        <Badge className="border-transparent bg-indigo-600 text-white">Global</Badge>
        <h2 className="text-sm font-semibold">Account Health model</h2>
        <span className="text-xs text-muted-foreground">— powers every account in the Accounts module</span>
      </div>

      <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Account health weights</CardTitle>
                <CardDescription>
                  How the Client scorecard, Talent insights and Adverse events combine into the Account Health
                  score shown on each account.
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
                Total {healthWeightSum} / 100
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  ["health_weight_qualitative", "Client scorecard", "var(--primary)"],
                  ["health_weight_talent", "Talent insights", "#10b981"],
                  ["health_weight_adverse", "Adverse events", "#ef4444"],
                ] as const
              ).map(([key, label, color]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="h-2.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <Label className="w-44 shrink-0 text-sm font-normal">{label}</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-current"
                    style={{ color }}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                    className="h-8 w-16 shrink-0 tabular-nums"
                  />
                  <span className="w-3 shrink-0 text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Client scorecard weights</CardTitle>
                <CardDescription>How the 5 scorecard ratings combine into the Client scorecard sub-score.</CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 border-transparent shrink-0",
                  scorecardWeightSum === 100 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
                )}
              >
                {scorecardWeightSum === 100 ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                Total {scorecardWeightSum} / 100
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {SCORECARD_WEIGHT_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="h-2.5 w-1.5 shrink-0 rounded-full" style={{ background: SCORECARD_WEIGHT_COLORS[key] }} />
                  <Label className="w-44 shrink-0 text-sm font-normal">{SCORECARD_WEIGHT_LABELS[key]}</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-current"
                    style={{ color: SCORECARD_WEIGHT_COLORS[key] }}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft[key]}
                    disabled={savingSettings}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                    className="h-8 w-16 shrink-0 tabular-nums"
                  />
                  <span className="w-3 shrink-0 text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Headcount change band → score</CardTitle>
              </CardHeader>
              <CardContent>
                <BandEditor
                  label="Headcount change bands (%)"
                  hint="Trailing headcount change mapped to a Talent insights sub-score."
                  value={settingsDraft.headcount_change_bands}
                  onChange={(v) => updateSettings({ headcount_change_bands: v })}
                  disabled={savingSettings}
                  kind="percent"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Attrition band → score</CardTitle>
              </CardHeader>
              <CardContent>
                <BandEditor
                  label="Attrition bands (%)"
                  hint="Trailing attrition rate mapped to a Talent insights sub-score."
                  value={settingsDraft.attrition_bands}
                  onChange={(v) => updateSettings({ attrition_bands: v })}
                  disabled={savingSettings}
                  kind="percent"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average tenure band → score</CardTitle>
              </CardHeader>
              <CardContent>
                <BandEditor
                  label="Average tenure bands (years)"
                  hint="Average employee tenure mapped to a Talent insights sub-score."
                  value={settingsDraft.tenure_bands}
                  onChange={(v) => updateSettings({ tenure_bands: v })}
                  disabled={savingSettings}
                  kind="years"
                />
              </CardContent>
            </Card>
          </div>
      </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={savingSettings}>
          {savingSettings && <Loader2 className="animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
