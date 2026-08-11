# ICP Scoring & Accounts System

Finds, scores and prioritises prospect companies against a chosen ideal customer profile, then
keeps them as accounts once they convert. See the paired docs in the repo root for the full
design: `Lignum_ICP_Scoring_System_Build_Plan.md` (build detail, rules, acceptance criteria) and
`Lignum_ICP_Scoring_System_Map.html` (architecture, schema, data flow).

**Status:** Foundation phase — schema, auth and config layer are in place. Week 1's data-pulling
piece (Creditsafe + Cognism import/enrich, no UI) is a standalone n8n workflow — see
[`n8n/README.md`](./n8n/README.md). Classification, scoring and the working screens are built in
the phases that follow (see the build plan, section 10).

## Stack

- **Front end:** Next.js 16 (App Router), Tailwind CSS v4, deployed to Vercel.
- **Database:** Supabase (Postgres), with row-level security.
- **Auth:** Sign in with Microsoft (365), via Supabase's Azure OAuth provider, tenant-restricted.
- **Orchestration (later phases):** n8n runs the enrichment, classification and scoring pipeline.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. Server-side only; this is what n8n uses later to
     write enrichment/scoring results, bypassing RLS. Never expose it to the browser.

3. **Run the migrations** in `supabase/migrations/` against your project, in filename order —
   either with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push`) or by
   pasting each file into the Supabase Dashboard's SQL Editor in order. They create every enum,
   table, RLS policy, and seed the default config (four placeholder ICP profiles, shared settings,
   and the client's sector/sub-sector taxonomy).

4. **Set up Microsoft sign-in:**
   - Register an app in [Entra ID](https://entra.microsoft.com) (Azure AD) for this project.
     Redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`.
   - Under **Authentication → Providers → Azure** in the Supabase Dashboard, enable the provider
     and enter the Client ID and Client Secret from the app registration.
   - To restrict sign-in to only this client's tenant (not any Microsoft account), set the
     provider's **Azure Tenant URL** to `https://login.microsoftonline.com/<tenant-id>` in the
     Supabase Dashboard. This is the primary restriction.
   - Set `AZURE_TENANT_ID` in `.env.local` — the app checks the `tid` claim on every sign-in as a
     defense-in-depth backstop (`src/app/auth/callback/route.ts`), independent of the Supabase
     provider setting.

5. **Run the app**

   ```bash
   npm run dev
   ```

   The first person to sign in becomes `admin`; everyone after starts as `standard` (see the
   `handle_new_user` trigger in `supabase/migrations/20260101000002_users.sql`). Promote further
   admins from an admin account, or directly in the `users` table.

## Deploying

Deploy to Vercel as normal (`vercel` or connect the repo). Set the same environment variables from
`.env.example` in the Vercel project settings, using your **production** Supabase project (keep
development and production on separate Supabase projects with separate keys, so local development
never touches live data or spends live API credits once the paid integrations land).

## Repo layout

```
src/app/(app)/        Authenticated screens (nav + role-based shell)
src/app/login/         Sign-in page
src/app/auth/          OAuth callback, sign-in error page
src/lib/supabase/      Server/browser Supabase clients, session refresh
src/lib/auth/          DAL (getCurrentUser/requireAdmin), sign-in/out actions
supabase/migrations/   SQL migrations — schema, RLS, seed config
```

## Rotating a key

Update the value in the relevant `.env` (locally) or the Vercel project's environment variables
(production), then redeploy. No key is ever read client-side, so rotation never requires a code
change — only the Azure app registration's client secret also needs updating in the Supabase
Dashboard's Azure provider settings if it's the one rotated.

## Adding an ICP or a sector

- **ICP:** insert a row into `icp_profiles` (weights must sum to 100 — enforced by a DB trigger)
  via the admin **Model config** screen, or directly in Supabase. No code change or redeploy
  needed; `companies.icp` and `scoring_breakdown.icp_profile` reference `icp_profiles.slug`, not a
  fixed enum, precisely so this stays a config change.
- **Sector/sub-sector:** edit the `sector_taxonomy` entry in `app_config` from the same screen.
