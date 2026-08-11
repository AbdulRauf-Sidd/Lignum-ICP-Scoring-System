-- Raw provider payloads, retained so classification/scoring can be re-run
-- from stored data with no new API spend.
create table public.enrichment_data (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  creditsafe_json jsonb,
  cognism_json jsonb,
  firecrawl_json jsonb,
  exa_json jsonb,
  created_at timestamptz not null default now()
);

create index enrichment_data_company_id_idx on public.enrichment_data (company_id);

-- One row per score, kept over time rather than overwritten, so trends
-- (a sector cooling, an account going quiet) can be reconstructed later.
-- companies.score/tier/confidence cache the latest row for list views.
create table public.scoring_breakdown (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  icp_profile text not null references public.icp_profiles (slug),
  icp_fit int,
  scale_footprint int,
  hiring_growth int,
  financial_viability int,
  completeness int,
  total_score int,
  tier company_tier,
  match_flag match_flag,
  scored_at timestamptz not null default now()
);

create index scoring_breakdown_company_id_idx on public.scoring_breakdown (company_id);
create index scoring_breakdown_scored_at_idx on public.scoring_breakdown (scored_at);
