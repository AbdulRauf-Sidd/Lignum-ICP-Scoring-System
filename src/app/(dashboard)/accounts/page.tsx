import { PageHeader } from "@/components/shared/page-header";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import {
  getAccountsList,
  getAccountHeader,
  getAccountJobs,
  getAccountQualitative,
  getTalentInsights,
  getHealthWeights,
  getAccountFirmographics,
  DEFAULT_HEALTH_WEIGHTS,
} from "@/lib/data/accounts";
import { DATE_PRESET_LABELS, datePresetRange, type DatePreset } from "@/lib/date-presets";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Synced from Loxo on its own schedule, and status/owner are edited live —
// never freeze this page.
export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await requireAdmin();
  const params = await searchParams;
  const companyParam = Array.isArray(params.company) ? params.company[0] : params.company;
  const searchParam = Array.isArray(params.q) ? params.q[0] : params.q;

  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rangeParam = first(params.range);
  const preset: DatePreset = DATE_PRESET_LABELS.some(([value]) => value === rangeParam)
    ? (rangeParam as DatePreset)
    : "all_time";
  const customStart = first(params.from) ?? "";
  const customEnd = first(params.to) ?? "";

  const accounts = await getAccountsList(searchParam, datePresetRange(preset, customStart, customEnd));
  const selectedCompanyId = companyParam ? Number(companyParam) : null;

  const [header, jobs, qualitative, talentInsights, healthWeights] = selectedCompanyId
    ? await Promise.all([
        getAccountHeader(selectedCompanyId),
        getAccountJobs(selectedCompanyId),
        getAccountQualitative(selectedCompanyId),
        getTalentInsights(selectedCompanyId),
        getHealthWeights(),
      ])
    : [
        null,
        [],
        { relationship_strength: null, delivery_satisfaction: null, growth_potential: null, payment_reliability: null, strategic_fit: null },
        { headcountChange: null, attrition: null, avgTenure: null },
        DEFAULT_HEALTH_WEIGHTS,
      ];

  // Depends on header.companyUrl, so it can't join the Promise.all above —
  // only runs once we know whether there's a domain to match against.
  const firmographics = selectedCompanyId ? await getAccountFirmographics(header?.companyUrl ?? null) : null;

  return (
    <div>
      <PageHeader title="Accounts" description="Company records synced from Loxo - jobs, candidates and placements." />
      <AccountsWorkspace
        accounts={accounts}
        initialSearch={searchParam ?? ""}
        initialDate={{ preset, customStart, customEnd }}
        selectedCompanyId={selectedCompanyId}
        header={header}
        jobs={jobs}
        qualitative={qualitative}
        talentInsights={talentInsights}
        healthWeights={healthWeights}
        firmographics={firmographics}
      />
    </div>
  );
}
