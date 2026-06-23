import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { leadInputSchema } from "@/lib/validators/lead";
import { verifyTurnstile } from "@/lib/turnstile";
import { createRateLimiter } from "@/lib/rate-limit";
import { persistLead } from "@/lib/lead-service";
import { dispatchLeadToN8n, type N8nLeadEnvelope } from "@/lib/n8n";
import { sendCapiEvent } from "@/lib/meta-capi";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Limiter en memoria a nivel de módulo (persiste entre invocaciones).
const limiter = createRateLimiter({
  max: serverEnv.RATE_LIMIT_MAX,
  windowMs: serverEnv.RATE_LIMIT_WINDOW_MS,
  maxEntries: 5000,
});

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const rl = limiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Honeypot: si viene relleno, simulamos éxito sin procesar (no alertar al bot).
  if (input.company_website) {
    return NextResponse.json({ ok: true, requestId: randomUUID() });
  }

  const turnstile = await verifyTurnstile(input.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { ok: false, error: "turnstile", reason: turnstile.reason },
      { status: 400 },
    );
  }

  const requestId = randomUUID();

  let result;
  try {
    result = await persistLead({
      input,
      requestId,
      form: input.origen.form,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
  } catch (error) {
    console.error("persistLead error", error);
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  if (result.duplicate) {
    return NextResponse.json({ ok: true, leadId: result.leadId, duplicate: true });
  }

  // Dispatch firmado a n8n (no fatal si falla; el lead ya está persistido).
  const envelope: N8nLeadEnvelope = {
    schema_version: 1,
    evento: "lead.created",
    request_id: requestId,
    lead: {
      id: result.leadId,
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      segmento: input.segmento,
      uso: input.uso,
      cp: input.cp,
      municipio: input.municipio,
      consumo_kwh_mes: input.consumo_kwh_mes,
      recibo_mxn: input.recibo_mxn,
      es_titular: input.es_titular,
      es_propietario: input.es_propietario,
      consentimiento_datos: input.consentimiento_datos,
      consentimiento_marketing: input.consentimiento_marketing,
      score: result.score,
      caliente: result.caliente,
    },
    origen: {
      form: input.origen.form,
      landing_url: input.origen.landing_url,
      referrer: input.origen.referrer,
      utm: input.origen.utm,
    },
  };

  await dispatchLeadToN8n(envelope);

  // Meta CAPI con event_id = requestId (se deduplica con el Pixel del cliente).
  await sendCapiEvent({
    eventName: "Lead",
    eventId: requestId,
    eventSourceUrl: input.origen.landing_url,
    email: input.email,
    phone: input.telefono,
    clientIp: ip,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    leadId: result.leadId,
    requestId,
    score: result.score,
  });
}
