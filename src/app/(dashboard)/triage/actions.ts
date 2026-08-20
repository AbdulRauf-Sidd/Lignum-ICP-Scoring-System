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

export async function confirmEntityResolution(
  companyId: string,
  candidate: { id: string; source: "creditsafe" | "cognism" },
) {
  const webhookUrl = process.env.N8N_RESOLVE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Resolve webhook is not configured. Set N8N_RESOLVE_WEBHOOK_URL and N8N_WEBHOOK_SECRET.");
  }

  const payload = {
    company_id: companyId,
    ...(candidate.source === "cognism"
      ? { cognism_company_id: candidate.id }
      : { creditsafe_company_id: candidate.id }),
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
