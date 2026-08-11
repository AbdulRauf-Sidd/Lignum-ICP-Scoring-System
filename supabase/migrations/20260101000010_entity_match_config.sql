-- Minimum confidence before an entity match is accepted automatically
-- rather than paused into triage (build plan section 5, Entity matching).
insert into public.app_config (key, value) values
  ('entity_match_min_score', '0.7'),
  -- A run cannot exceed this many companies; an oversized import is
  -- refused, not processed (build plan section 6, Runaway cost control).
  ('batch_size_cap', '250');
