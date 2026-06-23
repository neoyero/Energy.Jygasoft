import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { calcInputSchema } from "@/lib/validators/calc";
import { leadInputSchema } from "@/lib/validators/lead";
import { calcular } from "@/lib/calc";
import { resolveCalcConfig } from "@/lib/calc-config";
import { verifyTurnstile } from "@/lib/turnstile";
import { createRateLimiter } from "@/lib/rate-limit";
import { persistLead } from "@/lib/lead-service";
import { dispatchLeadToN8n, type N8nLeadEnvelope } from "@/lib/n8n";
import { sendCapiEvent } from "@/lib/meta-capi";
import { db, schema } from "@/db";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({
  max: serverEnv.RATE_LIMIT_MAX,
  windowMs: serverEnv.RATE_LIMIT_WINDOW_MS,
  maxEntries: 5000,
});

const DISCLAIMER =
  "Estimación referencial. Los excedentes inyectados a la red se liquidan a PML (precio marginal local, menor a la tarifa de consumo). El resultado depende de tu consumo, tarifa y esquema de interconexión.";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

const numToStr = (n: number | undefined | null): string | undefined =>
  n === undefined || n === null ? undefined : String(n);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!limiter.check(ip).allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = calcInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.company_website) {
    return NextResponse.json({ ok: false, error: "spam" }, { status: 400 });
  }

  // 1. Resolver config desde BD y calcular (en servidor).
  const cfg = await resolveCalcConfig({
    segmento: input.segmento,
    municipio: input.municipio,
    estado: input.estado,
    cp: input.cp,
    tarifa: input.tarifa,
  });

  let result;
  try {
    result = calcular(
      {
        reciboMxn: input.reciboMxn,
        consumoKwhMes: input.consumoKwhMes,
        hsp: cfg.hsp,
        precioKwh: cfg.precioKwh,
      },
      cfg.constants,
    );
  } catch {
    return NextResponse.json({ ok: false, error: "calc_failed" }, { status: 400 });
  }

  // 2. Captura opcional de lead (si dejó contacto + consentimiento).
  const quiereContacto =
    Boolean(input.email || input.telefono) && input.consentimiento_datos === true;

  let leadId: string | undefined;
  let capturedRequestId: string | undefined;
  if (quiereContacto) {
    const turnstile = await verifyTurnstile(input.turnstileToken, ip);
    if (!turnstile.success) {
      return NextResponse.json(
        { ok: false, error: "turnstile", reason: turnstile.reason },
        { status: 400 },
      );
    }

    const leadParsed = leadInputSchema.safeParse({
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      segmento: input.segmento,
      cp: input.cp,
      municipio: input.municipio,
      estado: input.estado,
      consumo_kwh_mes: input.consumoKwhMes,
      recibo_mxn: input.reciboMxn,
      consentimiento_datos: input.consentimiento_datos,
      consentimiento_marketing: input.consentimiento_marketing ?? false,
      origen: { form: "calculadora", utm: {} },
    });

    if (leadParsed.success) {
      const requestId = randomUUID();
      capturedRequestId = requestId;
      const persisted = await persistLead({
        input: leadParsed.data,
        requestId,
        form: "calculadora",
        ip,
        userAgent: req.headers.get("user-agent"),
        sizing: {
          kwp: result.kwp,
          paneles: result.paneles,
          inversionMin: result.inversionMin,
          inversionMax: result.inversionMax,
          ahorroAnualMxn: result.ahorroAnualMxn,
        },
      });
      leadId = persisted.leadId || undefined;

      if (!persisted.duplicate) {
        const envelope: N8nLeadEnvelope = {
          schema_version: 1,
          evento: "lead.created",
          request_id: requestId,
          lead: {
            id: leadId,
            nombre: input.nombre,
            email: input.email,
            telefono: input.telefono,
            segmento: input.segmento,
            score: persisted.score,
            caliente: persisted.caliente,
          },
          origen: { form: "calculadora", utm: {} },
          sizing: {
            kwp: result.kwp,
            paneles: result.paneles,
            inversion_min: result.inversionMin,
            inversion_max: result.inversionMax,
            ahorro_estimado_mxn: result.ahorroAnualMxn,
          },
        };
        await dispatchLeadToN8n(envelope);

        await sendCapiEvent({
          eventName: "Lead",
          eventId: requestId,
          email: input.email,
          phone: input.telefono,
          clientIp: ip,
          userAgent: req.headers.get("user-agent"),
          value: result.ahorroAnualMxn,
        });
      }
    }
  }

  // 3. Persistir la simulación (siempre).
  const [sim] = await db
    .insert(schema.calculadoraSimulaciones)
    .values({
      leadId,
      cp: input.cp,
      segmento: input.segmento,
      tarifa: cfg.tarifa,
      reciboMxn: numToStr(input.reciboMxn),
      consumoKwh: numToStr(result.consumoKwhMes),
      hsp: numToStr(result.hsp),
      pr: numToStr(cfg.constants.pr),
      kwpSugerido: numToStr(result.kwp),
      paneles: result.paneles,
      produccionAnualKwh: numToStr(result.produccionAnualKwh),
      inversionMin: numToStr(result.inversionMin),
      inversionMax: numToStr(result.inversionMax),
      ahorroAnualMxn: numToStr(result.ahorroAnualMxn),
      paybackAnios: numToStr(result.paybackAnios),
    })
    .returning({ id: schema.calculadoraSimulaciones.id });

  // Vincular simulación al evento (si hubo lead).
  if (leadId) {
    await db.insert(schema.eventos).values({
      entidadTipo: "lead",
      entidadId: leadId,
      tipo: "simulacion",
      descripcion: `Simulación: ${result.kwp} kWp, ${result.paneles} paneles`,
      payload: { simulacionId: sim.id, ...result },
      actor: "web",
    });
  }

  return NextResponse.json({
    ok: true,
    simulacionId: sim.id,
    leadId,
    requestId: capturedRequestId,
    tarifa: cfg.tarifa,
    resultado: result,
    disclaimer: DISCLAIMER,
  });
}
