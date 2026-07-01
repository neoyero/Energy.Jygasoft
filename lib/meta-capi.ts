import { createHash } from "node:crypto";
import { getIntegracion } from "@/lib/config/service";

/**
 * Meta Conversions API (server-side). Se deduplica con el Pixel del cliente
 * usando el MISMO `event_id` (= request_id del lead). PII hasheada con SHA-256.
 */

const GRAPH_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  // Solo dígitos; Meta recomienda incluir código de país (MX = 52).
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Construye el bloque user_data con PII hasheada (exportado para tests). */
export function buildUserData(args: {
  email?: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string | null;
}): Record<string, string | string[]> {
  const userData: Record<string, string | string[]> = {};
  if (args.email) userData.em = [sha256(normalizeEmail(args.email))];
  if (args.phone) userData.ph = [sha256(normalizePhone(args.phone))];
  if (args.clientIp) userData.client_ip_address = args.clientIp;
  if (args.userAgent) userData.client_user_agent = args.userAgent;
  return userData;
}

export interface CapiEventArgs {
  eventName: "Lead" | "CompleteRegistration" | "Contact";
  eventId: string;
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string | null;
  value?: number;
  currency?: string;
}

export interface CapiResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
}

export async function sendCapiEvent(args: CapiEventArgs): Promise<CapiResult> {
  const meta = await getIntegracion("meta");
  const pixelId = meta.ajuste("pixel_id");
  const token = meta.secreto("capi_token");
  const testEventCode = meta.ajuste("test_event_code");
  if (!pixelId || !token) return { ok: false, skipped: true };

  const userData = buildUserData(args);

  const event = {
    event_name: args.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: args.eventId, // ← clave de deduplicación con el Pixel
    action_source: "website",
    event_source_url: args.eventSourceUrl,
    user_data: userData,
    custom_data:
      args.value !== undefined
        ? { value: args.value, currency: args.currency ?? "MXN" }
        : undefined,
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  const body: Record<string, unknown> = { data: [event] };
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}
