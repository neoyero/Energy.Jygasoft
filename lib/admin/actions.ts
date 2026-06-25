"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { assertPerm, actorOf } from "@/lib/admin/guard";
import { isScoped } from "@/lib/admin/queries";
import { calcularTotales, IVA_RATE } from "@/lib/admin/cotizacion-calc";

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

/**
 * ¿El usuario es un asesor ACTIVO (y por tanto asignable a leads)? Requiere un
 * registro en `asesores` activo, vinculado a un usuario también activo.
 */
async function usuarioEsAsesorActivo(usuarioId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.asesores.id })
    .from(schema.asesores)
    .innerJoin(
      schema.usuarios,
      eq(schema.asesores.usuarioId, schema.usuarios.id),
    )
    .where(
      and(
        eq(schema.asesores.usuarioId, usuarioId),
        eq(schema.asesores.activo, true),
        eq(schema.usuarios.activo, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

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
      const [asesor] = await tx
        .select({ id: schema.asesores.id })
        .from(schema.asesores)
        .innerJoin(
          schema.usuarios,
          eq(schema.asesores.usuarioId, schema.usuarios.id),
        )
        .where(
          and(
            eq(schema.asesores.usuarioId, vid),
            eq(schema.asesores.activo, true),
            eq(schema.usuarios.activo, true),
          ),
        )
        .limit(1);
      if (!asesor) {
        throw new Error("Solo se puede asignar el lead a un asesor activo.");
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

/* ── Alta / edición manual de leads ── */

/** "" / null / undefined -> null; recorta espacios. */
const textoOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

/** Numeric (string|number) -> string normalizada o null; no admite negativos. */
const numericoOpcional = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor numérico no válido.",
      });
      return z.NEVER;
    }
    return s;
  });

/** Email opcional: vacío -> null; si hay valor, debe ser válido. */
const emailOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
  .refine(
    (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    "Correo no válido.",
  );

/** Vendedor opcional: vacío -> null; si hay valor, debe ser un UUID. */
const vendedorOpcional = z
  .string()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine(
    (v) => v === null || z.string().uuid().safeParse(v).success,
    "Vendedor no válido.",
  );

const leadFormSchema = z.object({
  nombre: textoOpcional,
  email: emailOpcional,
  telefono: textoOpcional,
  segmento: z.enum(["residencial", "negocio"]).nullish().transform((v) => v ?? null),
  uso: z.enum(schema.usoInmueble.enumValues).nullish().transform((v) => v ?? null),
  cp: textoOpcional,
  colonia: textoOpcional,
  municipio: textoOpcional,
  estadoMx: textoOpcional,
  consumoKwhMes: numericoOpcional,
  reciboMxn: numericoOpcional,
  esTitular: z.boolean().nullish().transform((v) => v ?? null),
  esPropietario: z.boolean().nullish().transform((v) => v ?? null),
  canal: z.enum(schema.leadCanal.enumValues),
  consentimientoDatos: z.boolean(),
  consentimientoMarketing: z.boolean(),
  notas: textoOpcional,
  vendedorId: vendedorOpcional,
});

/** Campos comunes que se escriben en INSERT/UPDATE de un lead. */
function leadValues(d: z.output<typeof leadFormSchema>) {
  return {
    nombre: d.nombre,
    email: d.email,
    telefono: d.telefono,
    segmento: d.segmento,
    uso: d.uso,
    cp: d.cp,
    colonia: d.colonia,
    municipio: d.municipio,
    estadoMx: d.estadoMx,
    consumoKwhMes: d.consumoKwhMes,
    reciboMxn: d.reciboMxn,
    esTitular: d.esTitular,
    esPropietario: d.esPropietario,
    canal: d.canal,
    consentimientoDatos: d.consentimientoDatos,
    consentimientoMarketing: d.consentimientoMarketing,
    notas: d.notas,
    vendedorId: d.vendedorId,
  };
}

/** Alta manual de un lead desde el panel. */
export async function crearLead(
  data: z.input<typeof leadFormSchema>,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("leads", "edit"));

  const parsed = leadFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  if (!d.nombre && !d.telefono && !d.email) {
    return {
      ok: false,
      error: "Indica al menos un dato de contacto (nombre, teléfono o correo).",
    };
  }

  if (d.vendedorId !== null && !(await usuarioEsAsesorActivo(d.vendedorId))) {
    return { ok: false, error: "El responsable debe ser un asesor activo." };
  }

  try {
    await db.transaction(async (tx) => {
      const asignado = d.vendedorId !== null;
      const [lead] = await tx
        .insert(schema.leads)
        .values({
          ...leadValues(d),
          estado: asignado ? "asignado" : "nuevo",
          asignadoAt: asignado ? new Date().toISOString() : null,
          origenForm: "alta_manual",
        })
        .returning({ id: schema.leads.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: "lead",
        entidadId: lead.id,
        tipo: "creado",
        descripcion: "Lead creado manualmente",
        payload: { origen: "alta_manual" },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo crear el lead." };
  }

  revalidatePath("/je-admin/leads");
  return { ok: true };
}

/** Actualiza los datos editables de un lead existente. */
export async function actualizarLead(
  id: string,
  data: z.input<typeof leadFormSchema>,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("leads", "edit"));

  const parsed = leadFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  if (d.vendedorId !== null && !(await usuarioEsAsesorActivo(d.vendedorId))) {
    return { ok: false, error: "El responsable debe ser un asesor activo." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.leads)
        .set({ ...leadValues(d), updatedAt: new Date().toISOString() })
        .where(eq(schema.leads.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "lead",
        entidadId: id,
        tipo: "actualizado",
        descripcion: "Datos del lead actualizados",
        payload: {},
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar el lead." };
  }

  revalidatePath("/je-admin/leads");
  revalidatePath(`/je-admin/leads/${id}`);
  return { ok: true };
}

/* ──────────────────────────── Asesores ──────────────────────────── */

const asesorSchema = z.object({
  usuarioId: z
    .string()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || z.string().uuid().safeParse(v).success,
      "Usuario no válido.",
    ),
  nombre: z.string().trim().min(2, "El nombre del asesor es obligatorio."),
  chatwootAgentId: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID de agente Chatwoot no válido (entero ≥ 0).",
        });
        return z.NEVER;
      }
      return n;
    }),
  msEmail: emailOpcional,
  telefono: textoOpcional,
  zonas: z.array(z.string().trim().min(1)).default([]),
  segmentos: z.array(z.enum(["residencial", "negocio"])).default([]),
  activo: z.boolean().default(true),
});

/** Valores comunes para INSERT/UPDATE de un asesor. */
function asesorValues(d: z.output<typeof asesorSchema>) {
  return {
    usuarioId: d.usuarioId,
    nombre: d.nombre,
    chatwootAgentId: d.chatwootAgentId,
    msEmail: d.msEmail,
    telefono: d.telefono,
    zonas: d.zonas,
    segmentos: d.segmentos,
    activo: d.activo,
  };
}

/** Registra un asesor (habilita a un usuario para recibir/atender leads). */
export async function crearAsesor(
  data: z.input<typeof asesorSchema>,
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");
  const parsed = asesorSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  try {
    await db.insert(schema.asesores).values(asesorValues(parsed.data));
  } catch {
    return { ok: false, error: "No se pudo crear el asesor." };
  }
  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/leads");
  return { ok: true };
}

/** Actualiza los datos de un asesor. */
export async function actualizarAsesor(
  id: string,
  data: z.input<typeof asesorSchema>,
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");
  const parsed = asesorSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  try {
    await db
      .update(schema.asesores)
      .set({ ...asesorValues(parsed.data), updatedAt: new Date().toISOString() })
      .where(eq(schema.asesores.id, id));
  } catch {
    return { ok: false, error: "No se pudo actualizar el asesor." };
  }
  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/leads");
  return { ok: true };
}

/** Activa o desactiva un asesor (desactivado = no asignable a leads). */
export async function toggleAsesorActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");
  try {
    await db
      .update(schema.asesores)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.asesores.id, id));
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del asesor." };
  }
  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/leads");
  return { ok: true };
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

/* ──────────────────────────── Clientes (D4) ──────────────────────────────── */

type TipoPersona = (typeof schema.tipoPersona.enumValues)[number];
type NivelTension = (typeof schema.nivelTension.enumValues)[number];
type CotizacionEstadoEnum = (typeof schema.cotizacionEstado.enumValues)[number];

/** Normaliza un texto opcional de formulario: "" / espacios -> null. */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, "Texto demasiado largo.")
    .nullish()
    .transform((v) => (v ? v : null));

const clienteSchema = z.object({
  tipoPersona: z.enum(schema.tipoPersona.enumValues),
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  rfc: optionalText(20),
  curp: optionalText(20),
  regimenFiscal: optionalText(120),
  csfActualizadaAt: z
    .string()
    .date("Fecha de CSF no válida.")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  email: optionalText(160),
  telefono: optionalText(40),
  domicilio: optionalText(),
  municipio: optionalText(120),
  estadoMx: optionalText(120),
  cp: optionalText(10),
  numeroServicioCfe: optionalText(60),
  tarifa: optionalText(40),
  nivelTension: z
    .enum(schema.nivelTension.enumValues)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  titularCfe: optionalText(160),
  vendedorId: z
    .string()
    .uuid("Vendedor no válido.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  notas: optionalText(2000),
});

type ClienteInput = z.input<typeof clienteSchema>;

/** Mapea los datos validados del cliente a columnas persistibles. */
function clienteValuesOf(d: z.output<typeof clienteSchema>): {
  tipoPersona: TipoPersona;
  nombre: string;
  rfc: string | null;
  curp: string | null;
  regimenFiscal: string | null;
  csfActualizadaAt: string | null;
  email: string | null;
  telefono: string | null;
  domicilio: string | null;
  municipio: string | null;
  estadoMx: string | null;
  cp: string | null;
  numeroServicioCfe: string | null;
  tarifa: string | null;
  nivelTension: NivelTension | null;
  titularCfe: string | null;
  vendedorId: string | null;
  notas: string | null;
} {
  return {
    tipoPersona: d.tipoPersona,
    nombre: d.nombre,
    rfc: d.rfc,
    curp: d.curp,
    regimenFiscal: d.regimenFiscal,
    csfActualizadaAt: d.csfActualizadaAt,
    email: d.email,
    telefono: d.telefono,
    domicilio: d.domicilio,
    municipio: d.municipio,
    estadoMx: d.estadoMx,
    cp: d.cp,
    numeroServicioCfe: d.numeroServicioCfe,
    tarifa: d.tarifa,
    nivelTension: d.nivelTension,
    titularCfe: d.titularCfe,
    vendedorId: d.vendedorId,
    notas: d.notas,
  };
}

/** Da de alta un cliente. Deja traza en la bitácora (eventos). */
export async function crearCliente(
  data: ClienteInput,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("clientes", "edit"));

  const parsed = clienteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  try {
    const id = await db.transaction(async (tx) => {
      const [cliente] = await tx
        .insert(schema.clientes)
        .values(clienteValuesOf(parsed.data))
        .returning({ id: schema.clientes.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: "cliente",
        entidadId: cliente.id,
        tipo: "creado",
        descripcion: "Cliente creado",
        payload: { nombre: parsed.data.nombre },
        actor,
      });

      return cliente.id;
    });

    revalidatePath("/je-admin/clientes");
    revalidatePath(`/je-admin/clientes/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo crear el cliente." };
  }
}

/** Actualiza los datos de un cliente. */
export async function actualizarCliente(
  id: string,
  data: ClienteInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("clientes", "edit"));

  const parsed = clienteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.clientes)
        .set({
          ...clienteValuesOf(parsed.data),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.clientes.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cliente",
        entidadId: id,
        tipo: "actualizado",
        descripcion: "Cliente actualizado",
        payload: { nombre: parsed.data.nombre },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar el cliente." };
  }

  revalidatePath("/je-admin/clientes");
  revalidatePath(`/je-admin/clientes/${id}`);
  return { ok: true };
}

/* ──────────────────────────── Contactos (D4) ─────────────────────────────── */

const contactoSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  cargo: optionalText(120),
  email: optionalText(160),
  telefono: optionalText(40),
  esPrincipal: z.boolean(),
});

type ContactoInput = z.input<typeof contactoSchema>;

/**
 * Si el contacto se marca como principal, quita la marca a los demás contactos
 * del mismo cliente (dentro de la misma transacción).
 */
async function unsetOtrosPrincipales(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clienteId: string,
  exceptoContactoId?: string,
): Promise<void> {
  const conds: SQL[] = [
    eq(schema.contactos.clienteId, clienteId),
    eq(schema.contactos.esPrincipal, true),
  ];
  if (exceptoContactoId !== undefined) {
    conds.push(ne(schema.contactos.id, exceptoContactoId));
  }
  await tx
    .update(schema.contactos)
    .set({ esPrincipal: false })
    .where(and(...conds));
}

/** Agrega un contacto a un cliente. */
export async function agregarContacto(
  clienteId: string,
  data: ContactoInput,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("clientes", "edit"));

  const parsed = contactoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  try {
    const id = await db.transaction(async (tx) => {
      if (d.esPrincipal) await unsetOtrosPrincipales(tx, clienteId);

      const [contacto] = await tx
        .insert(schema.contactos)
        .values({
          clienteId,
          nombre: d.nombre,
          cargo: d.cargo,
          email: d.email,
          telefono: d.telefono,
          esPrincipal: d.esPrincipal,
        })
        .returning({ id: schema.contactos.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: "contacto",
        entidadId: clienteId,
        tipo: "creado",
        descripcion: "Contacto agregado",
        payload: { contactoId: contacto.id, nombre: d.nombre },
        actor,
      });

      return contacto.id;
    });

    revalidatePath(`/je-admin/clientes/${clienteId}`);
    return { ok: true, id: String(id) };
  } catch {
    return { ok: false, error: "No se pudo agregar el contacto." };
  }
}

/** Actualiza un contacto. */
export async function actualizarContacto(
  id: string,
  data: ContactoInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("clientes", "edit"));

  const parsed = contactoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;
  const contactoId = id; // contactos.id es uuid (string)

  try {
    const clienteId = await db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ clienteId: schema.contactos.clienteId })
        .from(schema.contactos)
        .where(eq(schema.contactos.id, contactoId))
        .limit(1);
      if (!actual) throw new Error("Contacto no encontrado");

      if (d.esPrincipal) {
        await unsetOtrosPrincipales(tx, actual.clienteId, contactoId);
      }

      await tx
        .update(schema.contactos)
        .set({
          nombre: d.nombre,
          cargo: d.cargo,
          email: d.email,
          telefono: d.telefono,
          esPrincipal: d.esPrincipal,
        })
        .where(eq(schema.contactos.id, contactoId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "contacto",
        entidadId: actual.clienteId,
        tipo: "actualizado",
        descripcion: "Contacto actualizado",
        payload: { contactoId, nombre: d.nombre },
        actor,
      });

      return actual.clienteId;
    });

    revalidatePath(`/je-admin/clientes/${clienteId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el contacto." };
  }
}

/** Elimina un contacto. Resuelve el cliente para revalidar su detalle. */
export async function eliminarContacto(id: string): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("clientes", "edit"));

  const contactoId = id; // contactos.id es uuid (string)

  try {
    const clienteId = await db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ clienteId: schema.contactos.clienteId })
        .from(schema.contactos)
        .where(eq(schema.contactos.id, contactoId))
        .limit(1);
      if (!actual) throw new Error("Contacto no encontrado");

      await tx
        .delete(schema.contactos)
        .where(eq(schema.contactos.id, contactoId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "contacto",
        entidadId: actual.clienteId,
        tipo: "eliminado",
        descripcion: "Contacto eliminado",
        payload: { contactoId },
        actor,
      });

      return actual.clienteId;
    });

    revalidatePath(`/je-admin/clientes/${clienteId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el contacto." };
  }
}

/* ──────────────────────────── Cotizaciones (D4) ──────────────────────────── */

const crearCotizacionSchema = z.object({
  clienteId: z.string().uuid("Cliente no válido."),
  oportunidadId: z.string().uuid("Oportunidad no válida.").nullable().optional(),
  capacidadKwp: z.number().nonnegative().nullable().optional(),
  paneles: z.number().int().nonnegative().nullable().optional(),
  inversor: z.string().trim().max(160).nullable().optional(),
  produccionAnualKwh: z.number().nonnegative().nullable().optional(),
  ahorroAnualMxn: z.number().nonnegative().nullable().optional(),
  paybackAnios: z.number().nonnegative().nullable().optional(),
  esquema: z.enum(schema.esquemaCfe.enumValues).nullable().optional(),
});

type CrearCotizacionInput = z.input<typeof crearCotizacionSchema>;

/** numeric -> string|null para columnas nullable. */
function numStrOrNull(v: number | null | undefined): string | null {
  return v == null ? null : String(v);
}

function isUniqueFolioViolation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("cotizaciones_folio_key");
}

/** Genera el folio COT-YYYY-NNNN para el año en curso (NNNN = count+1). */
async function siguienteFolio(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  anio: number,
  offset: number,
): Promise<string> {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.cotizaciones)
    .where(sql`extract(year from ${schema.cotizaciones.createdAt}) = ${anio}`);
  const consecutivo = Number(n) + 1 + offset;
  return `COT-${anio}-${String(consecutivo).padStart(4, "0")}`;
}

/**
 * Crea una cotización borrador (version 1, totales en 0). Hereda el vendedor:
 * si el actor es un rol acotado usa su userId; si no, toma el del cliente.
 * Reintenta el folio ante colisión de unique (cotizaciones_folio_key).
 */
export async function crearCotizacion(
  data: CrearCotizacionInput,
): Promise<ActionResult & { id?: string }> {
  const user = await assertPerm("cotizaciones", "edit");
  const actor = actorOf(user);

  const parsed = crearCotizacionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;
  const anio = new Date().getFullYear();
  const MAX_RETRIES = 5;

  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    try {
      const id = await db.transaction(async (tx) => {
        const [cliente] = await tx
          .select({ vendedorId: schema.clientes.vendedorId })
          .from(schema.clientes)
          .where(eq(schema.clientes.id, d.clienteId))
          .limit(1);
        if (!cliente) throw new Error("Cliente no encontrado");

        const scoped = isScoped((user.rol ?? "") as Parameters<typeof isScoped>[0]);
        const vendedorId = scoped ? user.id : cliente.vendedorId;

        const folio = await siguienteFolio(tx, anio, intento);

        const [cot] = await tx
          .insert(schema.cotizaciones)
          .values({
            clienteId: d.clienteId,
            oportunidadId: d.oportunidadId ?? null,
            vendedorId,
            folio,
            version: 1,
            estado: "borrador",
            subtotal: "0",
            iva: "0",
            total: "0",
            capacidadKwp: numStrOrNull(d.capacidadKwp),
            paneles: d.paneles ?? null,
            inversor: d.inversor ?? null,
            produccionAnualKwh: numStrOrNull(d.produccionAnualKwh),
            ahorroAnualMxn: numStrOrNull(d.ahorroAnualMxn),
            paybackAnios: numStrOrNull(d.paybackAnios),
            esquema: d.esquema ?? null,
          })
          .returning({ id: schema.cotizaciones.id });

        await tx.insert(schema.eventos).values({
          entidadTipo: "cotizacion",
          entidadId: cot.id,
          tipo: "creado",
          descripcion: `Cotización ${folio} creada`,
          payload: { folio, clienteId: d.clienteId },
          actor,
        });

        return cot.id;
      });

      revalidatePath("/je-admin/cotizaciones");
      revalidatePath(`/je-admin/cotizaciones/${id}`);
      revalidatePath(`/je-admin/clientes/${d.clienteId}`);
      return { ok: true, id };
    } catch (error: unknown) {
      if (isUniqueFolioViolation(error) && intento < MAX_RETRIES - 1) {
        continue;
      }
      return { ok: false, error: "No se pudo crear la cotización." };
    }
  }

  return { ok: false, error: "No se pudo asignar un folio único." };
}

const cotizacionItemSchema = z.object({
  equipoId: z.string().uuid("Equipo no válido.").nullable().optional(),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
  cantidad: z.number().nonnegative("La cantidad no puede ser negativa."),
  precioUnitario: z
    .number()
    .nonnegative("El precio no puede ser negativo."),
});

const cotizacionItemsSchema = z
  .array(cotizacionItemSchema)
  .max(200, "Máximo 200 partidas por cotización.");

type CotizacionItemInput = z.input<typeof cotizacionItemSchema>;

/**
 * Reemplaza por completo las partidas de una cotización y recalcula totales.
 * Transacción: borra items previos -> inserta nuevos -> calcula subtotal/iva/
 * total (round2, IVA_RATE) -> persiste totales (como string) + updatedAt.
 */
export async function actualizarCotizacionItems(
  cotizacionId: string,
  items: CotizacionItemInput[],
): Promise<ActionResult & { subtotal?: number; iva?: number; total?: number }> {
  const actor = actorOf(await assertPerm("cotizaciones", "edit"));

  const parsed = cotizacionItemsSchema.safeParse(items);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Partidas no válidas.",
    };
  }
  const lineas = parsed.data;

  try {
    const totales = await db.transaction(async (tx) => {
      await tx
        .delete(schema.cotizacionItems)
        .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));

      if (lineas.length > 0) {
        await tx.insert(schema.cotizacionItems).values(
          lineas.map((item) => ({
            cotizacionId,
            equipoId: item.equipoId ?? null,
            descripcion: item.descripcion,
            cantidad: String(item.cantidad),
            precioUnitario: String(item.precioUnitario),
          })),
        );
      }

      const t = calcularTotales(
        lineas.map((item) => ({
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
      );

      await tx
        .update(schema.cotizaciones)
        .set({
          subtotal: String(t.subtotal),
          iva: String(t.iva),
          total: String(t.total),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cotizaciones.id, cotizacionId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: cotizacionId,
        tipo: "items_actualizados",
        descripcion: `Partidas actualizadas (${lineas.length})`,
        payload: { partidas: lineas.length, ...t, ivaRate: IVA_RATE },
        actor,
      });

      return t;
    });

    revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
    return { ok: true, ...totales };
  } catch {
    return { ok: false, error: "No se pudieron actualizar las partidas." };
  }
}

/** Transiciones de estado permitidas por estado origen. */
const TRANSICIONES_COTIZACION: Record<
  CotizacionEstadoEnum,
  ReadonlySet<CotizacionEstadoEnum>
> = {
  borrador: new Set<CotizacionEstadoEnum>(["enviada"]),
  enviada: new Set<CotizacionEstadoEnum>([
    "aceptada",
    "rechazada",
    "expirada",
  ]),
  aceptada: new Set<CotizacionEstadoEnum>(),
  rechazada: new Set<CotizacionEstadoEnum>(),
  expirada: new Set<CotizacionEstadoEnum>(),
};

/** Fecha (YYYY-MM-DD) a now + dias. */
function fechaMasDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Cambia el estado de una cotización validando la transición. Al enviar fija
 * validaHasta = now + 30 días si está vacío. Estados terminales no admiten
 * salida.
 */
export async function cambiarEstadoCotizacion(
  id: string,
  estado: CotizacionEstadoEnum,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("cotizaciones", "edit"));

  try {
    const resultado = await db.transaction(async (tx) => {
      const [cot] = await tx
        .select({
          estado: schema.cotizaciones.estado,
          validaHasta: schema.cotizaciones.validaHasta,
        })
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, id))
        .limit(1);
      if (!cot) throw new Error("Cotización no encontrada");

      const permitido = TRANSICIONES_COTIZACION[cot.estado];
      if (!permitido.has(estado)) {
        return {
          ok: false as const,
          error: `Transición no permitida: ${cot.estado} → ${estado}.`,
        };
      }

      const update: {
        estado: CotizacionEstadoEnum;
        updatedAt: string;
        validaHasta?: string;
      } = {
        estado,
        updatedAt: new Date().toISOString(),
      };
      if (estado === "enviada" && !cot.validaHasta) {
        update.validaHasta = fechaMasDias(30);
      }

      await tx
        .update(schema.cotizaciones)
        .set(update)
        .where(eq(schema.cotizaciones.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: id,
        tipo: "cambio_estado",
        descripcion: `Estado → ${estado}`,
        payload: { de: cot.estado, a: estado },
        actor,
      });

      return { ok: true as const };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/cotizaciones");
      revalidatePath(`/je-admin/cotizaciones/${id}`);
    }
    return resultado;
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

/**
 * Clona la cabecera de una cotización con version+1 (estado borrador), copia
 * sus partidas y genera folio = `${folioBase}-v${n}`. Devuelve la nueva id.
 */
export async function nuevaVersionCotizacion(
  id: string,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("cotizaciones", "edit"));

  try {
    const nuevaId = await db.transaction(async (tx) => {
      const [orig] = await tx
        .select()
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, id))
        .limit(1);
      if (!orig) throw new Error("Cotización no encontrada");

      const nuevaVersion = orig.version + 1;
      const base = orig.folio ?? `COT-${new Date().getFullYear()}`;
      const nuevoFolio = `${base}-v${nuevaVersion}`;

      const [nueva] = await tx
        .insert(schema.cotizaciones)
        .values({
          oportunidadId: orig.oportunidadId,
          clienteId: orig.clienteId,
          vendedorId: orig.vendedorId,
          folio: nuevoFolio,
          version: nuevaVersion,
          capacidadKwp: orig.capacidadKwp,
          paneles: orig.paneles,
          inversor: orig.inversor,
          subtotal: orig.subtotal,
          iva: orig.iva,
          total: orig.total,
          moneda: orig.moneda,
          produccionAnualKwh: orig.produccionAnualKwh,
          ahorroAnualMxn: orig.ahorroAnualMxn,
          paybackAnios: orig.paybackAnios,
          esquema: orig.esquema,
          estado: "borrador",
        })
        .returning({ id: schema.cotizaciones.id });

      const itemsOrig = await tx
        .select({
          equipoId: schema.cotizacionItems.equipoId,
          descripcion: schema.cotizacionItems.descripcion,
          cantidad: schema.cotizacionItems.cantidad,
          precioUnitario: schema.cotizacionItems.precioUnitario,
        })
        .from(schema.cotizacionItems)
        .where(eq(schema.cotizacionItems.cotizacionId, id));

      if (itemsOrig.length > 0) {
        await tx.insert(schema.cotizacionItems).values(
          itemsOrig.map((item) => ({
            cotizacionId: nueva.id,
            equipoId: item.equipoId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
        );
      }

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: nueva.id,
        tipo: "nueva_version",
        descripcion: `Nueva versión ${nuevoFolio} (desde ${orig.folio ?? id})`,
        payload: { origenId: id, version: nuevaVersion, folio: nuevoFolio },
        actor,
      });

      return nueva.id;
    });

    revalidatePath("/je-admin/cotizaciones");
    revalidatePath(`/je-admin/cotizaciones/${nuevaId}`);
    return { ok: true, id: nuevaId };
  } catch {
    return { ok: false, error: "No se pudo crear la nueva versión." };
  }
}
