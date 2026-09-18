-- Adds configurable reference costs (per CV submission, per first interview)
-- to the global model settings row, shown alongside the existing indicative
-- price per credit on the Model config page.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

alter table model_settings
  add column if not exists cv_cost numeric,
  add column if not exists interview_cost numeric;
