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
