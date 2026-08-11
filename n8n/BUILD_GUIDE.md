# Week 1 workflow — build guide

Node-by-node instructions for building the import/enrichment workflow yourself in the n8n editor.
No UI beyond n8n itself: a CSV in, Creditsafe + Cognism data out, no double-charge on a re-run.

Reads/writes the schema in `supabase/migrations/` — apply those to your Supabase project first.

## Before you start

**One Postgres credential**, name it `Supabase Postgres`: Supabase → Project Settings → Database →
Connection string (use the pooler, port 6543, SSL required). Needs write access to all tables —
this is n8n's own credential, separate from the app's RLS-scoped anon key.

**Three environment variables on the n8n instance** (n8n Cloud: Settings → Variables;
self-hosted: env vars on the container) — read via `$env` in HTTP nodes, never typed into the
workflow itself:
- `COGNISM_API_KEY`
- `CREDITSAFE_USERNAME`
- `CREDITSAFE_PASSWORD`

A sample CSV to import against is at `sample-data/import.csv`.

---

## 1. Trigger and batch settings

**Manual Trigger** — name it `Start`. No parameters.

**Edit Fields (Set)** — name it `Batch Settings`. Connect from `Start`. Add two string fields:
- `icp` = `icp_1` (must match a row in `icp_profiles.slug` — edit before each run to pick the
  batch's ICP)
- `csv_path` = `/data/import.csv` (wherever your n8n instance can read the file from disk)

---

## 2. Load shared config

**Postgres** (credential: `Supabase Postgres`) — name it `Load Config`. Connect from
`Batch Settings`. Operation: **Execute Query**.

```sql
SELECT key, value FROM app_config
WHERE key IN ('re_pull_window_days', 'entity_match_min_score', 'batch_size_cap', 'fx_rates');
```

**Code** — name it `Shape Config`. Connect from `Load Config`. Reshapes the four config rows into
one item so later nodes can reference single fields by name instead of scanning rows:

```js
const rows = $input.all();
const config = {};
for (const row of rows) {
  config[row.json.key] = row.json.value;
}

return [{
  json: {
    re_pull_window_days: config.re_pull_window_days,
    entity_match_min_score: config.entity_match_min_score,
    batch_size_cap: config.batch_size_cap,
    fx_rates: config.fx_rates,
    icp: $('Batch Settings').first().json.icp,
  },
}];
```

**Postgres** — name it `Create Usage Run`. Connect from `Shape Config`. Execute Query:

```sql
INSERT INTO usage_runs (run_type, icp, started_at)
VALUES ('enrichment', '{{ $json.icp.replace(/'/g, "''") }}', now())
RETURNING id;
```

This branch (`Load Config` → `Shape Config` → `Create Usage Run`) ends here — nothing connects
out of `Create Usage Run`. You'll reference it later by name, not by wiring.

---

## 3. Import the CSV

Connect these from `Batch Settings` too — it now fans out to two branches (this one, and the one
above).

**Read/Write File** — name it `Read Import CSV`. Operation: **Read**. File selector:
`={{ $('Batch Settings').first().json.csv_path }}`

**Extract From File** — name it `Parse CSV`. Connect from `Read Import CSV`. Operation: **CSV**.

**Code** — name it `Validate & Normalise Domains`. Connect from `Parse CSV`. Domain is mandatory;
malformed ones are dropped here (there's no UI yet to flag them for a fix):

```js
const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const icp = $('Batch Settings').first().json.icp;
const out = [];

for (const item of $input.all()) {
  const domain = String(item.json.domain || '').trim().toLowerCase();
  const companyName = String(item.json.company_name || '').trim();

  if (!domain || !domainRegex.test(domain)) {
    continue;
  }

  out.push({ json: { company_name: companyName || domain, domain, icp } });
}

return out;
```

**Postgres** — name it `Import Companies`. Connect from `Validate & Normalise Domains`. Execute
Query (runs once per item automatically — this node receives many items, one per CSV row):

```sql
INSERT INTO companies (company_name, domain, icp, status, lifecycle_status)
VALUES (
  '{{ $json.company_name.replace(/'/g, "''") }}',
  '{{ $json.domain.replace(/'/g, "''") }}',
  '{{ $json.icp.replace(/'/g, "''") }}',
  'queued',
  'prospect'
)
ON CONFLICT (domain) DO NOTHING;
```

`ON CONFLICT (domain) DO NOTHING` is the dedupe — this is also half of the no-double-charge
guarantee (the other half is the idempotency check in step 5).

---

## 4. Claim a batch and start the loop

**Postgres** — name it `Claim Queued Companies`. Connect from `Import Companies`. Execute Query.
**Open the node's settings (the three-dot menu) and turn on "Execute Once"** — this must run
exactly once even though `Import Companies` hands it many items.

```sql
UPDATE companies
SET status = 'enriching', locked_by = '{{ $execution.id }}', locked_at = now()
WHERE id IN (
  SELECT id FROM companies
  WHERE status = 'queued' AND icp = '{{ $('Shape Config').first().json.icp.replace(/'/g, "''") }}'
  ORDER BY created_at
  LIMIT {{ $('Shape Config').first().json.batch_size_cap }}
  FOR UPDATE SKIP LOCKED
)
RETURNING id, domain, company_name;
```

`FOR UPDATE SKIP LOCKED` is the atomic queue claim (two runs can never grab the same company);
`batch_size_cap` is the runaway-cost ceiling. Its `RETURNING` rows are what feed the loop below —
one item per claimed company.

**Loop Over Items (Split In Batches)** — name it `Loop Over Items`. Connect from
`Claim Queued Companies`. Batch size: `1`. This node has two outputs:
- **Output 0 ("done")** → wire to `Finalise Usage Run` (step 7, build that node now and connect
  it, even though it comes last logically).
- **Output 1 ("loop")** → wire to `Check Existing Enrichment`, the start of the per-company chain
  below.

---

## 5. Per company: idempotency check

**Postgres** — name it `Check Existing Enrichment`. Connect from `Loop Over Items`' loop output.

```sql
SELECT created_at FROM enrichment_data
WHERE company_id = '{{ $json.id }}'::uuid
ORDER BY created_at DESC
LIMIT 1;
```

**Code** — name it `Check Idempotency`. Connect from `Check Existing Enrichment`. This is the
no-double-charge check on a re-run:

```js
const rePullWindowDays = $('Shape Config').first().json.re_pull_window_days;
const company = $('Claim Queued Companies').item.json;
const existingRows = $input.all();

let withinWindow = false;
let existingEnrichedAt = null;

if (existingRows.length > 0) {
  existingEnrichedAt = existingRows[0].json.created_at;
  const createdAt = new Date(existingEnrichedAt);
  const cutoff = new Date(Date.now() - rePullWindowDays * 24 * 60 * 60 * 1000);
  withinWindow = createdAt > cutoff;
}

return [{
  json: {
    id: company.id,
    domain: company.domain,
    company_name: company.company_name,
    withinWindow,
    existingEnrichedAt,
  },
}];
```

**IF** — name it `Already Enriched Recently?`. Connect from `Check Idempotency`. Condition:
boolean, `{{$json.withinWindow}}` is `true`.

- **True branch** → **Postgres** `Mark Already Enriched`:
  ```sql
  UPDATE companies
  SET enriched_at = COALESCE(enriched_at, '{{ $json.existingEnrichedAt }}')
  WHERE id = '{{ $json.id }}'::uuid;
  ```
  Connect its output back into `Loop Over Items` (closes the loop for this item — no charge, no
  further calls).

- **False branch** → continue to step 6.

---

## 6. Validation gate and entity matching

**HTTP Request** — name it `Cognism Enrich (Free)`. Connect from the IF node's false branch.
- Method: POST, URL: `https://app.cognism.com/api/account/enrich`
- Headers: `Authorization: Bearer {{$env.COGNISM_API_KEY}}`, `Content-Type: application/json`
- Body (JSON): `={{ JSON.stringify({ domain: $('Check Idempotency').item.json.domain }) }}`
- In node settings: **Retry On Fail** on, max tries `3`, wait between tries `1000`ms (covers
  429/5xx backoff)

**Code** — name it `Validation Gate`. Connect from `Cognism Enrich (Free)`. Pass rule: industry
present AND (revenue or headcount present):

```js
const enrich = $input.first().json;
const pass = Boolean(enrich.hasIndustry) && (Boolean(enrich.hasRevenue) || Boolean(enrich.hasHeadcount));
return [{ json: { pass, matchScore: enrich.matchScore } }];
```

**IF** — name it `Passes Gate?`. Connect from `Validation Gate`. Condition: boolean,
`{{$json.pass}}` is `true`.

- **False branch** → **Postgres** `Mark Insufficient Data`:
  ```sql
  UPDATE companies
  SET status = 'failed', failure_reason = 'insufficient_data'
  WHERE id = '{{ $('Check Idempotency').item.json.id }}'::uuid;
  ```
  Connect back into `Loop Over Items`. This is the cost gate — nothing paid gets called for a
  company that fails here.

- **True branch** → continue.

**HTTP Request** — name it `Creditsafe Authenticate`. Connect from `Passes Gate?`'s true branch.
- Method: POST, URL: `https://connect.creditsafe.com/v1/authenticate`
- Body (JSON): `={{ JSON.stringify({ username: $env.CREDITSAFE_USERNAME, password: $env.CREDITSAFE_PASSWORD }) }}`

**HTTP Request** — name it `Creditsafe Search`. Connect from `Creditsafe Authenticate`.
- Method: GET, URL:
  `=https://connect.creditsafe.com/v1/companies?domain={{ encodeURIComponent($('Check Idempotency').item.json.domain) }}&name={{ encodeURIComponent($('Check Idempotency').item.json.company_name) }}`
- Headers: `Authorization: Bearer {{$json.token}}` (the token from `Creditsafe Authenticate`,
  directly upstream)

**Code** — name it `Resolve Entity Match`. Connect from `Creditsafe Search`. Never silently takes
the top hit — a low match score, no candidate, or more than one strong candidate all fail this:

```js
const minScore = $('Shape Config').first().json.entity_match_min_score;
const matchScore = $('Cognism Enrich (Free)').item.json.matchScore;
const items = $input.all().map((i) => i.json);
// Creditsafe Search returns an array; depending on how n8n splits an array
// HTTP response this may be one item per candidate or one item wrapping
// the array — handle both.
const candidates = items.length === 1 && Array.isArray(items[0]) ? items[0] : items;

const ok = matchScore >= minScore && candidates.length === 1;

return [{
  json: {
    ok,
    creditsafeCompanyId: ok ? candidates[0].id : null,
  },
}];
```

**IF** — name it `Entity Match OK?`. Connect from `Resolve Entity Match`. Condition: boolean,
`{{$json.ok}}` is `true`.

- **False branch** → **Postgres** `Mark Entity Ambiguous`:
  ```sql
  UPDATE companies
  SET status = 'triage', triage_reason = 'entity_ambiguous'
  WHERE id = '{{ $('Check Idempotency').item.json.id }}'::uuid;
  ```
  Connect back into `Loop Over Items`.

- **True branch** → continue to step 7.

---

## 7. Redeem, store, and log

**HTTP Request** — name it `Cognism Redeem`. Connect from `Entity Match OK?`'s true branch.
- Method: POST, URL: `https://app.cognism.com/api/account/redeem`
- Same headers as `Cognism Enrich (Free)`; body:
  `={{ JSON.stringify({ domain: $('Check Idempotency').item.json.domain }) }}`
- Retry On Fail on, same as before (this one's paid, so a transient failure shouldn't silently
  drop the company)

**HTTP Request** — name it `Creditsafe Report`. Connect from `Cognism Redeem`.
- Method: GET, URL:
  `=https://connect.creditsafe.com/v1/companies/{{ $('Resolve Entity Match').item.json.creditsafeCompanyId }}`
- Headers: `Authorization: Bearer {{ $('Creditsafe Authenticate').item.json.token }}`
- Retry On Fail on

**Code** — name it `Normalise & Merge`. Connect from `Creditsafe Report`. USD normalisation, and
the source-of-truth waterfall (Creditsafe's actual revenue takes priority, Cognism fills gaps).
Also pre-builds SQL-literal strings so the next node's query stays a plain string with no
per-field null-handling logic in it:

```js
const cognism = $('Cognism Redeem').item.json;
const creditsafe = $('Creditsafe Report').item.json;
const fxRates = $('Shape Config').first().json.fx_rates;

function toUsd(money) {
  if (!money || money.amount == null) return null;
  const rate = fxRates?.to_usd?.[money.currency] ?? 1;
  return Math.round(money.amount * rate);
}

function sqlText(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined ? 'NULL' : Number(value);
}

const revenueUsd = toUsd(creditsafe.revenue) ?? toUsd(cognism.revenue);
const hq = (cognism.locations || []).find((l) => l.type === 'hq') || {};
const siteCount = creditsafe.locationCount ?? (cognism.locations || []).length;

return [{
  json: {
    revenue_usd: revenueUsd,
    linkedin_url_sql: sqlText(cognism.linkedinUrl),
    hq_country_sql: sqlText(hq.country),
    hq_state_sql: sqlText(hq.state),
    hq_city_sql: sqlText(hq.city),
    site_count_sql: sqlNumber(siteCount),
    company_number_sql: sqlText(creditsafe.companyNumber),
    creditsafe_json: creditsafe,
    cognism_json: cognism,
  },
}];
```

**Postgres** — name it `Store Enrichment Data`. Connect from `Normalise & Merge`.

```sql
INSERT INTO enrichment_data (company_id, creditsafe_json, cognism_json)
VALUES (
  '{{ $('Check Idempotency').item.json.id }}'::uuid,
  '{{ JSON.stringify($json.creditsafe_json).replace(/'/g, "''") }}'::jsonb,
  '{{ JSON.stringify($json.cognism_json).replace(/'/g, "''") }}'::jsonb
);
```

**Postgres** — name it `Update Company Summary`. Connect from `Store Enrichment Data`. Note:
status stays `'enriching'`, not `'scored'` — classification/scoring is Week 3, and `enriched_at`
is what that later phase would poll on.

```sql
UPDATE companies SET
  status = 'enriching',
  enriched_at = now(),
  linkedin_url = {{ $json.linkedin_url_sql }},
  hq_country = {{ $json.hq_country_sql }},
  hq_state = {{ $json.hq_state_sql }},
  hq_city = {{ $json.hq_city_sql }},
  site_count = {{ $json.site_count_sql }},
  company_number = {{ $json.company_number_sql }}
WHERE id = '{{ $('Check Idempotency').item.json.id }}'::uuid;
```

**Postgres** — name it `Log Usage`. Connect from `Update Company Summary`. Native-unit counts only
(Cognism and Creditsafe are opaque-cost services — no currency figure):

```sql
INSERT INTO usage_items (run_id, company_id, action, credits)
VALUES
  ('{{ $('Create Usage Run').first().json.id }}'::uuid, '{{ $('Check Idempotency').item.json.id }}'::uuid, 'account_redeem', 1),
  ('{{ $('Create Usage Run').first().json.id }}'::uuid, '{{ $('Check Idempotency').item.json.id }}'::uuid, 'creditsafe_report', 1);
```

Connect its output back into `Loop Over Items` — this closes the loop for a fully-processed
company.

---

## 8. Finalise the run

**Postgres** — name it `Finalise Usage Run`. Connect from `Loop Over Items`' **done** output (see
step 4). Turn on **Execute Once** in node settings.

```sql
UPDATE usage_runs SET
  companies = (SELECT count(DISTINCT company_id) FROM usage_items WHERE run_id = '{{ $('Create Usage Run').first().json.id }}'::uuid),
  reports = (SELECT count(*) FROM usage_items WHERE run_id = '{{ $('Create Usage Run').first().json.id }}'::uuid AND action = 'creditsafe_report'),
  account_credits = (SELECT coalesce(sum(credits), 0) FROM usage_items WHERE run_id = '{{ $('Create Usage Run').first().json.id }}'::uuid AND action = 'account_redeem'),
  completed_at = now()
WHERE id = '{{ $('Create Usage Run').first().json.id }}'::uuid;
```

---

## Sanity checks once it's wired up

- **Run it twice on the same CSV.** Second run should import nothing new (domain conflict),
  claim nothing (nothing's `queued` anymore), and if you manually reset a company back to
  `queued`, `Check Idempotency` should skip it straight to `Mark Already Enriched` with no
  Cognism/Creditsafe calls — that's the no-double-charge guarantee working.
- **Force a gate failure** by testing against a company you know Cognism has thin data on —
  confirm it lands at `status = failed, failure_reason = insufficient_data` and nothing downstream
  fires.
- **Force an ambiguous match** (a company with a very common name) — confirm it lands at
  `status = triage, triage_reason = entity_ambiguous`.
- **Check `usage_items` and `usage_runs`** after a full run — credits should be exactly 1 per
  redeemed company per action, no more.

## Config this workflow should read, not hard-code

All in `app_config` — edit directly in Supabase for now: `re_pull_window_days`,
`entity_match_min_score`, `batch_size_cap`, `fx_rates`. ICPs are rows in `icp_profiles`.

## Not in this workflow

- Swapping the Manual Trigger for a Webhook trigger (secured with a shared secret) once the app
  exists to call it.
- Classification (Firecrawl + Exa + LLM) and scoring — Week 3.
- A dead-letter state for a company that exhausts HTTP retries — right now it just stops wherever
  it was when the node throws.
