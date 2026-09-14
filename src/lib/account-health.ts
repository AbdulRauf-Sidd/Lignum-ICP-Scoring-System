import type { QualitativeMetric, QualitativeRatings, TalentInsights, HealthWeights, Band } from "@/lib/data/accounts";

// Ports the account-health model from the design mockup
// (docs/Lignum ICP Scoring.html), then replaces two pieces the client asked
// to make configurable: the Client Scorecard's 5 dimensions now combine via
// per-dimension weights (sliders in Model config, sum to 100) instead of a
// plain average, and each Talent Insights metric now maps through its own
// band table (also Model config) instead of one hardcoded formula.
//
// The mockup's "Adverse -6" comes from randomly-generated demo events
// (Creditsafe/Cognism data this app has no real feed for yet) — rather than
// fabricate events, that term is fixed at 0 here until a real adverse-event
// source exists.

const QUALITATIVE_DIMENSIONS: QualitativeMetric[] = [
  "relationship_strength",
  "delivery_satisfaction",
  "growth_potential",
  "payment_reliability",
  "strategic_fit",
];

// Neutral baselines the mockup falls back to for a dimension/field that
// hasn't been entered yet — not a guess about the specific company, just the
// formula's own defined "nothing rated yet" starting point.
const QUAL_DEFAULT_RATING = 3;
const TALENT_DEFAULTS = { headcountChange: 0, attrition: 12, tenure: 5 };
// Used when a metric's value doesn't fall inside any configured band (e.g.
// the admin hasn't set up bands for it yet, or the value is outside every
// range) — a neutral midpoint rather than 0, so a missing band config
// doesn't tank the score.
const NEUTRAL_BAND_SCORE = 50;

export type HealthBand = "healthy" | "watch" | "at_risk";

export interface AccountHealth {
  score: number;
  band: HealthBand;
  qualAvg: number;
  talentScore: number;
  adversePenalty: number;
  // True when nothing's been entered yet — the score is built entirely from
  // the neutral baselines above, not real signal.
  isBaseline: boolean;
}

function scoreFromBands(value: number, bands: Band[]): number | null {
  const band = bands.find((b) => value >= b.min && value < b.max);
  return band ? band.score : null;
}

function talentScore(talent: TalentInsights, bands: HealthWeights["talentBands"]): number {
  const headcountChange = talent.headcountChange ?? TALENT_DEFAULTS.headcountChange;
  const attrition = talent.attrition ?? TALENT_DEFAULTS.attrition;
  const tenure = talent.avgTenure ?? TALENT_DEFAULTS.tenure;

  const headcountScore = scoreFromBands(headcountChange, bands.headcountChange) ?? NEUTRAL_BAND_SCORE;
  const attritionScore = scoreFromBands(attrition, bands.attrition) ?? NEUTRAL_BAND_SCORE;
  const tenureScore = scoreFromBands(tenure, bands.avgTenure) ?? NEUTRAL_BAND_SCORE;

  return Math.round((headcountScore + attritionScore + tenureScore) / 3);
}

export function computeAccountHealth(ratings: QualitativeRatings, talent: TalentInsights, weights: HealthWeights): AccountHealth {
  const scorecardWeightSum = QUALITATIVE_DIMENSIONS.reduce((sum, d) => sum + (weights.scorecardWeights[d] || 0), 0) || 1;
  const qualAvg =
    QUALITATIVE_DIMENSIONS.reduce((sum, d) => sum + (ratings[d] ?? QUAL_DEFAULT_RATING) * (weights.scorecardWeights[d] || 0), 0) /
    scorecardWeightSum;
  const qual100 = (qualAvg / 5) * 100;

  const talent100 = talentScore(talent, weights.talentBands);
  const adversePenalty = 0; // no real adverse-event source yet

  const weightSum = Math.max(1, weights.qual + weights.talent);
  const base = (qual100 * weights.qual + talent100 * weights.talent) / weightSum;
  const health = base - adversePenalty * (weights.adverse / 100);
  const score = Math.max(0, Math.min(100, Math.round(health)));

  const band: HealthBand = score >= 75 ? "healthy" : score >= 55 ? "watch" : "at_risk";

  const noRatings = QUALITATIVE_DIMENSIONS.every((d) => ratings[d] === null);
  const noTalent = talent.headcountChange === null && talent.attrition === null && talent.avgTenure === null;

  return {
    score,
    band,
    qualAvg,
    talentScore: talent100,
    adversePenalty,
    isBaseline: noRatings && noTalent,
  };
}
