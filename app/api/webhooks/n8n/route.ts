import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { verify } from "@/lib/hmac";
import { serverEnv } from "@/lib/env";
import { db, schema } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inboundSchema = z.object({
  evento: z.string().min(1),
  request_id: z.string().min(1),
  entidad: z.object({
    tipo: z.enum(["lead", "oportunidad", "proyecto", "tramite_cfe"]),
    id: z.string().uuid(),
  }),
  cambios: z
    .object({
      estado: z.string().optional(),
      etapa: z.string().optional(),
      fase: z.string().optional(),
      vendedor_id: z.string().uuid().optional(),
    })
    .default({}),
});

async function logInbound(args: {
  evento: string;
  payload: unknown;
  ok: boolean;
  requestId: string;
  error?: string;
}) {
  try {
    await db.insert(schema.webhookLog).values({
      direccion: "entrante",
      evento: args.evento,
      payload: (args.payload ?? {}) as Record<string, unknown>,
      ok: args.ok,
      requestId: args.requestId,
      error: args.error,
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: NextRequest) {
  const secret = serverEnv.WEBHOOK_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-jygasoft-signature") ?? "";
  const ts = req.headers.get("x-jygasoft-timestamp") ?? "";

  if (!verify(raw, ts, sig, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = inboundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { evento, request_id, entidad, cambios } = parsed.data;

  // Idempotencia: si ya procesamos este request_id entrante, no repetir.
  const [dup] = await db
    .select({ id: schema.webhookLog.id })
    .from(schema.webhookLog)
    .where(
      and(
        eq(schema.webhookLog.direccion, "entrante"),
        eq(schema.webhookLog.requestId, request_id),
        eq(schema.webhookLog.ok, true),
      ),
    )
    .limit(1);
  if (dup) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await db.transaction(async (tx) => {
      switch (entidad.tipo) {
        case "lead": {
          const set: Record<string, unknown> = {};
          if (cambios.estado) set.estado = cambios.estado;
          if (cambios.vendedor_id) {
            set.vendedorId = cambios.vendedor_id;
            set.asignadoAt = sql`now()`;
          }
          if (Object.keys(set).length)
            await tx.update(schema.leads).set(set).where(eq(schema.leads.id, entidad.id));
          break;
        }
        case "oportunidad":
          if (cambios.etapa)
            await tx
              .update(schema.oportunidades)
              .set({ etapa: cambios.etapa as never })
              .where(eq(schema.oportunidades.id, entidad.id));
          break;
        case "proyecto":
          if (cambios.fase)
            await tx
              .update(schema.proyectos)
              .set({ fase: cambios.fase as never })
              .where(eq(schema.proyectos.id, entidad.id));
          break;
        case "tramite_cfe":
          if (cambios.estado)
            await tx
              .update(schema.tramitesCfe)
              .set({ estado: cambios.estado as never })
              .where(eq(schema.tramitesCfe.id, entidad.id));
          break;
      }

      await tx.insert(schema.eventos).values({
        entidadTipo: entidad.tipo === "tramite_cfe" ? "proyecto" : entidad.tipo,
        entidadId: entidad.id,
        tipo: "webhook_n8n",
        descripcion: `Actualización vía n8n: ${evento}`,
        payload: { evento, cambios },
        actor: "n8n",
      });
    });

    await logInbound({ evento, payload: parsed.data, ok: true, requestId: request_id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logInbound({
      evento,
      payload: parsed.data,
      ok: false,
      requestId: request_id,
      error: error instanceof Error ? error.message : "update_failed",
    });
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}
