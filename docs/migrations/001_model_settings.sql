-- Global (not per-ICP) model configuration — a single settings row.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

create table if not exists model_settings (
  id text primary key default 'global',

  -- Tier thresholds: total score maps to a tier.
  tier_a_min integer not null default 82,
  tier_b_min integer not null default 68,

  -- Contact pull rule.
  contact_pull_on_demand boolean not null default true,

  -- Enrichment run settings.
  indicative_price_per_credit numeric,
  re_pull_after_days integer not null default 90,

  -- Currency & exchange rates (all revenue is shown in USD).
  gbp_to_usd_rate numeric not null default 1.27,
  eur_to_usd_rate numeric not null default 1.08,

  -- Account health score weights — must sum to 100.
  health_weight_qualitative integer not null default 50,
  health_weight_talent integer not null default 30,
  health_weight_adverse integer not null default 20,

  -- Client scorecard review reminder.
  review_reminder_days integer not null default 90,

  updated_at timestamptz not null default now()
);

insert into model_settings (id)
values ('global')
on conflict (id) do nothing;
