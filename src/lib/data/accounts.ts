import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mirrors the real `active_accounts` + `active_accounts_jobs` tables and
// their currency/fee-type lookups. Separate dataset from `companies` — no
// foreign key between them, keyed by Loxo's numeric `company_id`.

export interface AccountListItem {
  companyId: number;
  companyName: string;
  status: string;
  ownedBy: string | null;
  totalRevenue: number | null;
  revenueCurrencyCode: string | null;
  updatedAt: string;
}

export interface AccountHeader {
  companyId: number;
  companyName: string;
  companyUrl: string | null;
  status: string;
  ownedBy: string | null;
  totalRevenue: number | null;
  revenueCurrencyCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountJob {
  jobId: number;
  jobTitle: string;
  createdAt: string;
  publishedAt: string | null;
  salary: string | null;
  salaryCurrencyCode: string | null;
  jobType: string | null;
  jobCategory: string | null;
  fee: number | null;
  feeTypeKey: string | null;
  feeCurrencyCode: string | null;
}

interface AccountListRow {
  company_id: number;
  company_name: string;
  status: string;
  owned_by: string | null;
  total_revenue: number | null;
  updated_at: string;
  revenue_currency: { code: string; symbol: string } | null;
}

export async function getAccountsList(): Promise<AccountListItem[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select("company_id, company_name, status, owned_by, total_revenue, updated_at, revenue_currency:currencies!revenue_currency_id(code, symbol)")
    .order("company_name");

  if (error) throw new Error(`Failed to load active_accounts: ${error.message}`);

  return ((data ?? []) as unknown as AccountListRow[]).map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    status: r.status,
    ownedBy: r.owned_by,
    totalRevenue: r.total_revenue,
    revenueCurrencyCode: r.revenue_currency?.code ?? null,
    updatedAt: r.updated_at,
  }));
}

interface AccountHeaderRow {
  company_id: number;
  company_name: string;
  company_url: string | null;
  status: string;
  owned_by: string | null;
  total_revenue: number | null;
  revenue_currency_id: number | null;
  created_at: string;
  updated_at: string;
  revenue_currency: { code: string; symbol: string } | null;
}

export async function getAccountHeader(companyId: number): Promise<AccountHeader | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts")
    .select(
      "company_id, company_name, company_url, status, owned_by, total_revenue, revenue_currency_id, created_at, updated_at, revenue_currency:currencies!revenue_currency_id(code, symbol)",
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load account header: ${error.message}`);
  if (!data) return null;

  const r = data as unknown as AccountHeaderRow;
  return {
    companyId: r.company_id,
    companyName: r.company_name,
    companyUrl: r.company_url,
    status: r.status,
    ownedBy: r.owned_by,
    totalRevenue: r.total_revenue,
    revenueCurrencyCode: r.revenue_currency?.code ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface AccountJobRow {
  job_id: number;
  job_title: string;
  created_at: string;
  published_at: string | null;
  salary: string | null;
  salary_currency_id: number | null;
  job_type: string | null;
  job_category: string | null;
  fee: number | null;
  fee_type_id: number | null;
  fee_currency_id: number | null;
  salary_currency: { code: string; symbol: string } | null;
  fee_currency: { code: string; symbol: string } | null;
  fee_type: { fee_type_key: string } | null;
}

export async function getAccountJobs(companyId: number): Promise<AccountJob[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_accounts_jobs")
    .select(
      "job_id, job_title, created_at, published_at, salary, salary_currency_id, job_type, job_category, fee, fee_type_id, fee_currency_id, salary_currency:currencies!salary_currency_id(code, symbol), fee_currency:currencies!fee_currency_id(code, symbol), fee_type:fee_type(fee_type_key)",
    )
    .eq("company_id", companyId)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Failed to load active_accounts_jobs: ${error.message}`);

  return ((data ?? []) as unknown as AccountJobRow[]).map((r) => ({
    jobId: r.job_id,
    jobTitle: r.job_title,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    salary: r.salary,
    salaryCurrencyCode: r.salary_currency?.code ?? null,
    jobType: r.job_type,
    jobCategory: r.job_category,
    fee: r.fee,
    feeTypeKey: r.fee_type?.fee_type_key ?? null,
    feeCurrencyCode: r.fee_currency?.code ?? null,
  }));
}
