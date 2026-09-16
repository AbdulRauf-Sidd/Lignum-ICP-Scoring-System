-- Cognism becomes the primary source for revenue and headcount (Creditsafe
-- as fallback when Cognism has no value). These columns record which
-- provider actually supplied each company's value, so the UI can show a
-- "Creditsafe fallback" tag instead of silently claiming Cognism sourced it.
-- Run in Supabase's SQL editor.

alter table companies
  add column if not exists revenue_source text,
  add column if not exists headcount_source text;
