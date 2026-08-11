# Week 1 — Import & Enrichment (n8n)

Week 1 as scoped to the client: no UI, just an n8n workflow. Import a list of companies, click
run, watch it pull financial and firmographic data from Creditsafe and Cognism automatically, with
no double-charge on a re-run. It reads/writes the schema in `supabase/migrations/` — apply those
to your Supabase project first.

**Build it yourself in the n8n editor following [`BUILD_GUIDE.md`](./BUILD_GUIDE.md)** — that file
has the exact node-by-node instructions: what to add, how to name it, the SQL/JS/HTTP config to
type in, and how everything connects.

I haven't run this against a live n8n instance or live Creditsafe/Cognism credentials — neither
exists in this environment. The queries and code in the build guide are correct against the schema
and the build plan's documented API shapes, but treat your first run as a dry run and expect a
couple of small fixes once you're against real payloads (see "Known rough edges" below).

## Sample data

- `sample-data/import.csv` — real client-provided companies (company name + domain), ready to
  point `Batch Settings.csv_path` at.
- `sample-data/client-labeled-sectors.csv` — the same companies with the client's own
  sector/sub-sector labels (including primary/secondary where given). Not used by this workflow —
  classification is Week 3 — but worth keeping to sanity-check the LLM classifier against later.
  One thing to flag to the client: their taxonomy list says "Filtration Manufacturer" (singular)
  but this sample says "Filtration Manufacturers" (plural) for Facet Filtration — worth confirming
  which is correct before `app_config.sector_taxonomy` is finalised.

## Proving "no double-charge on a re-run"

Run the workflow twice in a row against the same CSV. The second run should: insert nothing new
(domains already exist), claim nothing (companies are no longer `queued`), and if you manually
reset a company back to `queued` to force it through again, the idempotency check should skip the
redeem calls entirely because `enrichment_data` already has a row inside the re-pull window (90
days by default, `app_config.re_pull_window_days`).

## Known rough edges (check these first)

- **The IF nodes.** Use n8n's older, very stable boolean-condition schema. n8n may offer to
  "upgrade" them on first open — fine, just confirm the condition still reads as a plain boolean
  check afterwards.
- **Creditsafe's and Cognism's actual response field names** (`token`, `companies[].id`,
  `matchScore`, `hasIndustry`, `revenue.amount`/`revenue.currency`, etc.) are what the build plan's
  data dictionary describes, not copied from a live API spec. Once you have trial credentials, run
  one company through manually and adjust field names in the `Resolve Entity Match` and
  `Normalise & Merge` Code nodes if the real payloads differ.
- **Creditsafe Authenticate runs once per company** rather than once per batch — correct but
  wasteful. Fine at these volumes (tens to low hundreds per batch); worth caching the token across
  the loop later if the auth endpoint turns out to be rate-limited.
- **Malformed/missing domains are silently dropped** on import (no UI exists yet to show a
  fix-or-remove screen) — compare the source CSV's row count to what lands in `companies` to spot
  what got skipped.

## Config this workflow reads, not hard-codes

All in `app_config` (edit directly in Supabase for now — the admin config screen for this lands in
a later phase): `re_pull_window_days`, `entity_match_min_score`, `batch_size_cap`, `fx_rates`. ICPs
are rows in `icp_profiles`.

## Not in this workflow

- Swapping the Manual Trigger for a Webhook trigger, secured with a shared secret, once the app
  exists to call it (build plan section 6: "Secure the webhook so only the app can call it").
- Classification (Firecrawl + Exa + LLM) and scoring — Week 3.
- A dead-letter state for a company that exhausts HTTP retries — right now it just sits at
  whatever status it was in when the node finally throws and the execution stops.
