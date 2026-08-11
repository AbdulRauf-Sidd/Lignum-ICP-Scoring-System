-- Fixed, finite value sets. The ICP set itself is deliberately NOT an enum
-- here (see 20260101000003_config.sql) because it must stay extensible in
-- config without a migration, per the build plan.

create type user_role as enum ('admin', 'standard');

create type company_status as enum ('queued', 'enriching', 'triage', 'scored', 'failed');

create type triage_reason as enum ('entity_ambiguous', 'low_confidence_sector', 'icp_no_match');

create type lifecycle_status as enum ('prospect', 'exported', 'client');

create type company_tier as enum ('A', 'B', 'C');

create type match_flag as enum ('match', 'weak', 'no_match');

create type contact_status as enum ('listed', 'redeemed');

create type contact_field_source as enum ('cognism', 'syntax_match', 'apollo', 'prospeo');

create type usage_run_type as enum ('enrichment', 'contact_pull');

create type usage_action as enum (
  'account_redeem',
  'contact_redeem',
  'creditsafe_report',
  'firecrawl',
  'exa',
  'llm'
);
