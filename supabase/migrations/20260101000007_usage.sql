-- Usage log and its audit trail. Counts come from the app's own calls, not
-- a provider balance (no balance endpoint exists for Cognism or Creditsafe).
create table public.usage_runs (
  id uuid primary key default gen_random_uuid(),
  run_type usage_run_type not null,
  icp text references public.icp_profiles (slug),
  -- Nullable: a run triggered directly in n8n (no signed-in app user) has
  -- no run_by. Only visible to admins in that case (see RLS policy).
  run_by uuid references public.users (id),
  companies int not null default 0,
  reports int not null default 0,
  account_credits int not null default 0,
  contact_credits int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index usage_runs_run_by_idx on public.usage_runs (run_by);

create table public.usage_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.usage_runs (id) on delete cascade,
  company_id uuid references public.companies (id),
  contact_id uuid references public.contacts (id),
  action usage_action not null,
  -- Opaque-cost services (Cognism, Creditsafe): a count, no price is known.
  credits int,
  -- Transparent-cost services (Firecrawl, Exa, LLM): the actual metered
  -- cost, in the currency the provider billed. Converted to GBP for display
  -- using app_config.fx_rates rather than stored twice.
  cost_amount numeric,
  cost_currency text default 'USD',
  created_at timestamptz not null default now()
);

create index usage_items_run_id_idx on public.usage_items (run_id);
create index usage_items_company_id_idx on public.usage_items (company_id);
