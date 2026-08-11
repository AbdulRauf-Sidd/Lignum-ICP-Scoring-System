export type CompanyStatus =
  | "queued"
  | "enriching"
  | "triage"
  | "scored"
  | "failed";

export type TriageReason =
  | "entity_ambiguous"
  | "low_confidence_sector"
  | "icp_no_match";

export type LifecycleStatus = "prospect" | "exported" | "client";

export type CompanyTier = "A" | "B" | "C";

export type MatchFlag = "match" | "weak" | "no_match";

export type ContactStatus = "listed" | "redeemed";

export type ContactFieldSource = "cognism" | "syntax_match" | "apollo" | "prospeo";

export type UsageRunType = "enrichment" | "contact_pull";

export type UsageAction =
  | "account_redeem"
  | "contact_redeem"
  | "creditsafe_report"
  | "firecrawl"
  | "exa"
  | "llm";

export interface IcpWeights {
  icp_fit: number;
  scale_footprint: number;
  hiring_growth: number;
  financial_viability: number;
}

export interface IcpProfile {
  slug: string;
  name: string;
  weights: IcpWeights;
  fit_rules: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}
