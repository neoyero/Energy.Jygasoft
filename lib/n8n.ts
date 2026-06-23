import { sign } from "@/lib/hmac";
import { serverEnv } from "@/lib/env";
import { db, schema } from "@/db";

/**
 * Dispatch saliente del sitio hacia n8n (contrato §4), firmado con HMAC.
 * Registra en webhook_log. Nunca lanza: el lead ya quedó persistido aunque
 * n8n esté caído (reintento posterior desde form_submissions).
 */

export interface N8nLeadEnvelope {
  schema_version: 1;
  evento: "lead.created";
  request_id: string;
  lead: Record<string, unknown>;
  origen: Record<string, unknown>;
  sizing?: Record<string, unknown>;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  skipped?: boolean;
}

async function logWebhook(args: {
  evento: string;
  payload: unknown;
  statusCode: number | null;
  ok: boolean;
  requestId: string;
  error?: string;
}): Promise<void> {
  try {
    await db.insert(schema.webhookLog).values({
      direccion: "saliente",
      evento: args.evento,
      payload: (args.payload ?? {}) as Record<string, unknown>,
      statusCode: args.statusCode ?? undefined,
      ok: args.ok,
      requestId: args.requestId,
      error: args.error,
    });
  } catch {
    // El log es best-effort; no debe tumbar el request.
  }
}

export async function dispatchLeadToN8n(
  envelope: N8nLeadEnvelope,
): Promise<DispatchResult> {
  const url = serverEnv.N8N_WEBHOOK_URL;
  const secret = serverEnv.N8N_HMAC_SECRET;

  if (!url || !secret) {
    await logWebhook({
      evento: envelope.evento,
      payload: envelope,
      statusCode: null,
      ok: false,
      requestId: envelope.request_id,
      error: "n8n_not_configured",
    });
    return { ok: false, status: 0, skipped: true };
  }

  const body = JSON.stringify(envelope);
  const ts = String(Date.now());
  const signature = sign(body, ts, secret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Jygasoft-Signature": signature,
        "X-Jygasoft-Timestamp": ts,
        "X-Jygasoft-Request-Id": envelope.request_id,
        "X-Jygasoft-Kid": serverEnv.N8N_HMAC_KID,
      },
      body,
      // No esperar indefinidamente si n8n no responde.
      signal: AbortSignal.timeout(8000),
    });
    await logWebhook({
      evento: envelope.evento,
      payload: envelope,
      statusCode: res.status,
      ok: res.ok,
      requestId: envelope.request_id,
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    await logWebhook({
      evento: envelope.evento,
      payload: envelope,
      statusCode: null,
      ok: false,
      requestId: envelope.request_id,
      error: error instanceof Error ? error.message : "dispatch_failed",
    });
    return { ok: false, status: 0 };
  }
}
