"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function approveCompany(companyId: string, sector: string, subSector: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("companies")
    .update({ status: "scored", sector, sub_sector: subSector, triage_reason: null })
    .eq("id", companyId);

  if (error) throw new Error(`Failed to approve company: ${error.message}`);

  revalidatePath("/triage");
  revalidatePath("/target-list");
}

export async function rejectCompany(companyId: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("companies")
    .update({ status: "failed", triage_reason: "rejected" })
    .eq("id", companyId);

  if (error) throw new Error(`Failed to reject company: ${error.message}`);

  revalidatePath("/triage");
}

// Sector and ICP profile both feed the Scoring Engine (sector drives icp_fit;
// the ICP profile supplies every weight, band and fit rule) — sub-sector is
// informational only, never scored. So an edit that changes either one needs
// a real rescore, not just a label update, before it's safe to treat the
// company as approved.
export async function rescoreAndApproveCompany(
  companyId: string,
  correction: { sector: string; subSector: string; icpName: string },
) {
  const webhookUrl = process.env.N8N_RESCORE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Rescore webhook is not configured. Set N8N_RESCORE_WEBHOOK_URL and N8N_WEBHOOK_SECRET.");
  }

  const payload = {
    company_id: companyId,
    sector: correction.sector,
    sub_sector: correction.subSector,
    icp_name: correction.icpName,
  };

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "X-Lignum-Webhook-Secret": webhookSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Could not reach the rescore webhook: ${message}`);
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const hint =
      status === 404
        ? " (n8n isn't listening for this test webhook — open the workflow and click Execute workflow / Listen for test event.)"
        : "";
    throw new Error(`The rescore webhook rejected the request (${status}).${hint}`);
  }

  // Same as entity resolution: the company re-enters the pipeline and lands
  // back with status = scored once n8n finishes recalculating, not instantly.
  revalidatePath("/triage");
  revalidatePath("/target-list");
}

export async function confirmEntityResolution(
  companyId: string,
  candidate: { creditsafeCompanyId: string | null; cognismCompanyId: string | null },
) {
  const webhookUrl = process.env.N8N_RESOLVE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Resolve webhook is not configured. Set N8N_RESOLVE_WEBHOOK_URL and N8N_WEBHOOK_SECRET.");
  }

  const payload = {
    company_id: companyId,
    ...(candidate.creditsafeCompanyId ? { creditsafe_company_id: candidate.creditsafeCompanyId } : {}),
    ...(candidate.cognismCompanyId ? { cognism_company_id: candidate.cognismCompanyId } : {}),
  };

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "X-Lignum-Webhook-Secret": webhookSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Could not reach the resolve webhook: ${message}`);
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const hint =
      status === 404
        ? " (n8n isn't listening for this test webhook — open the workflow and click Execute workflow / Listen for test event.)"
        : "";
    throw new Error(`The resolve webhook rejected the request (${status}).${hint}`);
  }

  // The company re-enters the pipeline and lands back in status=triage once
  // reprocessing finishes (possibly with a different triage_reason, or none
  // if it now needs approval as scored) — revalidate so the list picks that
  // up whenever it happens, even though it won't be instant.
  revalidatePath("/triage");
}
