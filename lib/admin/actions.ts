"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { assertPerm, actorOf } from "@/lib/admin/guard";

type LeadEstado = (typeof schema.leadEstado.enumValues)[number];
type OportEtapa = (typeof schema.oportunidadEtapa.enumValues)[number];

export async function updateLeadEstado(id: string, estado: LeadEstado) {
  const actor = actorOf(await assertPerm("leads", "edit"));
  await db.transaction(async (tx) => {
    await tx.update(schema.leads).set({ estado }).where(eq(schema.leads.id, id));
    await tx.insert(schema.eventos).values({
      entidadTipo: "lead",
      entidadId: id,
      tipo: "cambio_estado",
      descripcion: `Estado → ${estado}`,
      payload: { estado },
      actor,
    });
  });
  revalidatePath("/je-admin/leads");
  revalidatePath(`/je-admin/leads/${id}`);
}

export async function updateOportunidadEtapa(id: string, etapa: OportEtapa) {
  const actor = actorOf(await assertPerm("oportunidades", "edit"));
  await db.transaction(async (tx) => {
    await tx
      .update(schema.oportunidades)
      .set({ etapa })
      .where(eq(schema.oportunidades.id, id));
    await tx.insert(schema.eventos).values({
      entidadTipo: "oportunidad",
      entidadId: id,
      tipo: "cambio_etapa",
      descripcion: `Etapa → ${etapa}`,
      payload: { etapa },
      actor,
    });
  });
  revalidatePath("/je-admin/oportunidades");
}

/** Convierte un lead en cliente + oportunidad (deal). */
export async function convertLead(id: string) {
  const actor = actorOf(await assertPerm("leads", "edit"));

  await db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    if (!lead) throw new Error("Lead no encontrado");

    const tipoPersona =
      lead.segmento === "negocio" ? "pm_comercial" : "pf_residencial";

    const [cliente] = await tx
      .insert(schema.clientes)
      .values({
        tipoPersona,
        nombre: lead.nombre ?? "Sin nombre",
        email: lead.email,
        telefono: lead.telefono,
        municipio: lead.municipio,
        cp: lead.cp,
        vendedorId: lead.vendedorId,
        leadOrigenId: lead.id,
      })
      .returning({ id: schema.clientes.id });

    const [oport] = await tx
      .insert(schema.oportunidades)
      .values({
        clienteId: cliente.id,
        leadId: lead.id,
        vendedorId: lead.vendedorId,
        nombre: `Oportunidad ${lead.nombre ?? lead.telefono ?? lead.email ?? ""}`.trim(),
        etapa: "calificacion",
        capacidadKwp: lead.sizingKwp,
        montoEstimado: lead.inversionMax,
      })
      .returning({ id: schema.oportunidades.id });

    await tx
      .update(schema.leads)
      .set({ estado: "convertido" })
      .where(eq(schema.leads.id, id));

    await tx.insert(schema.eventos).values([
      {
        entidadTipo: "lead",
        entidadId: lead.id,
        tipo: "convertido",
        descripcion: "Lead convertido a cliente + oportunidad",
        payload: { clienteId: cliente.id, oportunidadId: oport.id },
        actor,
      },
      {
        entidadTipo: "cliente",
        entidadId: cliente.id,
        tipo: "creado",
        descripcion: "Cliente creado desde lead",
        payload: { leadId: lead.id },
        actor,
      },
      {
        entidadTipo: "oportunidad",
        entidadId: oport.id,
        tipo: "creado",
        descripcion: "Oportunidad creada desde lead",
        payload: { leadId: lead.id, clienteId: cliente.id },
        actor,
      },
    ]);
  });

  revalidatePath("/je-admin/leads");
  revalidatePath(`/je-admin/leads/${id}`);
  revalidatePath("/je-admin/oportunidades");
}

/* ──────────────────────────── Usuarios / Equipo ──────────────────────────── */

type ActionResult = { ok: true } | { ok: false; error: string };

const rolSchema = z.enum(schema.usuarioRol.enumValues);

const createUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().trim().toLowerCase().email("Correo no válido."),
  rol: rolSchema,
  telefono: z
    .string()
    .trim()
    .max(40, "Teléfono demasiado largo.")
    .optional()
    .transform((v) => (v ? v : null)),
});

const updateUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  rol: rolSchema,
  telefono: z
    .string()
    .trim()
    .max(40, "Teléfono demasiado largo.")
    .optional()
    .transform((v) => (v ? v : null)),
});

function isUniqueEmailViolation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("ux_usuarios_email");
}

/**
 * Da de alta a un miembro del equipo. No fija contraseña: entran por OTP al
 * correo. NO escribe en `eventos` (el enum entidad_tipo no incluye 'usuario').
 */
export async function createUsuario(data: {
  nombre: string;
  email: string;
  rol: string;
  telefono?: string;
}): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");

  const parsed = createUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  try {
    await db.insert(schema.usuarios).values({
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      rol: parsed.data.rol,
      telefono: parsed.data.telefono,
      activo: true,
    });
  } catch (error: unknown) {
    if (isUniqueEmailViolation(error)) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    return { ok: false, error: "No se pudo crear el usuario." };
  }

  revalidatePath("/je-admin/usuarios");
  return { ok: true };
}

/** Actualiza nombre, rol y teléfono de un usuario. */
export async function updateUsuario(
  id: string,
  data: { nombre: string; rol: string; telefono?: string },
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");

  const parsed = updateUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  try {
    await db
      .update(schema.usuarios)
      .set({
        nombre: parsed.data.nombre,
        rol: parsed.data.rol,
        telefono: parsed.data.telefono,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.usuarios.id, id));
  } catch {
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }

  revalidatePath("/je-admin/usuarios");
  return { ok: true };
}

/** Activa o desactiva el acceso de un usuario. */
export async function toggleUsuarioActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");

  try {
    await db
      .update(schema.usuarios)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.usuarios.id, id));
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del usuario." };
  }

  revalidatePath("/je-admin/usuarios");
  return { ok: true };
}

/* ──────────────────────────── Leads / Pipeline (D3) ──────────────────────── */

const COMERCIAL_ROLES = ["admin", "gerente", "vendedor", "preventa"] as const;

/** Estados de lead que aún no han sido "trabajados" (pasan a asignado). */
const LEAD_ESTADOS_ASIGNABLES: ReadonlySet<LeadEstado> = new Set<LeadEstado>([
  "nuevo",
  "sin_calificar",
  "en_nutricion",
  "calificado",
]);

const asignarLeadSchema = z.object({
  leadId: z.string().uuid("Lead no válido."),
  vendedorId: z.string().uuid("Vendedor no válido.").nullable(),
});

/**
 * Asigna (o desasigna) un lead a un vendedor. Si `vendedorId` es null, limpia la
 * asignación. Al asignar, valida que el usuario esté activo y sea comercial, y
 * promueve el estado a `asignado` si aún no había sido trabajado. Deja traza en
 * la bitácora (eventos).
 */
export async function asignarLead(
  leadId: string,
  vendedorId: string | null,
): Promise<void> {
  const actor = actorOf(await assertPerm("leads", "edit"));

  const parsed = asignarLeadSchema.safeParse({ leadId, vendedorId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  }
  const { leadId: id, vendedorId: vid } = parsed.data;

  await db.transaction(async (tx) => {
    if (vid !== null) {
      const [vendedor] = await tx
        .select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(
          and(
            eq(schema.usuarios.id, vid),
            eq(schema.usuarios.activo, true),
            inArray(schema.usuarios.rol, [...COMERCIAL_ROLES]),
          ),
        )
        .limit(1);
      if (!vendedor) {
        throw new Error("El vendedor no está activo o no es comercial.");
      }

      const [lead] = await tx
        .select({ estado: schema.leads.estado })
        .from(schema.leads)
        .where(eq(schema.leads.id, id))
        .limit(1);
      if (!lead) throw new Error("Lead no encontrado");

      const nuevoEstado: LeadEstado = LEAD_ESTADOS_ASIGNABLES.has(lead.estado)
        ? "asignado"
        : lead.estado;

      await tx
        .update(schema.leads)
        .set({
          vendedorId: vid,
          asignadoAt: new Date().toISOString(),
          estado: nuevoEstado,
        })
        .where(eq(schema.leads.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "lead",
        entidadId: id,
        tipo: "asignacion",
        descripcion: "Lead asignado a vendedor",
        payload: { vendedorId: vid },
        actor,
      });
    } else {
      await tx
        .update(schema.leads)
        .set({ vendedorId: null, asignadoAt: null })
        .where(eq(schema.leads.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "lead",
        entidadId: id,
        tipo: "asignacion",
        descripcion: "Lead desasignado",
        payload: { vendedorId: null },
        actor,
      });
    }
  });

  revalidatePath("/je-admin/leads");
  revalidatePath(`/je-admin/leads/${id}`);
}

const actualizarOportunidadSchema = z.object({
  etapa: z.enum(schema.oportunidadEtapa.enumValues).optional(),
  montoEstimado: z
    .number()
    .nonnegative("El monto no puede ser negativo.")
    .nullable()
    .optional(),
  probabilidad: z
    .number()
    .int("La probabilidad debe ser un entero.")
    .min(0, "La probabilidad mínima es 0.")
    .max(100, "La probabilidad máxima es 100.")
    .nullable()
    .optional(),
  fechaCierreEstimada: z
    .string()
    .date("Fecha de cierre no válida.")
    .nullable()
    .optional(),
  motivoPerdida: z
    .string()
    .max(500, "El motivo es demasiado largo.")
    .nullable()
    .optional(),
});

type ActualizarOportunidadInput = z.input<typeof actualizarOportunidadSchema>;

/** Campos persistibles de una oportunidad (tras validación). */
type OportunidadUpdate = {
  etapa?: OportEtapa;
  montoEstimado?: string | null;
  probabilidad?: number | null;
  fechaCierreEstimada?: string | null;
  motivoPerdida?: string | null;
  cerradaAt?: string;
};

/**
 * Actualiza campos de una oportunidad (etapa, monto, probabilidad, fecha de
 * cierre, motivo de pérdida). Solo escribe los campos presentes. Si la etapa es
 * `perdida` exige motivo; al cerrar (ganada/perdida) sella `cerradaAt`. Deja
 * traza en la bitácora (eventos).
 */
export async function actualizarOportunidad(
  id: string,
  data: ActualizarOportunidadInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("oportunidades", "edit"));

  const parsed = actualizarOportunidadSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  if (d.etapa === "perdida" && !d.motivoPerdida) {
    return { ok: false, error: "Indica el motivo de pérdida." };
  }

  const update: OportunidadUpdate = {};
  if (d.etapa !== undefined) update.etapa = d.etapa;
  if (d.montoEstimado !== undefined) {
    update.montoEstimado =
      d.montoEstimado === null ? null : String(d.montoEstimado);
  }
  if (d.probabilidad !== undefined) update.probabilidad = d.probabilidad;
  if (d.fechaCierreEstimada !== undefined) {
    update.fechaCierreEstimada = d.fechaCierreEstimada;
  }
  if (d.motivoPerdida !== undefined) update.motivoPerdida = d.motivoPerdida;
  if (d.etapa === "ganada" || d.etapa === "perdida") {
    update.cerradaAt = new Date().toISOString();
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.oportunidades)
        .set(update)
        .where(eq(schema.oportunidades.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "oportunidad",
        entidadId: id,
        tipo: "cambio",
        descripcion: "Oportunidad actualizada",
        payload: { ...d },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar la oportunidad." };
  }

  revalidatePath("/je-admin/oportunidades");
  return { ok: true };
}
