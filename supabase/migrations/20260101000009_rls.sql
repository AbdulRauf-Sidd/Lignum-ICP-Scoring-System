-- Row-level security for the app-facing (anon key + user JWT) path.
-- n8n and other backend automation use the service role key, which
-- bypasses RLS entirely, so these policies only govern what a signed-in
-- user sees and does through the Next.js app itself.
--
-- Shared: target list (companies with status = 'scored') and the accounts
-- list (lifecycle_status = 'client'). User-scoped: everything still mid-run
-- (queued/enriching/triage/failed), gated by imported_by. Admin-only:
-- config. Everything is denied to anon by simply granting no policy to it.

alter table public.users enable row level security;
alter table public.icp_profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.enrichment_data enable row level security;
alter table public.scoring_breakdown enable row level security;
alter table public.usage_runs enable row level security;
alter table public.usage_items enable row level security;
alter table public.account_qualitative enable row level security;
alter table public.account_metrics enable row level security;
alter table public.account_monitoring enable row level security;
alter table public.talent_insights enable row level security;

-- users: everyone can see their own row; admins can see and manage everyone.
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy users_update_admin on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- icp_profiles: every signed-in user needs to read these to pick an ICP at
-- import or view the target list tabs; only admins edit them.
create policy icp_profiles_select_authenticated on public.icp_profiles
  for select to authenticated
  using (true);

create policy icp_profiles_write_admin on public.icp_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- app_config: admin only, per "Model config (admin only)".
create policy app_config_select_admin on public.app_config
  for select to authenticated
  using (public.is_admin());

create policy app_config_write_admin on public.app_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- companies: shared once approved (status = scored) or converted to a
-- client; otherwise scoped to the importing user. Writes scoped to the
-- importer or an admin.
create policy companies_select_shared_or_owner on public.companies
  for select to authenticated
  using (
    status = 'scored'
    or lifecycle_status in ('exported', 'client')
    or imported_by = auth.uid()
    or public.is_admin()
  );

create policy companies_insert_owner on public.companies
  for insert to authenticated
  with check (imported_by = auth.uid() or public.is_admin());

create policy companies_update_owner_or_admin on public.companies
  for update to authenticated
  using (imported_by = auth.uid() or public.is_admin())
  with check (imported_by = auth.uid() or public.is_admin());

create policy companies_delete_admin on public.companies
  for delete to authenticated
  using (public.is_admin());

-- contacts: visible/writable whenever the parent company is (contacts are
-- only pulled once a company is already approved and on the shared list).
create policy contacts_select_via_company on public.contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = contacts.company_id
        and (
          c.status = 'scored'
          or c.lifecycle_status in ('exported', 'client')
          or c.imported_by = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy contacts_write_via_company on public.contacts
  for all to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = contacts.company_id
        and (c.imported_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.companies c
      where c.id = contacts.company_id
        and (c.imported_by = auth.uid() or public.is_admin())
    )
  );

-- enrichment_data and scoring_breakdown: same visibility as their company
-- (raw data / score history behind the company detail view).
create policy enrichment_data_select_via_company on public.enrichment_data
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = enrichment_data.company_id
        and (
          c.status = 'scored'
          or c.lifecycle_status in ('exported', 'client')
          or c.imported_by = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy scoring_breakdown_select_via_company on public.scoring_breakdown
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = scoring_breakdown.company_id
        and (
          c.status = 'scored'
          or c.lifecycle_status in ('exported', 'client')
          or c.imported_by = auth.uid()
          or public.is_admin()
        )
    )
  );

-- usage_runs / usage_items: a standard user sees their own; an admin sees
-- everyone's.
create policy usage_runs_select_owner_or_admin on public.usage_runs
  for select to authenticated
  using (run_by = auth.uid() or public.is_admin());

create policy usage_runs_insert_owner on public.usage_runs
  for insert to authenticated
  with check (run_by = auth.uid() or public.is_admin());

create policy usage_items_select_via_run on public.usage_items
  for select to authenticated
  using (
    exists (
      select 1 from public.usage_runs r
      where r.id = usage_items.run_id
        and (r.run_by = auth.uid() or public.is_admin())
    )
  );

-- Account tables: the accounts list is shared like the target list, so any
-- signed-in user can read and contribute ratings/insights; who entered a
-- given row is captured by rated_by/entered_by for attribution.
create policy account_qualitative_select_all on public.account_qualitative
  for select to authenticated using (true);
create policy account_qualitative_write_all on public.account_qualitative
  for all to authenticated using (true) with check (true);

create policy account_metrics_select_all on public.account_metrics
  for select to authenticated using (true);
create policy account_metrics_write_all on public.account_metrics
  for all to authenticated using (true) with check (true);

create policy account_monitoring_select_all on public.account_monitoring
  for select to authenticated using (true);
create policy account_monitoring_write_all on public.account_monitoring
  for all to authenticated using (true) with check (true);

create policy talent_insights_select_all on public.talent_insights
  for select to authenticated using (true);
create policy talent_insights_write_all on public.talent_insights
  for all to authenticated using (true) with check (true);
