# ICP Scoring & Accounts System
## Build Plan for Developer Quotation

**Status:** Provisional. This is the intended design; a developer is welcome to propose better approaches, particularly on orchestration and hosting.

**Pairs with:** the architecture and flow document (the visual map), which holds the diagrams, the full datapoint table and the schema in visual form. This document is the build detail: rules, behaviours, acceptance criteria and build order.

---

## 1. What is being built

A web application that takes a list of companies, enriches each across two data services, classifies it by sector, scores it against a chosen ideal customer profile, and presents a ranked, tiered list a commercial team works from. The same company records live on as accounts once they convert, carrying monitoring, qualitative scoring and per-client delivery metrics.

The core build is the prospect engine: import, enrich, classify, score, triage, target list, contacts, and the oversight views (usage, analytics, notifications, home). Everything in sections 2 to 10 is in scope for the core build unless marked optional.

Some modules can be built now or deferred to a later evolution, at your choice. The Accounts module is the main one; further out sit intent-signal monitoring, in-platform market mapping, live Loxo metrics and automated routing. These are listed in section 11.

**Scope and effort.** The requirements here are unusually well defined, which removes the biggest time sink. With AI-assisted development the standard screens and CRUD come quickly; the real effort is the integration edges, four external services each with auth, pagination, rate limits and quirks, plus the credit and cost model, the queue and resumability, and the idempotency that stops a retry double-charging. A realistic estimate for a strong developer, core build as specified, is roughly three to five weeks of focused work. Cutting the Accounts module from the first round is the single biggest way to shrink and de-risk it. A two-week quote is almost certainly pricing the happy path only.

The user works in business terms only. No API, database or field-name language appears on screen.

---

## 2. Stack and architecture

- **Front end:** Next.js, deployed to Vercel.
- **Database:** Supabase (Postgres).
- **Orchestration:** n8n runs the enrichment, classification and scoring pipeline. Preference is n8n for visibility and ease of maintenance, but a developer may propose an in-app/code orchestration if it is as reliable and maintainable; state which you are quoting. Likely n8n Cloud on a base tier, so the work must be queued and chunked to stay within its concurrency and execution limits (section 5, Queueing).
- **Access:** two roles, admin and standard, with row-level security. Some views are shared, some scoped to the user, some admin-only (section 5, Roles and access).
- **Auth:** Sign in with Microsoft (365 accounts), via Supabase's Azure provider. This is the "sign in with Microsoft" login, not enterprise SSO: no SAML or directory provisioning. A one-off app registration in Entra provides a client id and secret, and login can be restricted to the client's own tenant so only their 365 accounts are accepted. Gives accurate per-user attribution.

**Secrets and handover.** The client provides all API keys. The developer builds the application shell and hands it back as a local codebase; the client deploys it to their own Vercel and Supabase and plugs in the keys. API keys and secrets must never be committed to the codebase or exposed client-side; they are held server-side (environment variables or Supabase secrets).

---

## 3. External services

| Service | Auth | Calls | Notes |
|---|---|---|---|
| Creditsafe (Connect) | JWT via `POST /authenticate` | `GET /companies` (search) then `GET /companies/{id}` (report) | Charged per report |
| Cognism | Bearer key (6-month TTL) | `POST /account/enrich` (free, presence flags only) → gate → `POST /account/redeem` (values) | Account redeem: assume worst case one credit per company until confirmed |
| Cognism contacts | Bearer key | `POST /contact/search` (free list) → `POST /contact/redeem` (email/phone) | One credit per redeemed contact |
| Firecrawl | key | Crawl the company site | Primary classification signal |
| Exa | key | Neural web search | Corroboration and breadth |

**Key behaviours to implement:**
- Cognism enrich and search return presence flags (`hasRevenue` etc.), not values. Only redeem returns values.
- Rate limit: Cognism 1,000 requests/min. Throttle and back off.
- All money normalised to USD on ingest, using an FX rate held in config.

---

## 4. Data model

Full field list is in the map's schema section. Tables: `companies`, `contacts`, `enrichment_data`, `scoring_breakdown`, `usage_runs`, `usage_items`. The account tables `account_qualitative`, `account_metrics`, `account_monitoring`, `talent_insights` belong to the optional Accounts module; the `companies` lifecycle fields are cheap to keep in the schema regardless. Config holds the ICP profiles and the account health model.

**Enums to define:**

- `companies.status`: queued, enriching, triage, scored, failed
- `companies.triage_reason`: entity_ambiguous, low_confidence_sector, icp_no_match
- `companies.lifecycle_status`: prospect, exported, client
- `companies.tier`: A, B, C
- `companies.match_flag`: match, weak, no_match
- `companies.icp`: the configured ICP set (initially four; extensible in config)
- `contacts.status`: listed, redeemed
- `contacts.email_source` / `contacts.phone_source`: cognism, syntax_match, apollo, prospeo
- `usage_runs.run_type`: enrichment, contact_pull
- `usage_items.action`: account_redeem, contact_redeem, creditsafe_report, firecrawl, exa, llm
- `users.role`: admin, standard

Owner fields for per-user scoping: `companies.imported_by`, `usage_runs.run_by` (already present), and a `created_by` on any user-specific record. Triage and the home page filter to the signed-in user by these.

Raw API responses are retained in `enrichment_data` so the model can be re-run without new API spend. Re-scoring reads stored data only.

---

## 5. Core behaviours and business rules

**Import**
- CSV columns: company name, domain. Domain mandatory. Manual single-company add also supported.
- An ICP is selected for the whole batch at import; a batch cannot run without one.
- On import, rows are written to `companies` with `status = queued`, `lifecycle_status = prospect`. Nothing enriches yet.
- Validate rows before run: flag missing or malformed domains for fix or removal.

**Validation gate (pre-redeem)**
- On Run, each queued company is checked with the free Cognism enrich call.
- Pass rule (provisional, configurable): industry present AND at least one of revenue or headcount present. Fail = skipped as `insufficient_data`, not redeemed.
- The review screen shows, in native units only: companies to process, how many are ready, how many skipped, Creditsafe reports to pull, and Cognism credits (worst case one per company). No pound figure for these, as the real cost depends on contract and bundles and cannot be shown accurately.

**Entity matching**
- The input must be matched to the correct company in each service before enrichment. Cognism returns a match score; Creditsafe search can return several candidates.
- Require a minimum match score. If it is not met, or more than one strong candidate exists, the company pauses into triage (`triage_reason = entity_ambiguous`) for the user to confirm or pick the right entity before its run continues. Never silently take the top hit.
- This is distinct from the ICP no-match flag: one asks which company this is, the other whether it fits the ICP.

**Enrichment**
- One throttled batch per Run, individual companies processed within it, with per-company status updating live.
- Source-of-truth waterfall: financials, ownership and risk from Creditsafe first; industry, headcount and geography from either (US-biased to Cognism); signals and people from Cognism only. Take the primary; fall back only if empty.
- Re-pull window (config, default 90 days): do not re-redeem a company enriched within the window.

**Classification**
- The validation gate runs before classification, so Firecrawl and Exa are not paid on companies about to be skipped.
- After enrichment, infer sector and sub-sector: Firecrawl crawls the company site (primary), Exa adds web context (corroboration), an LLM maps the result to the preset sector list against fixed rules and returns a confidence score.
- Scraped content is untrusted: it is passed to the LLM as data, never as instructions (section 6). The LLM returns structured JSON validated against a schema, with no tool use or free-form action, so a malicious page cannot hijack it.
- The LLM model version is pinned, since hosted models change and deprecate.
- Low-confidence or ambiguous results land in triage (`triage_reason = low_confidence_sector`) for approval. Store `sector`, `sub_sector`, `classification_confidence`.

**Scoring**
- Config-driven, never hard-coded. Per-ICP profiles: a shared base (categories, USD revenue and headcount bands, confidence rule) plus per-ICP weights and defining fit rules.
- Four scored categories: ICP fit, Scale & footprint, Hiring & growth, Financial viability. Plus Data confidence as an indicator, never weighted in.
- Weights per profile sum to 100 (enforce on save). Bands map a raw value to a 0–100 sub-score; sub-score × weight = contribution; sum = total (0–100).
- Missing data: a category with no data is excluded and the remaining weights renormalised, rather than scored as zero. Reflect the gap in the confidence figure.
- Tiering: total maps to tier by config thresholds (provisional A ≥ 82, B ≥ 68, else C).
- No-match flag: a company that contradicts its batch ICP's fit rules scores low and is flagged weak or no_match.
- Score history: `scoring_breakdown` rows are kept over time, not overwritten; `companies.score` holds the latest. This is what lets the insights spot a sector cooling or an account going quiet, and it cannot be reconstructed later.

**Triage**
- Scored companies land with `status = triage`, not on the list. Triage shows the proposed sector and any flags.
- Companies also land here mid-run when entity matching is ambiguous, for the user to pick the correct company before the run continues.
- Approve sets `status = scored` and surfaces the company on the target list. Reject or edit keeps it in triage.
- Triage is for companies only, an approval gate before the target list. Contacts do not pass through it; their quality is reviewed via the notification centre.

**Contacts**
- Contact search lists name, title and seniority for free (no redeem).
- User selects contacts, or select-all, and bulk enriches; only selected contacts are redeemed (email and phone revealed).
- Store `redeem_id` per contact; never re-charge an already-redeemed contact. Show Cognism's email quality grade beside each email, sortable and filterable.
- Missing email waterfall (n8n): syntax match from known company emails, then a fallback provider, writing back to the contact.
- Record the source of each detail per field (`email_source`, `phone_source`): cognism, syntax_match, apollo, prospeo. Shown in the contacts view, filterable, and carried to the usage log so metered spend is attributed correctly and an unreliable source is visible if bounces appear.
- Contacts are not part of company triage. They are pulled after a company is already approved and on the list, so quality is reviewed through the notification centre and a per-contact status, not the triage gate.

**Usage logging and cost**
- Every action is logged to `usage_items`, grouped under a `usage_runs` row. Counts come from the app's own calls, not a provider balance (no balance endpoint exists).
- Two kinds of service, shown separately:
  - Opaque cost: Cognism (credits) and Creditsafe (reports). Report these in native units only, no pound figure.
  - Transparent cost: Firecrawl, Exa and the LLM via OpenRouter. Their pricing is per call or per token, so compute and store the actual cost per action and show spend per service in pounds.
- So the usage view has two parts: credits and reports as counts, and metered API spend in pounds for the services that expose it.

**Roles and access**
- Two roles: `admin` and `standard`. One person to start, more later.
- Shared across all users: the target list and the accounts list.
- User-specific (scoped to the signed-in user): triage, the home insights page, and a user's own analytics and usage.
- Admin only: model config, and the overall and per-user analytics and usage.
- Enforce with Supabase row-level security tied to the signed-in user and role, not only in the front end. Personal records carry an owner (`imported_by` / `created_by`).

**Queueing and concurrency**
- The queue lives in the database, not in n8n and not in a separate service. Companies at `status = queued` are the queue. At these volumes (tens to low hundreds per batch, run occasionally) a Postgres-backed queue is sufficient and keeps the moving parts and attack surface smaller; Redis is not needed. A jobs row is claimed atomically (a `locked_by` / status claim) so two workers never take the same one. Supabase's `pgmq` with `pg-cron` is a fine option if a proper queue primitive is wanted without adding infrastructure.
- A controlled drain feeds companies to n8n in chunks, at a bounded concurrency and within provider rate limits, marking each done as it lands. A batch may span several n8n executions; progress must survive an execution ending or restarting (resumable, idempotent).
- This keeps the workload inside n8n Cloud base-tier limits (concurrent executions, execution time, monthly execution count). The chunk size and concurrency are tuned to the chosen plan's limits, which should be read off that plan.

**Notifications**
- Surface: failed enrichments, low data confidence, no-match flags, and contacts returned with mid or low email quality after a bulk pull.

**Errors, retries, idempotency**
- Retry with backoff on 429 and 5xx. A single company failure captures a reason and does not fail the batch.
- Re-running a batch must not double-charge: check the re-pull window and existing `enrichment_data` before redeeming.

---

## 6. Security and cost control

Treated as first-class, since a breach or a runaway loop is the most likely serious failure. Caps and ceilings live in config (admin) so they are tunable.

**Secrets and breach**
- API keys and secrets held server-side only, in environment variables or a secrets store. Never in the codebase, never in git history, never sent to the browser.
- All third-party calls made from the server or n8n, so no key is exposed client-side.
- A secret scanner in the pipeline and a clean git history at handover: a key committed once and later removed still lives in history.
- Row-level security on by default in Supabase: access enforced at the database, not just hidden in the UI. No data readable without an authenticated, authorised session.
- Login restricted to the client's Microsoft tenant, so only their accounts can reach the app at all.
- Standard hygiene: input validation, parameterised queries, HTTPS only, least-privilege database roles, dependency and vulnerability scanning.

**Runaway cost control**
The bigger day-to-day risk is an accidental loop running up API or LLM cost. Enforce all of these server-side:
- Batch size cap: a run cannot exceed a configured maximum number of companies; an oversized CSV is refused, not processed.
- Spend ceilings: a credit and cost ceiling per run and per day, checked before each paid call; the batch halts when a ceiling is hit rather than continuing.
- Idempotency: the re-pull window and stored enrichment are checked before any redeem, so retries or double-clicks cannot re-charge. Both a freshness and a cost control.
- Bounded retries: retries capped with backoff and a dead-letter state; a persistently failing company stops after N attempts, never loops on a paid endpoint.
- LLM guards: a fixed low-cost model for classification, a token ceiling per call, a single attempt (no agentic loop), and a monthly cost cap.
- The validation gate doubles as a cost gate, trimming data-thin companies before the paid redeem.
- Every paid call metered before and after; the usage log is also the tripwire that enforces the ceilings.

**Personal data**
- The contact data is Lignum's, collected under their existing Cognism and Creditsafe agreements and governed by their data policy. The obligation is theirs, not the developer's. The app's job is only not to undermine it: keep personal data out of plaintext logs, restrict who can see it via the access model, and support deleting a contact record on request.

**AI and scraped content**
- Content from Firecrawl and Exa is untrusted input. It is passed to the LLM as data, never as instructions. The classifier is constrained to schema-validated JSON output with no tool use, so a crafted page cannot hijack it (prompt injection).

**n8n**
- n8n is a second store of credentials, triggered by the app over a webhook. Secure the webhook so only the app can call it (shared secret or signed request), and hold n8n's stored credentials with the same care as the app's. Treat n8n as a monitored single point of failure.

**Other failure points**
- Provider outage or rate-limit: back off and resume, do not fail the batch; surface in notifications.
- Partial enrichment: a company with some sources but not others is scored on what it has, the gap reflected in confidence, not left half-processed.
- Duplicate imports: dedupe on domain so a company is not enriched twice.
- Stuck runs: a stalled run is detectable and resumable, not silently abandoned.

---

## 7. Screens and acceptance criteria

**Import & queue**
Purpose: add companies and start a run.
Accept: a CSV of company name and domain imports with invalid rows flagged; an ICP is required; on Run the gate skips sub-threshold rows and the estimate shows counts and credits; statuses update live to scored or failed.

**Triage** (scoped to the signed-in user)
Accept: a user sees the scored companies from their own runs here first; approving one moves it to the shared target list; the proposed sector and flags are visible and editable.

**Target list (per ICP)**
Accept: tabbed by ICP; each row shows the per-category score breakdown, total, tier, confidence and sector; sortable and filterable; an exported status is shown and filterable; old records archivable.

**Company detail**
Accept: shows the matched ICP with a one-line reason, the category breakdown, every stored field with its source, and the company's contacts.

**Contacts workspace**
Accept: grouped by company, groups sortable by score and tier; names and titles listed free; select or select-all then bulk enrich reveals email and phone; redeemed contacts are not re-charged; email quality shown.

**Model config** (admin only)
Accept: per-ICP weights (sum enforced to 100), bands, tier thresholds, re-pull window, FX rate, contact-pull rule, and the metered-service prices used for cost tracking; changes apply on next score/re-score with no new API spend.

**Usage & audit**
Accept: two parts, credits and reports as counts (Cognism, Creditsafe) and metered spend in pounds (Firecrawl, Exa, LLM); a log grouped by run, expandable to per-company line items; contact pulls as their own dated entries. A standard user sees their own; an admin sees everyone's and the split by user.

**Analytics**
Accept: activity on trend charts by period; a standard user sees only their own, an admin sees the overall view and the breakdown by user; figures attributed to real signed-in users.

**AI insights home** (scoped to the signed-in user)
Accept: a do-this-next summary of what needs the user's attention, their last run, and thin or weak ICPs and sectors, generated from stored data.

**Accounts (shell)**
Accept: lists companies at lifecycle_status = client with firmographic data and an adverse-events feed; qualitative 1–5 ratings entered manually with a refresh reminder; manual Talent Insights fields; an account health score in config; an empty, clearly-marked panel for CRM delivery metrics.

---

## 8. Non-functional

- Light and dark mode.
- British English UI copy.
- Batch throttled within provider rate limits.
- Secrets server-side only; role-based access tied to the signed-in user.
- Responsive; the target list and detail usable on a laptop.
- Observability: structured logging, an error tracker (e.g. Sentry), and an alert when a spend ceiling trips or a run fails. No silent failures in production.
- Testing: unit tests for the scoring engine against fixtures, since it is deterministic and config-driven; fixture or mock mode for the paid services so tests and development never spend live credits.

---

## 9. Provided, environments and handover

- Client provides: Creditsafe, Cognism, Firecrawl, Exa keys; the Supabase and Vercel accounts.
- Developer builds: the application shell, schema migrations, n8n workflows (or code orchestration), and all screens, handed back as a local codebase for the client to deploy. No client keys are shared with the developer; the build uses placeholder config the client swaps for live keys.

**Environments.** Separate development, staging and production, each with its own keys. The developer builds and tests against fixtures or a sandbox, so development never spends the client's live credits; live keys run only in the client's environment.

**Handover.** A short runbook covering how to deploy, rotate a key, and add an ICP or a sector. A warranty or bug-fix window after launch, length to be agreed with the developer.

---

## 10. Suggested build order

A sensible sequence, provisional, about the order of work not payment. How it is staged and paid is for the developer and client to agree.

**Build a thin slice first.** One ICP flowing end to end, both data sources, score, and a target list, deployed and working, before widening. If the integrations and the credit model hold on a small slice, the rest is low risk. If they do not, you find out cheaply.

**1 — Foundation**
Repo scaffold, Supabase schema and enums, Sign in with Microsoft, config layer, empty app deployed.
Complete when: schema migrated, login works, config editable, app deploys.

**2 — Enrichment pipeline**
n8n orchestration, Creditsafe and Cognism enrich → gate → redeem, USD normalisation, raw JSON storage, validation gate, batch run with live status, retries and rate-limit handling.
Complete when: a queued batch enriches and stores; the gate skips thin data; statuses update; no double-charge on re-run.

**3 — Scoring and config**
Per-ICP profiles, shared base plus weights and fit rules, bands, tiering, confidence, no-match flag, re-score from stored data.
Complete when: companies score against the chosen ICP; changing config re-scores with no new API calls; weights enforce to 100.

**4 — Classification and triage**
Firecrawl and Exa plus LLM classification with confidence, triage holding area with approve, reject and edit.
Complete when: a run proposes sector and sub-sector; low-confidence lands in triage; approval moves a company to the list.

**5 — Prospect UI**
Import screen, target list per ICP with the score breakdown, company detail.
Complete when: the three screens meet their acceptance criteria.

**6 — Contacts**
Free contact listing, select and bulk redeem, redeem_id reuse, email quality, missing-email waterfall, the contacts workspace.
Complete when: contacts list free; selected redeem reveals details; no re-charge; grouped, sortable workspace.

**7 — Usage, analytics and notifications**
Usage log and summary, analytics trends, notification centre.
Complete when: spend logged and grouped; trends per user and period; notifications fire on the defined events.

**8 — Accounts module (optional)**
Only if Accounts is in the first round; otherwise deferred to a later evolution (section 11). Accounts view, monitoring feed, qualitative ratings, manual Talent Insights, health model, empty CRM-metrics panel.
Complete when: clients listed with monitoring and qualitative scoring; health score computed; efficiency panel present but unwired.

---

## 11. Optional modules, later evolutions and open dependencies

**Optional now, or a later evolution (your choice):**
- The Accounts module: lifecycle monitoring, client-scored qualitative ratings, manual Talent Insights and the health model. The `companies` lifecycle fields and the account tables are cheap to include in the schema now even if the module itself is deferred, to avoid re-engineering.

**Later evolutions (out of this build):**
- Live Loxo delivery metrics wired into the Accounts efficiency panel.
- Intent-signal and news monitoring (Trigify, industry news, and similar).
- Auto-ICP assignment.
- Automated routing into Loxo campaigns.
- Full market mapping, with the company search handled in-platform via Cognism.
- Email verification layer.
- The Cognism CSV import branch (build manual and API import; the CSV-skips-account path is deferred pending confirmation of export contents).

**To be defined:**
- CRM export: the target-list export structured to match Loxo's fields and mapping. Defined alongside the Loxo review, so an exported record drops into the CRM without remapping.

**Open dependencies, to confirm and not assumed:**
- Whether a Cognism account redeem draws a credit. Worst case assumed in estimates.
- Whether a Cognism CSV export carries the event arrays.
- The Loxo fields needed for the efficiency pillar: candidate workflow stage, placement fee and date, and a company link. Confirmed on a live key before that pillar is costed.
