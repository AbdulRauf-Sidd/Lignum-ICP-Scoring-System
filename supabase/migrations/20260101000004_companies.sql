-- The prospect, later account, record. Fields here are the curated summary
-- shown in lists and used for status/lifecycle; the raw provider payloads
-- live in enrichment_data so the model can be re-run without new spend.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  domain text not null unique,
  icp text references public.icp_profiles (slug),
  sector text,
  sub_sector text,
  classification_confidence int,
  status company_status not null default 'queued',
  triage_reason triage_reason,
  lifecycle_status lifecycle_status not null default 'prospect',
  score int,
  tier company_tier,
  confidence int,
  match_flag match_flag,
  company_number text,
  linkedin_url text,
  hq_country text,
  hq_state text,
  hq_city text,
  site_count int,
  failure_reason text,
  -- queue: a row is claimed atomically by setting locked_by/locked_at so two
  -- workers never take the same company out of a batch
  locked_by text,
  locked_at timestamptz,
  retry_count int not null default 0,
  imported_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  enriched_at timestamptz,
  exported_at timestamptz,
  last_scored_at timestamptz
);

create index companies_status_idx on public.companies (status);
create index companies_imported_by_idx on public.companies (imported_by);
create index companies_lifecycle_status_idx on public.companies (lifecycle_status);
create index companies_icp_idx on public.companies (icp);
