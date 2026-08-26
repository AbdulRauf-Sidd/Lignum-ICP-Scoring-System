export type CompanyStatus =
  | "queued"
  | "enriching"
  | "triage"
  | "scored"
  | "failed";

export type TriageReason =
  | "entity_ambiguous"
  | "creditsafe_fallback_match"
  | "low_confidence_sector"
  | "insufficient_data"
  | "no_icp_profile"
  | "processing_error"
  | null;

export type LifecycleStatus = "prospect" | "exported" | "client";

export type Tier = "A" | "B" | "C" | null;

export type MatchFlag = "match" | "weak" | "no_match";

export type FieldSource = "creditsafe" | "cognism";

export interface ScoreCategory {
  key: "icp_fit" | "scale_footprint" | "hiring_growth" | "financial_viability";
  label: string;
  subScore: number | null;
  weight: number;
  contribution: number | null;
  excluded: boolean;
}

export interface CandidateEntity {
  id: string;
  name: string;
  domain: string;
  location: string;
  matchScore: number;
  source: "creditsafe" | "creditsafe_website_only" | "creditsafe_name_only" | "cognism";
}

export interface SourcedField {
  field: string;
  value: string;
  source: FieldSource;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  sector: string;
  subSector: string;
  status: CompanyStatus;
  triageReason: TriageReason;
  lifecycleStatus: LifecycleStatus;
  tier: Tier;
  matchFlag: MatchFlag | null;
  icp: string;
  score: number | null;
  confidence: number | null;
  scoringBreakdown: ScoreCategory[];
  revenueUsd: number | null;
  headcount: number | null;
  country: string;
  importedBy: string;
  importedAt: string;
  lastEnrichedAt: string | null;
  candidateEntities: CandidateEntity[];
  creditsafeMatchStrategy: string | null;
  lastError: string | null;
  sourcedFields: SourcedField[];
  exported: boolean;
  classificationConfidence: number | null;
  proposedSector: string | null;
  proposedSubSector: string | null;
  oneLineReason: string;
}

export type ContactStatus = "listed" | "in_process" | "redeemed" | "failed";
export type EmailQuality = "high" | "medium" | "low" | null;
export type DetailSource = "cognism" | "syntax_match" | "apollo" | "prospeo";

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  title: string;
  seniority: string;
  status: ContactStatus;
  email: string | null;
  emailSource: DetailSource | null;
  emailQuality: EmailQuality;
  phone: string | null;
  phoneSource: DetailSource | null;
}

export type UsageAction =
  | "account_redeem"
  | "contact_redeem"
  | "creditsafe_report"
  | "repull_skip";

export interface UsageItem {
  id: string;
  runId: string;
  action: UsageAction;
  companyName: string;
  costGbp: number | null;
  isOpaque: boolean;
  createdAt: string;
}

export interface UsageRun {
  id: string;
  runType: "enrichment" | "contact_pull";
  runBy: string;
  companyCount: number;
  createdAt: string;
  items: UsageItem[];
}

export interface AdverseEvent {
  id: string;
  type: string;
  description: string;
  date: string;
  severity: "low" | "medium" | "high";
}

export interface QualitativeRatings {
  relationshipHealth: number;
  deliverySatisfaction: number;
  communication: number;
  valuePerceived: number;
  renewalLikelihood: number;
  lastReviewedAt: string;
}

export interface TalentInsights {
  activeRoles: number;
  placementsYtd: number;
  avgTimeToFillDays: number;
  notes: string;
}

export interface AccountRecord {
  companyId: string;
  healthScore: number;
  adverseEvents: AdverseEvent[];
  qualitative: QualitativeRatings;
  talentInsights: TalentInsights;
}

export interface IcpProfile {
  id: string;
  name: string;
  sector: string;
  description: string;
  weights: {
    icp_fit: number;
    scale_footprint: number;
    hiring_growth: number;
    financial_viability: number;
  };
}
