import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET_HEADER = "X-Lignum-Webhook-Secret";

interface ImportRow {
  name: string;
  domain: string;
}

interface ImportPayload {
  icp_name: string;
  rows: ImportRow[];
}

function isImportPayload(value: unknown): value is ImportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.icp_name !== "string" || !v.icp_name.trim()) return false;
  if (!Array.isArray(v.rows) || v.rows.length === 0) return false;
  return v.rows.every(
    (r) => r && typeof r === "object" && typeof (r as ImportRow).domain === "string",
  );
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.N8N_IMPORT_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    return NextResponse.json(
      { error: "Import webhook is not configured. Set N8N_IMPORT_WEBHOOK_URL and N8N_WEBHOOK_SECRET." },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!isImportPayload(payload)) {
    return NextResponse.json(
      { error: "Expected { icp_name, rows: [{ name, domain }] } with an ICP chosen and at least one row." },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        [WEBHOOK_SECRET_HEADER]: webhookSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    return NextResponse.json(
      { error: `Could not reach the n8n webhook: ${message}` },
      { status: 502 },
    );
  }

  const rawText = await upstream.text();
  let body: unknown = rawText;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    // n8n didn't return JSON — keep the raw text so it still surfaces in the UI.
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error:
          upstream.status === 404
            ? "n8n isn't listening for this test webhook. Open the workflow in n8n and click \"Execute workflow\" / \"Listen for test event\", then try again."
            : "The n8n webhook rejected this batch.",
        status: upstream.status,
        details: body,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, result: body });
}
