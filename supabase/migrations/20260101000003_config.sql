-- Config layer. Nothing about scoring is hard-coded: the ICP set itself,
-- the weights, and the shared settings (FX rate, re-pull window, tier
-- thresholds, account health model, metered pricing) all live here and are
-- editable from the admin config screen with no redeploy.

create table public.icp_profiles (
  slug text primary key,
  name text not null,
  -- icp_fit + scale_footprint + hiring_growth + financial_viability must sum to 100
  weights jsonb not null,
  fit_rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.validate_icp_weights()
returns trigger
language plpgsql
as $$
declare
  total numeric;
begin
  select
    coalesce((new.weights ->> 'icp_fit')::numeric, 0)
    + coalesce((new.weights ->> 'scale_footprint')::numeric, 0)
    + coalesce((new.weights ->> 'hiring_growth')::numeric, 0)
    + coalesce((new.weights ->> 'financial_viability')::numeric, 0)
  into total;

  if total is distinct from 100 then
    raise exception 'icp_profiles.weights must sum to 100, got %', total;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger icp_profiles_validate_weights
  before insert or update on public.icp_profiles
  for each row execute function public.validate_icp_weights();

-- Free-form key/value store for the settings that are scalars or small
-- shared structures rather than per-ICP rows: re-pull window, FX rates,
-- tier thresholds, the shared scoring base (categories, bands, confidence
-- rule), the account health model, metered-service pricing, and the
-- contact-pull rule.
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id)
);

create function public.touch_app_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger app_config_touch_updated_at
  before update on public.app_config
  for each row execute function public.touch_app_config_updated_at();

insert into public.app_config (key, value) values
  ('re_pull_window_days', '90'),
  -- to_usd normalises financial fields (Creditsafe/Cognism revenue) on
  -- ingest; usd_to_gbp is only for displaying metered API spend in pounds.
  ('fx_rates', '{"to_usd": {"USD": 1, "GBP": 1.27, "EUR": 1.09}, "usd_to_gbp": 0.79}'),
  ('tier_thresholds', '{"a": 82, "b": 68}'),
  ('scoring_base', '{"categories": ["icp_fit", "scale_footprint", "hiring_growth", "financial_viability"], "revenue_bands_usd": [], "headcount_bands": [], "confidence_rule": {}}'),
  ('account_health_model', '{"weights": {}}'),
  ('metered_pricing', '{"firecrawl_per_crawl": 0, "exa_per_search": 0, "llm_per_1k_tokens": 0}'),
  ('contact_pull_rule', '{}'),
  -- The preset sector/sub-sector list the classifier maps to (build plan
  -- section 5, Classification). Client-provided; edit here, not in code.
  ('sector_taxonomy', '[
    {"sector": "Data Centres", "sub_sectors": ["Mechanical – Liquid Cooling/HVAC", "Electrical – Power Distribution"]},
    {"sector": "Modular and Pre-Fabrication", "sub_sectors": ["Volumetric Modular", "Structural Precast Concrete", "Architectural Precast Concrete"]},
    {"sector": "Filtration Solutions", "sub_sectors": ["Filtration Manufacturer"]},
    {"sector": "Commercial Construction", "sub_sectors": ["Curtain Wall Specialists", "Exterior Wall Panel Specialists", "Woodworking Specialists", "Roofing Specialists", "Interiors Specialists"]}
  ]');

insert into public.icp_profiles (slug, name, weights, fit_rules) values
  ('icp_1', 'ICP 1', '{"icp_fit": 40, "scale_footprint": 20, "hiring_growth": 20, "financial_viability": 20}', '{}'),
  ('icp_2', 'ICP 2', '{"icp_fit": 40, "scale_footprint": 20, "hiring_growth": 20, "financial_viability": 20}', '{}'),
  ('icp_3', 'ICP 3', '{"icp_fit": 40, "scale_footprint": 20, "hiring_growth": 20, "financial_viability": 20}', '{}'),
  ('icp_4', 'ICP 4', '{"icp_fit": 40, "scale_footprint": 20, "hiring_growth": 20, "financial_viability": 20}', '{}');
