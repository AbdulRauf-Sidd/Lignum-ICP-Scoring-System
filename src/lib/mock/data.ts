import { SECTORS, SCORE_CATEGORY_LABELS } from "@/lib/constants";
import {
  Company,
  Contact,
  ScoreCategory,
  CandidateEntity,
  SourcedField,
  UsageRun,
  UsageItem,
  NotificationItem,
  IcpProfile,
  Tier,
  MatchFlag,
  AccountRecord,
} from "@/lib/types";
import { createRng, pick, randInt, randFloat, randomPastDate } from "./rng";
import {
  COMPANY_PREFIXES,
  COMPANY_SUFFIXES_BY_SECTOR,
  COUNTRIES,
  domainFromName,
  randomPersonName,
  TITLES,
} from "./names";

const rng = createRng(20260212);

export const ICP_PROFILES: IcpProfile[] = [
  {
    id: "icp-data-centres",
    name: "Data Centres",
    sector: "Data Centres",
    description: "Mechanical and electrical specialists serving hyperscale and colocation data centre builds.",
    weights: { icp_fit: 35, scale_footprint: 25, hiring_growth: 20, financial_viability: 20 },
  },
  {
    id: "icp-modular",
    name: "Modular and Pre-Fabrication",
    sector: "Modular and Pre-Fabrication",
    description: "Volumetric modular and precast concrete manufacturers with repeatable factory output.",
    weights: { icp_fit: 30, scale_footprint: 30, hiring_growth: 20, financial_viability: 20 },
  },
  {
    id: "icp-filtration",
    name: "Filtration Solutions",
    sector: "Filtration Solutions",
    description: "Filtration manufacturers supplying critical air and liquid filtration systems.",
    weights: { icp_fit: 40, scale_footprint: 20, hiring_growth: 15, financial_viability: 25 },
  },
  {
    id: "icp-commercial",
    name: "Commercial Construction",
    sector: "Commercial Construction",
    description: "Facade, interiors and specialist trade contractors on commercial builds.",
    weights: { icp_fit: 30, scale_footprint: 25, hiring_growth: 25, financial_viability: 20 },
  },
];

function tierFromScore(score: number): Tier {
  if (score >= 82) return "A";
  if (score >= 68) return "B";
  return "C";
}

function matchFlagFromScore(score: number): MatchFlag {
  if (score >= 68) return "match";
  if (score >= 45) return "weak";
  return "no_match";
}

function buildScoringBreakdown(
  icp: IcpProfile,
  baseQuality: number, // 0-1, overall company quality driving sub-scores
): { breakdown: ScoreCategory[]; total: number; confidence: number } {
  const keys: ScoreCategory["key"][] = [
    "icp_fit",
    "scale_footprint",
    "hiring_growth",
    "financial_viability",
  ];

  const excludeOne = rng() < 0.12;
  const excludedKey = excludeOne ? pick(rng, keys) : null;

  const raw: ScoreCategory[] = keys.map((key) => {
    const excluded = key === excludedKey;
    const noise = randFloat(rng, -18, 18);
    const subScore = excluded
      ? null
      : Math.max(5, Math.min(100, Math.round(baseQuality * 100 + noise)));
    return {
      key,
      label: SCORE_CATEGORY_LABELS[key],
      subScore,
      weight: icp.weights[key],
      contribution: null,
      excluded,
    };
  });

  const activeWeightSum = raw
    .filter((c) => !c.excluded)
    .reduce((sum, c) => sum + c.weight, 0);

  const breakdown = raw.map((c) => {
    if (c.excluded || c.subScore === null) return c;
    const renormalisedWeight = (c.weight / activeWeightSum) * 100;
    const contribution = Math.round((c.subScore * renormalisedWeight) / 100);
    return { ...c, contribution };
  });

  const total = Math.max(
    0,
    Math.min(100, breakdown.reduce((sum, c) => sum + (c.contribution ?? 0), 0)),
  );

  const confidence = excludeOne
    ? randInt(rng, 45, 70)
    : randInt(rng, 72, 98);

  return { breakdown, total, confidence };
}

function makeCandidateEntities(name: string, domain: string): CandidateEntity[] {
  const count = randInt(rng, 2, 3);
  return Array.from({ length: count }).map((_, i) => ({
    id: `cand-${name}-${i}`,
    name: i === 0 ? name : `${name} ${pick(rng, ["Group", "Holdings", "International", "LLC", "Ltd"])}`,
    domain: i === 0 ? domain : domain.replace(".com", pick(rng, [".co.uk", ".net", ".io", "-group.com"])),
    location: pick(rng, COUNTRIES),
    matchScore: i === 0 ? randInt(rng, 55, 74) : randInt(rng, 40, 73),
    source: pick(rng, ["creditsafe", "cognism"] as const),
  }));
}

function makeSourcedFields(sector: string): SourcedField[] {
  return [
    { field: "Annual revenue", value: `$${randInt(rng, 5, 400)}M`, source: "creditsafe" },
    { field: "Headcount", value: `${randInt(rng, 20, 2500)}`, source: "cognism" },
    { field: "Ownership", value: pick(rng, ["Private", "PE-backed", "Family-owned", "Public"]), source: "creditsafe" },
    { field: "Industry", value: sector, source: "cognism" },
    { field: "Headquarters", value: pick(rng, COUNTRIES), source: "creditsafe" },
    { field: "Hiring signals", value: `${randInt(rng, 0, 22)} open roles`, source: "cognism" },
    { field: "Risk score", value: pick(rng, ["Low", "Medium", "Low", "Very low"]), source: "creditsafe" },
  ];
}

function generateCompany(index: number): Company {
  const sectorDef = pick(rng, SECTORS);
  const icp = ICP_PROFILES.find((p) => p.sector === sectorDef.sector)!;
  const subSector = pick(rng, sectorDef.subSectors);
  const suffix = pick(rng, COMPANY_SUFFIXES_BY_SECTOR[sectorDef.sector]);
  const name = `${pick(rng, COMPANY_PREFIXES)} ${suffix}`;
  const domain = domainFromName(name);
  const country = pick(rng, COUNTRIES);
  const importedAt = index < 14 ? randomPastDate(rng, 6, 0) : randomPastDate(rng, 220, 14);

  const statusRoll = rng();
  let status: Company["status"];
  if (index < 6) status = "queued";
  else if (index < 10) status = "enriching";
  else if (index < 14) status = "failed";
  else if (statusRoll < 0.34) status = "triage";
  else status = "scored";

  let triageReason: Company["triageReason"] = null;
  let candidateEntities: CandidateEntity[] = [];
  let proposedSector: string | null = null;
  let proposedSubSector: string | null = null;
  let classificationConfidence: number | null = null;
  let score: number | null = null;
  let confidence: number | null = null;
  let breakdown: ScoreCategory[] = [];
  let tier: Tier = null;
  let matchFlag: MatchFlag | null = null;
  let lifecycleStatus: Company["lifecycleStatus"] = "prospect";
  let exported = false;
  let oneLineReason = "";

  if (status === "triage") {
    const reasonRoll = rng();
    if (reasonRoll < 0.45) {
      triageReason = "entity_ambiguous";
      candidateEntities = makeCandidateEntities(name, domain);
      oneLineReason = "Multiple candidate entities matched — confirm the correct company before the run continues.";
    } else if (reasonRoll < 0.85) {
      triageReason = "low_confidence_sector";
      proposedSector = sectorDef.sector;
      proposedSubSector = subSector;
      classificationConfidence = randInt(rng, 38, 64);
      const { breakdown: b, total, confidence: conf } = buildScoringBreakdown(icp, 0.55);
      breakdown = b;
      score = total;
      confidence = conf;
      tier = tierFromScore(total);
      matchFlag = matchFlagFromScore(total);
      oneLineReason = `Classifier proposed ${sectorDef.sector} / ${subSector} at ${classificationConfidence}% confidence — below the approval threshold.`;
    } else {
      triageReason = "icp_no_match";
      proposedSector = sectorDef.sector;
      proposedSubSector = subSector;
      classificationConfidence = randInt(rng, 70, 92);
      const { breakdown: b, total, confidence: conf } = buildScoringBreakdown(icp, 0.3);
      breakdown = b;
      score = total;
      confidence = conf;
      tier = tierFromScore(total);
      matchFlag = "no_match";
      oneLineReason = `Scores against ${icp.name} but contradicts the batch ICP's fit rules.`;
    }
  } else if (status === "scored") {
    proposedSector = sectorDef.sector;
    proposedSubSector = subSector;
    classificationConfidence = randInt(rng, 65, 99);
    const quality = randFloat(rng, 0.35, 0.95, 2);
    const { breakdown: b, total, confidence: conf } = buildScoringBreakdown(icp, quality);
    breakdown = b;
    score = total;
    confidence = conf;
    tier = tierFromScore(total);
    matchFlag = matchFlagFromScore(total);
    exported = rng() < 0.3;
    lifecycleStatus = rng() < 0.15 ? "client" : exported ? "exported" : "prospect";
    oneLineReason = `Matched to ${icp.name} on ${breakdown
      .filter((c) => !c.excluded)
      .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))[0]?.label.toLowerCase()}.`;
  } else if (status === "failed") {
    oneLineReason = pick(rng, [
      "Creditsafe report request timed out after 3 retries.",
      "Cognism enrich returned a rate-limit error and exceeded retry budget.",
      "Firecrawl could not resolve the company domain.",
    ]);
  }

  return {
    id: `company-${index}`,
    name,
    domain,
    sector: sectorDef.sector,
    subSector,
    status,
    triageReason,
    lifecycleStatus,
    tier,
    matchFlag,
    icp: icp.name,
    score,
    confidence,
    scoringBreakdown: breakdown,
    revenueUsd: status === "queued" || status === "failed" ? null : randInt(rng, 4, 420) * 1_000_000,
    headcount: status === "queued" || status === "failed" ? null : randInt(rng, 15, 2800),
    country,
    importedBy: pick(rng, ["Alex Morgan", "Priya Shah", "Tom Whitfield"]),
    importedAt,
    lastEnrichedAt: status === "queued" ? null : randomPastDate(rng, 210, 0),
    candidateEntities,
    sourcedFields: status === "queued" || status === "failed" ? [] : makeSourcedFields(sectorDef.sector),
    exported,
    classificationConfidence,
    proposedSector,
    proposedSubSector,
    oneLineReason,
  };
}

export const COMPANIES: Company[] = Array.from({ length: 96 }).map((_, i) => generateCompany(i));

function generateContactsForCompany(company: Company): Contact[] {
  if (company.status !== "scored") return [];
  const count = randInt(rng, 2, 5);
  return Array.from({ length: count }).map((_, i) => {
    const { first, last } = randomPersonName(rng);
    const { title, seniority } = pick(rng, TITLES);
    const redeemed = rng() < 0.55;
    const emailQuality = redeemed ? pick(rng, ["high", "high", "medium", "low"] as const) : null;
    return {
      id: `contact-${company.id}-${i}`,
      companyId: company.id,
      name: `${first} ${last}`,
      title,
      seniority,
      status: redeemed ? "redeemed" : "listed",
      email: redeemed ? `${first.toLowerCase()}.${last.toLowerCase()}@${company.domain}` : null,
      emailSource: redeemed ? pick(rng, ["cognism", "syntax_match", "apollo", "prospeo"] as const) : null,
      emailQuality,
      phone: redeemed && rng() < 0.7 ? `+1 ${randInt(rng, 200, 999)}-${randInt(rng, 200, 999)}-${randInt(rng, 1000, 9999)}` : null,
      phoneSource: redeemed && rng() < 0.7 ? pick(rng, ["cognism", "syntax_match", "apollo", "prospeo"] as const) : null,
    };
  });
}

export const CONTACTS: Contact[] = COMPANIES.flatMap(generateContactsForCompany);

const USAGE_ACTIONS: { action: UsageItem["action"]; isOpaque: boolean; costRange: [number, number] | null }[] = [
  { action: "creditsafe_report", isOpaque: true, costRange: null },
  { action: "account_redeem", isOpaque: true, costRange: null },
  { action: "contact_redeem", isOpaque: true, costRange: null },
  { action: "firecrawl", isOpaque: false, costRange: [0.02, 0.09] },
  { action: "exa", isOpaque: false, costRange: [0.01, 0.06] },
  { action: "llm", isOpaque: false, costRange: [0.03, 0.14] },
];

function generateUsageRuns(): UsageRun[] {
  const runs: UsageRun[] = [];
  const runUsers = ["Alex Morgan", "Priya Shah", "Tom Whitfield"];
  for (let r = 0; r < 9; r++) {
    const runType: UsageRun["runType"] = r % 3 === 2 ? "contact_pull" : "enrichment";
    const companyCount = randInt(rng, 6, 28);
    const createdAt = randomPastDate(rng, 210, 1);
    const runId = `run-${r}`;
    const items: UsageItem[] = Array.from({ length: randInt(rng, 8, 20) }).map((_, i) => {
      const spec = pick(rng, USAGE_ACTIONS);
      const company = pick(rng, COMPANIES);
      return {
        id: `${runId}-item-${i}`,
        runId,
        action: spec.action,
        companyName: company.name,
        costGbp: spec.costRange ? randFloat(rng, spec.costRange[0], spec.costRange[1], 3) : null,
        isOpaque: spec.isOpaque,
        createdAt,
      };
    });
    runs.push({
      id: runId,
      runType,
      runBy: pick(rng, runUsers),
      companyCount,
      createdAt,
      items,
    });
  }
  return runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const USAGE_RUNS: UsageRun[] = generateUsageRuns();
export const USAGE_ITEMS: UsageItem[] = USAGE_RUNS.flatMap((r) => r.items);

function generateNotifications(): NotificationItem[] {
  const items: NotificationItem[] = [];
  COMPANIES.filter((c) => c.status === "failed").forEach((c, i) => {
    items.push({
      id: `notif-fail-${i}`,
      type: "failed_enrichment",
      message: `${c.name} failed to enrich: ${c.oneLineReason}`,
      companyId: c.id,
      createdAt: c.importedAt,
      read: rng() < 0.4,
    });
  });
  COMPANIES.filter((c) => c.triageReason === "low_confidence_sector").forEach((c, i) => {
    items.push({
      id: `notif-lowconf-${i}`,
      type: "low_confidence",
      message: `${c.name} classified with low confidence (${c.classificationConfidence}%) — needs review.`,
      companyId: c.id,
      createdAt: c.lastEnrichedAt ?? c.importedAt,
      read: rng() < 0.4,
    });
  });
  COMPANIES.filter((c) => c.matchFlag === "no_match").forEach((c, i) => {
    items.push({
      id: `notif-nomatch-${i}`,
      type: "no_match",
      message: `${c.name} scored a no-match against ${c.icp}.`,
      companyId: c.id,
      createdAt: c.lastEnrichedAt ?? c.importedAt,
      read: rng() < 0.5,
    });
  });
  CONTACTS.filter((ct) => ct.emailQuality === "low" || ct.emailQuality === "medium").forEach((ct, i) => {
    items.push({
      id: `notif-email-${i}`,
      type: "low_email_quality",
      message: `${ct.name}'s email came back ${ct.emailQuality} quality after redeem.`,
      companyId: ct.companyId,
      createdAt: randomPastDate(rng, 90, 0),
      read: rng() < 0.5,
    });
  });
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 40);
}

export const NOTIFICATIONS: NotificationItem[] = generateNotifications();

const ADVERSE_EVENT_TYPES = [
  { type: "County court judgment", severity: "high" as const },
  { type: "Director resignation", severity: "medium" as const },
  { type: "Late filing notice", severity: "low" as const },
  { type: "Credit rating downgrade", severity: "high" as const },
  { type: "Ownership change", severity: "medium" as const },
];

function generateAccountRecord(company: Company): AccountRecord {
  const eventCount = randInt(rng, 0, 3);
  const adverseEvents = Array.from({ length: eventCount }).map((_, i) => {
    const spec = pick(rng, ADVERSE_EVENT_TYPES);
    return {
      id: `event-${company.id}-${i}`,
      type: spec.type,
      description: `${spec.type} recorded for ${company.name} via monitoring feed.`,
      date: randomPastDate(rng, 150, 0),
      severity: spec.severity,
    };
  });

  const lastReviewedAt = randomPastDate(rng, 160, 0);

  return {
    companyId: company.id,
    healthScore: randInt(rng, 45, 96),
    adverseEvents,
    qualitative: {
      relationshipHealth: randInt(rng, 2, 5),
      deliverySatisfaction: randInt(rng, 2, 5),
      communication: randInt(rng, 2, 5),
      valuePerceived: randInt(rng, 2, 5),
      renewalLikelihood: randInt(rng, 2, 5),
      lastReviewedAt,
    },
    talentInsights: {
      activeRoles: randInt(rng, 0, 12),
      placementsYtd: randInt(rng, 0, 18),
      avgTimeToFillDays: randInt(rng, 18, 65),
      notes: pick(rng, [
        "Strong pipeline for senior mechanical roles; hiring manager responsive.",
        "Slower cycle on niche precast engineering roles — limited candidate pool.",
        "Expanding headcount ahead of a new facility opening next quarter.",
        "Budget freeze on new roles until Q1 next year.",
      ]),
    },
  };
}

export const ACCOUNTS: AccountRecord[] = COMPANIES.filter((c) => c.lifecycleStatus === "client").map(
  generateAccountRecord,
);

export function getAccountForCompany(companyId: string): AccountRecord | undefined {
  return ACCOUNTS.find((a) => a.companyId === companyId);
}

export function getCompanyById(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id);
}

export function getContactsForCompany(companyId: string): Contact[] {
  return CONTACTS.filter((c) => c.companyId === companyId);
}
