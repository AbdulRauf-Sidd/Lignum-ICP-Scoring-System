-- Accounts module. An account is a companies row with lifecycle_status =
-- 'client'; these tables are the client-only fields. Cheap to include in
-- the schema now even if the module itself is built in a later phase.

create table public.account_qualitative (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  metric text not null,
  rating int not null check (rating between 1 and 5),
  rated_by uuid references public.users (id),
  rated_at timestamptz not null default now(),
  refresh_due timestamptz
);

create index account_qualitative_company_id_idx on public.account_qualitative (company_id);

create table public.account_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  metric text not null,
  value numeric,
  period text,
  source text,
  pulled_at timestamptz
);

create index account_metrics_company_id_idx on public.account_metrics (company_id);

create table public.account_monitoring (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_type text not null,
  detail text,
  detected_at timestamptz not null default now()
);

create index account_monitoring_company_id_idx on public.account_monitoring (company_id);

create table public.talent_insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  headcount_change numeric,
  attrition numeric,
  avg_tenure numeric,
  entered_by uuid references public.users (id),
  entered_at timestamptz not null default now()
);

create index talent_insights_company_id_idx on public.talent_insights (company_id);
