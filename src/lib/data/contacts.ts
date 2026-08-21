import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ContactStatus = "listed" | "in_process" | "redeemed" | "failed";
export type DetailSource = "cognism" | "syntax_match" | "apollo" | "prospeo";
export type EmailQuality = "high" | "medium" | "low" | null;

// Mirrors the real `contacts` table.
export interface ContactRow {
  id: string;
  company_id: string;
  name: string;
  title: string | null;
  seniority: string | null;
  status: ContactStatus;
  email: string | null;
  email_source: DetailSource | null;
  email_quality: EmailQuality;
  phone: string | null;
  phone_source: DetailSource | null;
  cognism_contact_id: string | null;
  cognism_redeem_id: string | null;
}

export async function getContactsForCompanies(companyIds: string[]): Promise<ContactRow[]> {
  if (companyIds.length === 0) return [];
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("contacts").select("*").in("company_id", companyIds);
  if (error) throw new Error(`Failed to load contacts: ${error.message}`);
  return (data ?? []) as ContactRow[];
}

export interface EmailQualityGroup {
  companyId: string;
  companyName: string;
  count: number;
}

export interface EmailQualityResult {
  groups: EmailQualityGroup[];
  totalCount: number;
}

// Contacts revealed (redeemed) with a mid or low quality grade — worth
// flagging since the email address may bounce or not exist.
export async function getMidLowEmailQualityContacts(sampleSize = 30): Promise<EmailQualityResult> {
  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("contacts")
    .select("id, company_id, email_quality", { count: "exact" })
    .eq("status", "redeemed")
    .in("email_quality", ["low", "medium"])
    .limit(sampleSize);

  if (error) throw new Error(`Failed to load email quality contacts: ${error.message}`);
  const rows = (data ?? []) as { id: string; company_id: string; email_quality: EmailQuality }[];
  if (rows.length === 0) return { groups: [], totalCount: count ?? 0 };

  const companyIds = Array.from(new Set(rows.map((r) => r.company_id)));
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", companyIds);
  if (companiesError) throw new Error(`Failed to load companies: ${companiesError.message}`);
  const nameById = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));

  const countByCompany = new Map<string, number>();
  for (const r of rows) countByCompany.set(r.company_id, (countByCompany.get(r.company_id) ?? 0) + 1);

  const groups = Array.from(countByCompany.entries()).map(([companyId, groupCount]) => ({
    companyId,
    companyName: nameById.get(companyId) ?? "Unknown company",
    count: groupCount,
  }));

  return { groups, totalCount: count ?? 0 };
}
