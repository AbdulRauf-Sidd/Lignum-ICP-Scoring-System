-- Folds the client scorecard + talent insights into active_accounts itself
-- (no update history, just the current value) and drops the two separate
-- tables from 002. Migrates any existing rows in those tables into the new
-- columns first, so nothing entered so far is lost.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

alter table active_accounts
  add column if not exists relationship_strength smallint check (relationship_strength between 1 and 5),
  add column if not exists delivery_satisfaction smallint check (delivery_satisfaction between 1 and 5),
  add column if not exists growth_potential smallint check (growth_potential between 1 and 5),
  add column if not exists payment_reliability smallint check (payment_reliability between 1 and 5),
  add column if not exists strategic_fit smallint check (strategic_fit between 1 and 5),
  add column if not exists headcount_change numeric,
  add column if not exists attrition numeric,
  add column if not exists avg_tenure numeric;

-- Pivot the old (company_id, metric, rating) rows into the new columns.
update active_accounts a
set
  relationship_strength = q.relationship_strength,
  delivery_satisfaction = q.delivery_satisfaction,
  growth_potential = q.growth_potential,
  payment_reliability = q.payment_reliability,
  strategic_fit = q.strategic_fit
from (
  select
    company_id,
    max(rating) filter (where metric = 'relationship_strength') as relationship_strength,
    max(rating) filter (where metric = 'delivery_satisfaction') as delivery_satisfaction,
    max(rating) filter (where metric = 'growth_potential') as growth_potential,
    max(rating) filter (where metric = 'payment_reliability') as payment_reliability,
    max(rating) filter (where metric = 'strategic_fit') as strategic_fit
  from account_qualitative
  group by company_id
) q
where a.company_id = q.company_id;

update active_accounts a
set
  headcount_change = t.headcount_change,
  attrition = t.attrition,
  avg_tenure = t.avg_tenure
from talent_insights t
where a.company_id = t.company_id;

drop table if exists account_qualitative;
drop table if exists talent_insights;
