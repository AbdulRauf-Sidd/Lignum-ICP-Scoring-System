"use server";

import { revalidatePath } from "next/cache";

export async function findContacts(companyId: string, domain: string) {
  const webhookUrl = process.env.N8N_CONTACT_SEARCH_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Contact search webhook is not configured. Set N8N_CONTACT_SEARCH_WEBHOOK_URL.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "X-Lignum-Webhook-Secret": webhookSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ company_id: companyId, domain }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Could not reach the contact search webhook: ${message}`);
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const hint =
      status === 404
        ? " (n8n isn't listening for this test webhook — open the workflow and click Execute workflow / Listen for test event.)"
        : "";
    throw new Error(`The contact search webhook rejected the request (${status}).${hint}`);
  }

  revalidatePath("/contacts");
  revalidatePath("/target-list/[id]", "page");
}

export interface RedeemItem {
  contactId: string;
  redeemId: string;
  companyId: string;
}

export async function bulkRedeemContacts(items: RedeemItem[]) {
  if (items.length === 0) return;
  if (items.length > 20) {
    throw new Error("Cognism redeems at most 20 contacts per call — select 20 or fewer.");
  }

  const webhookUrl = process.env.N8N_CONTACT_REDEEM_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Contact redeem webhook is not configured. Set N8N_CONTACT_REDEEM_WEBHOOK_URL.");
  }

  const payload = {
    redeems: items.map((i) => ({ contact_id: i.contactId, redeem_id: i.redeemId, company_id: i.companyId })),
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
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Could not reach the contact redeem webhook: ${message}`);
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const hint =
      status === 404
        ? " (n8n isn't listening for this test webhook — open the workflow and click Execute workflow / Listen for test event.)"
        : "";
    throw new Error(`The contact redeem webhook rejected the request (${status}).${hint}`);
  }

  revalidatePath("/contacts");
}
