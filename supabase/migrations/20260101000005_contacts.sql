create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text,
  job_title text,
  seniority text,
  management_level text,
  job_function text,
  linkedin_url text,
  email text,
  email_quality text,
  direct_dial text,
  mobile text,
  email_source contact_field_source,
  phone_source contact_field_source,
  -- Cognism's redeem id, kept so a re-redeem attempt can be detected and
  -- skipped rather than re-charged.
  redeem_id text,
  status contact_status not null default 'listed',
  created_at timestamptz not null default now(),
  pulled_at timestamptz
);

create index contacts_company_id_idx on public.contacts (company_id);
create index contacts_status_idx on public.contacts (status);
