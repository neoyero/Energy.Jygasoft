import { eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { scoreLead } from "@/lib/leadScore";
import type { LeadInput } from "@/lib/validators/lead";

/**
 * Persistencia de leads (Fase 3). Idempotente por `request_id` en
 * form_submissions; dedupe de leads por email/teléfono. Escribe en `eventos`.
 */

export interface LeadSizing {
  kwp?: number;
  paneles?: number;
  inversionMin?: number;
  inversionMax?: number;
  ahorroAnualMxn?: number;
}

export interface PersistLeadArgs {
  input: LeadInput;
  requestId: string;
  form: string;
  ip?: string | null;
  userAgent?: string | null;
  sizing?: LeadSizing | null;
}

export interface PersistLeadResult {
  leadId: string;
  score: number;
  caliente: boolean;
  duplicate: boolean;
}

const numToStr = (n: number | undefined | null): string | undefined =>
  n === undefined || n === null ? undefined : String(n);

export async function persistLead(
  args: PersistLeadArgs,
): Promise<PersistLeadResult> {
  const { input, requestId, form } = args;
  const emailLower = input.email?.toLowerCase();

  const { score, caliente } = scoreLead({
    segmento: input.segmento,
    uso: input.uso,
    cp: input.cp,
    consumoKwhMes: input.consumo_kwh_mes,
    reciboMxn: input.recibo_mxn,
    esTitular: input.es_titular,
    esPropietario: input.es_propietario,
  });

  return db.transaction(async (tx) => {
    // 1. Auditoría idempotente: si el request_id ya existe, no reprocesar.
    const [fs] = await tx
      .insert(schema.formSubmissions)
      .values({
        form,
        payload: input as unknown as Record<string, unknown>,
        ip: args.ip ?? undefined,
        userAgent: args.userAgent ?? undefined,
        requestId,
      })
      .onConflictDoNothing({ target: schema.formSubmissions.requestId })
      .returning({ id: schema.formSubmissions.id });

    if (!fs) {
      const [prev] = await tx
        .select({ leadId: schema.formSubmissions.leadId })
        .from(schema.formSubmissions)
        .where(eq(schema.formSubmissions.requestId, requestId))
        .limit(1);
      return {
        leadId: prev?.leadId ?? "",
        score,
        caliente,
        duplicate: true,
      };
    }

    // 2. Dedupe lead por email (lower) o teléfono.
    const dedupeConds = [];
    if (emailLower) {
      dedupeConds.push(sql`lower(${schema.leads.email}) = ${emailLower}`);
    }
    if (input.telefono) {
      dedupeConds.push(eq(schema.leads.telefono, input.telefono));
    }

    let existingId: string | undefined;
    if (dedupeConds.length > 0) {
      const [found] = await tx
        .select({ id: schema.leads.id })
        .from(schema.leads)
        .where(or(...dedupeConds))
        .limit(1);
      existingId = found?.id;
    }

    const leadValues = {
      nombre: input.nombre,
      email: emailLower,
      telefono: input.telefono,
      segmento: input.segmento,
      uso: input.uso,
      cp: input.cp,
      municipio: input.municipio,
      estadoMx: input.estado,
      consumoKwhMes: numToStr(input.consumo_kwh_mes),
      reciboMxn: numToStr(input.recibo_mxn),
      esTitular: input.es_titular,
      esPropietario: input.es_propietario,
      utm: input.origen.utm ?? {},
      landingUrl: input.origen.landing_url,
      referrer: input.origen.referrer,
      origenForm: form,
      consentimientoDatos: input.consentimiento_datos,
      consentimientoMarketing: input.consentimiento_marketing,
      score,
      sizingKwp: numToStr(args.sizing?.kwp),
      sizingPaneles: args.sizing?.paneles,
      inversionMin: numToStr(args.sizing?.inversionMin),
      inversionMax: numToStr(args.sizing?.inversionMax),
      ahorroEstimadoMxn: numToStr(args.sizing?.ahorroAnualMxn),
    };

    let leadId: string;
    let tipoEvento: string;

    if (existingId) {
      // Actualiza solo campos presentes (no pisar con undefined).
      const updates = Object.fromEntries(
        Object.entries(leadValues).filter(([, v]) => v !== undefined),
      );
      await tx
        .update(schema.leads)
        .set(updates)
        .where(eq(schema.leads.id, existingId));
      leadId = existingId;
      tipoEvento = "reingreso";
    } else {
      const [created] = await tx
        .insert(schema.leads)
        .values(leadValues)
        .returning({ id: schema.leads.id });
      leadId = created.id;
      tipoEvento = "creado";
    }

    // 3. Liga la submission al lead.
    await tx
      .update(schema.formSubmissions)
      .set({ leadId })
      .where(eq(schema.formSubmissions.id, fs.id));

    // 4. Timeline.
    await tx.insert(schema.eventos).values({
      entidadTipo: "lead",
      entidadId: leadId,
      tipo: tipoEvento,
      descripcion: `Lead vía ${form} (score ${score}${caliente ? ", caliente" : ""})`,
      payload: { form, requestId, score, caliente },
      actor: "web",
    });

    return { leadId, score, caliente, duplicate: false };
  });
}
