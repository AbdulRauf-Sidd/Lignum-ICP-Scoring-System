-- Account Health redesign: per-dimension Client Scorecard weights and
-- band-based Talent Insights scoring. Run in Supabase's SQL editor.

alter table model_settings
  add column if not exists health_weight_relationship_strength integer not null default 20,
  add column if not exists health_weight_delivery_satisfaction integer not null default 20,
  add column if not exists health_weight_growth_potential integer not null default 20,
  add column if not exists health_weight_payment_reliability integer not null default 20,
  add column if not exists health_weight_strategic_fit integer not null default 20,
  add column if not exists headcount_change_bands text not null default
    '[{"min":-100,"max":-10,"score":20},{"min":-10,"max":0,"score":50},{"min":0,"max":10,"score":70},{"min":10,"max":30,"score":90},{"min":30,"max":1000,"score":100}]',
  add column if not exists attrition_bands text not null default
    '[{"min":0,"max":8,"score":100},{"min":8,"max":15,"score":80},{"min":15,"max":25,"score":55},{"min":25,"max":40,"score":30},{"min":40,"max":1000,"score":10}]',
  add column if not exists tenure_bands text not null default
    '[{"min":0,"max":1,"score":20},{"min":1,"max":3,"score":50},{"min":3,"max":5,"score":75},{"min":5,"max":10,"score":90},{"min":10,"max":100,"score":100}]';
