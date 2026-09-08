import type { QualitativeMetric, QualitativeRatings, TalentInsights, HealthWeights } from "@/lib/data/accounts";

// Ports the account-health model from the design mockup
// (docs/Lignum ICP Scoring.html) formula-for-formula — verified against its
// own worked example (ratings 4/4/3/5/4, talent 86, adverse penalty 6 →
// score 81, "Healthy"). `model_settings.health_weight_*` already holds the
// same 50/30/20 default weights the mockup used.
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

function talentScore(talent: TalentInsights): number {
  const headcountChange = talent.headcountChange ?? TALENT_DEFAULTS.headcountChange;
  const attrition = talent.attrition ?? TALENT_DEFAULTS.attrition;
  const tenure = talent.avgTenure ?? TALENT_DEFAULTS.tenure;
  const raw = 60 + headcountChange * 1.6 - (attrition - 12) * 2.2 + (tenure - 4) * 5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function computeAccountHealth(ratings: QualitativeRatings, talent: TalentInsights, weights: HealthWeights): AccountHealth {
  const qualAvg = QUALITATIVE_DIMENSIONS.reduce((sum, d) => sum + (ratings[d] ?? QUAL_DEFAULT_RATING), 0) / QUALITATIVE_DIMENSIONS.length;
  const qual100 = (qualAvg / 5) * 100;

  const talent100 = talentScore(talent);
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
