-- Adds Creditsafe's "Company Recommendation" Risk Score as a 5th weighted
-- ICP scoring category, plus a display-only Credit Limit reference field.
-- Confirmed field names: additionalInformation.companyRecommendation.creditRating
-- and .creditLimit, found consistently across stored Creditsafe reports.
-- Run in Supabase's SQL editor.

-- weight_credit_risk defaults to 0 so existing icp_profiles rows keep
-- summing to 100 until an admin redistributes weights across 5 categories.
alter table icp_profiles
  add column if not exists weight_credit_risk integer not null default 0,
  add column if not exists credit_risk_bands text not null default
    '[{"min":0,"max":40,"score":20},{"min":40,"max":60,"score":50},{"min":60,"max":75,"score":75},{"min":75,"max":90,"score":90},{"min":90,"max":101,"score":100}]';

alter table companies
  add column if not exists creditsafe_risk_score numeric,
  add column if not exists creditsafe_credit_limit numeric;

alter table scoring_breakdown
  add column if not exists score_credit_risk numeric;
