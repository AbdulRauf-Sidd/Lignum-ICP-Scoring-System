"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { SCORE_CATEGORY_LABELS } from "@/lib/constants";
import type { IcpProfileRow, SectorTaxonomyRow } from "@/lib/data/icp-profiles";
import { saveIcpProfile, deleteIcpProfile, setSectorTaxonomyActive } from "@/app/(dashboard)/admin/config/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import s from "./config-workspace.module.css";

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
    <div className={s.wrap}>
      <div className={s.inner}>
        <div className={s.specbar}>
          <span>Model config</span>
          <span className={s.specbarMeta}>
            <span>ICP scoring &middot; weights &amp; taxonomy</span>
            <span>Admin only</span>
          </span>
        </div>
        <header className={s.hero}>
          <p className={s.eyebrow}>Config, not code</p>
          <h1 className={s.h1}>Per-ICP weights, bands and the active sector taxonomy.</h1>
          <p className={s.heroP}>
            Changes here apply on the next score or re-score, with no new API spend. Weights must sum to 100 per
            ICP. Inactive sub-sectors are excluded from classification going forward.
          </p>
        </header>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <span className={s.sectionNum}>01</span>
            <h2>Per-ICP weights</h2>
            <span className={s.sectionHint}>icp_profiles &middot; live</span>
          </div>
          <div className={s.card}>
            <div className={s.cardHeadRow}>
              <div>
                <p className={s.cardTitle}>Scoring profiles</p>
                <p className={s.cardHint}>One row per ICP. Weights, target sectors, bands and fit rules.</p>
              </div>
              <button type="button" className={s.btn} onClick={addProfile}>
                <Plus size={13} /> New ICP profile
              </button>
            </div>

            {drafts.length === 0 ? (
              <p className={s.emptyState}>No ICP profiles yet. Add one to start scoring against real weights.</p>
            ) : (
              <>
                <div className={s.tabRow}>
                  {drafts.map((d) => (
                    <button
                      key={d.clientKey}
                      type="button"
                      className={cn(s.tab, activeTab === d.clientKey && s.tabActive)}
                      onClick={() => setActiveTab(d.clientKey)}
                    >
                      {d.icp_name || "Untitled"}
                      {!d.id && <span className={s.tagMuted}>new</span>}
                    </button>
                  ))}
                </div>

                {activeDraft &&
                  (() => {
                    const d = activeDraft;
                    const sum = sumFor(d);
                    const valid = sum === 100;
                    const isPending = pendingKey === d.clientKey;
                    return (
                      <div className="flex flex-col gap-5">
                        <div className={s.fieldGroup}>
                          <label className={s.fieldLabel}>ICP name</label>
                          <input
                            className={s.input}
                            value={d.icp_name}
                            onChange={(e) => updateDraft(d.clientKey, { icp_name: e.target.value })}
                            disabled={isPending}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          {WEIGHT_KEYS.map((key) => (
                            <div key={key} className={s.fieldGroup}>
                              <label className={s.fieldLabel}>{CATEGORY_LABEL_BY_WEIGHT_KEY[key]}</label>
                              <div className={s.numberInputWrap}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className={s.numberInput}
                                  value={d[key]}
                                  onChange={(e) =>
                                    updateDraft(d.clientKey, { [key]: Number(e.target.value) } as Partial<Draft>)
                                  }
                                  disabled={isPending}
                                />
                                <span className={s.percentSign}>%</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={s.fieldGroup}>
                          <label className={s.fieldLabel}>Target sectors</label>
                          <div className={s.checkboxRow}>
                            {distinctSectors.map((sector) => {
                              const checked = d.target_sectors.includes(sector);
                              return (
                                <button
                                  key={sector}
                                  type="button"
                                  className={cn(s.sectorPill, checked && s.sectorPillActive)}
                                  onClick={() => toggleSector(d.clientKey, sector, !checked)}
                                  disabled={isPending}
                                >
                                  {sector}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <div className={s.fieldGroup}>
                            <label className={s.fieldLabel}>Revenue bands (JSON)</label>
                            <textarea
                              className={s.textarea}
                              value={d.revenue_bands_usd}
                              onChange={(e) => updateDraft(d.clientKey, { revenue_bands_usd: e.target.value })}
                              disabled={isPending}
                            />
                            {!jsonIsValid(d.revenue_bands_usd) && (
                              <span className={s.tagDestructive}>Not valid JSON</span>
                            )}
                          </div>
                          <div className={s.fieldGroup}>
                            <label className={s.fieldLabel}>Headcount bands (JSON)</label>
                            <textarea
                              className={s.textarea}
                              value={d.headcount_bands}
                              onChange={(e) => updateDraft(d.clientKey, { headcount_bands: e.target.value })}
                              disabled={isPending}
                            />
                            {!jsonIsValid(d.headcount_bands) && (
                              <span className={s.tagDestructive}>Not valid JSON</span>
                            )}
                          </div>
                          <div className={s.fieldGroup}>
                            <label className={s.fieldLabel}>Fit rules (JSON)</label>
                            <textarea
                              className={s.textarea}
                              value={d.fit_rules}
                              onChange={(e) => updateDraft(d.clientKey, { fit_rules: e.target.value })}
                              disabled={isPending}
                            />
                            {!jsonIsValid(d.fit_rules) && <span className={s.tagDestructive}>Not valid JSON</span>}
                          </div>
                        </div>

                        <div className={s.footerRow}>
                          <span className={valid ? s.tagGreen : s.tagDestructive}>
                            {valid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            Sum: {sum} / 100
                          </span>
                          <div className="flex gap-2">
                            <button type="button" className={s.btnDestructive} onClick={() => remove(d)} disabled={isPending}>
                              <Trash2 size={13} /> Delete
                            </button>
                            <button
                              type="button"
                              className={s.btnPrimary}
                              onClick={() => save(d)}
                              disabled={!valid || isPending}
                            >
                              {isPending && <Loader2 size={13} className="animate-spin" />}
                              Save {d.icp_name || "profile"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </>
            )}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <span className={s.sectionNum}>02</span>
            <h2>Sector taxonomy</h2>
            <span className={s.sectionHint}>sector_taxonomy &middot; feeds the classifier</span>
          </div>
          <div className={s.stbl}>
            {Array.from(taxonomyBySector.entries()).map(([sector, rows]) => (
              <React.Fragment key={sector}>
                <div className={s.stblGroupHead}>{sector}</div>
                {rows.map((row) => (
                  <div key={row.id} className={s.stblRow}>
                    <span className={cn(s.stblSub, !row.active && s.stblSubInactive)}>{row.sub_sector}</span>
                    <label className="flex cursor-pointer items-center gap-2">
                      <span className={row.active ? s.tagAmber : s.tagMuted}>{row.active ? "Active" : "Inactive"}</span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={row.active}
                        onChange={(e) => toggleActive(row, e.target.checked)}
                        disabled={pendingSectorId === row.id}
                      />
                    </label>
                  </div>
                ))}
              </React.Fragment>
            ))}
            {taxonomyBySector.size === 0 && (
              <p className={s.emptyState}>No sector taxonomy configured yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
