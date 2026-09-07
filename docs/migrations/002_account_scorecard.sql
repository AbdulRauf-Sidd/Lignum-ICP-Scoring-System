-- Client scorecard (manual 1-5 ratings) and Talent Insights (manual entry)
-- for the Accounts page. One row per (company_id, metric) for ratings, so a
-- new rated dimension can be added later without a migration; one row per
-- company for talent insights, since those fields are always entered together.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

create table if not exists account_qualitative (
  company_id bigint not null,
  metric text not null check (metric in (
    'relationship_strength',
    'delivery_satisfaction',
    'growth_potential',
    'payment_reliability',
    'strategic_fit'
  )),
  rating smallint not null check (rating between 1 and 5),
  rated_by text,
  rated_at timestamptz not null default now(),
  refresh_due timestamptz,
  primary key (company_id, metric)
);

create table if not exists talent_insights (
  company_id bigint primary key,
  headcount_change numeric,
  attrition numeric,
  avg_tenure numeric,
  entered_by text,
  entered_at timestamptz not null default now()
);
