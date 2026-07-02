"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, asc, desc, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { assertPerm, actorOf, type SessionUser } from "@/lib/admin/guard";
import {
  isScoped,
  getLeadsPage,
  getCotizacion,
  getCotizacionCalcContext,
  getCatalogoDisponible,
  getProductosPage,
  getPaquetesPage,
  getMejorPaquete,
  segmentoDeTipoPersona,
  getDesviacionesPaquetes,
  getMarcasPage,
  getAreasPage,
  getAreasArbol,
  type AreaArbolRow,
  getCargosPage,
  getCargosActivos,
  type CargosPage,
  type CargosFiltros,
  getEmpresas,
  type EmpresaRow,
  getDocumentosPage,
  type DocumentosPage,
  type DocumentosFiltros,
  getCampanasPage,
  type CampanasPage,
  type CampanasFiltros,
  getDescendientes,
  type AreasPage,
  type AreasFiltros,
  getActividadesPage,
  buscarEntidadesActividad,
  type ActividadesPage,
  type ActividadesFiltros,
  type EntidadOpcion,
  type MarcasPage,
  type MarcasFiltros,
  type DashboardScope,
  type LeadsFiltros,
  type LeadsPage,
  type FetchLeadsInput,
  type ProductosPage,
  type ProductosFiltros,
  type PaquetesPage,
  type PaquetesFiltros,
  type DesviacionLinea,
  type PaqueteOpcion,
  type PaqueteSegmento,
} from "@/lib/admin/queries";
import type { Rol } from "@/lib/admin/rbac";
import { ETAPAS_CERRADAS, PROBABILIDAD_POR_ETAPA } from "@/lib/admin/pipeline";
import { calcularTotales, IVA_RATE } from "@/lib/admin/cotizacion-calc";
import { calcular, type CalcResult } from "@/lib/calc";
import {
  resolveCalcConfig,
  resolveCosteoConstants,
} from "@/lib/calc-config";
import {
  dimensionarCotizacion,
  type DimensionarResult,
} from "@/lib/admin/cotizacion-dimensionado";
import { sendMail } from "@/lib/email";
import { deleteDriveItem } from "@/lib/m365/sharepoint";
import { chatwootConfigurado, listarAgentes, crearAgente } from "@/lib/chatwoot/client";
import { REGISTRO, invalidarConfig, getIntegracion } from "@/lib/config/service";
import { cifrarSecreto, esSecretoCifrado } from "@/lib/config/crypto";
import { listarUsuariosM365, type M365User } from "@/lib/m365/graph-users";
import { serverEnv, clientEnv } from "@/lib/env";
import {
  renderCotizacionPdf,
  type CotizacionPdfData,
} from "@/lib/pdf/cotizacion-pdf";

type LeadEstado = (typeof schema.leadEstado.enumValues)[number];
type OportEtapa = (typeof schema.oportunidadEtapa.enumValues)[number];

export async function updateLeadEstado(id: string, estado: LeadEstado) {
  const user = await assertPerm("leads", "edit");
  if (!(await puedeAccederLead(user, id))) throw new Error(SIN_ACCESO);
  const actor = actorOf(user);
  await db.transaction(async (tx) => {
    const [actual] = await tx
      .select({ estado: schema.leads.estado })
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    if (!actual) throw new Error("Lead no encontrado");

    // Un lead convertido es terminal: solo puede cerrarse como perdido o
    // descartado (no regresa a estados activos; la conversión ya creó el deal).
    if (
      actual.estado === "convertido" &&
      estado !== "perdido" &&
      estado !== "descartado"
    ) {
      throw new Error(
        "Un lead convertido solo puede pasar a perdido o descartado.",
      );
    }

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
  const user = await assertPerm("oportunidades", "edit");
  if (!(await puedeAccederOportunidad(user, id))) throw new Error(SIN_ACCESO);
  const actor = actorOf(user);

  // La probabilidad la define la etapa (modelo de embudo). Las etapas cerradas
  // sellan la fecha de cierre; reabrir la limpia.
  const patch = {
    etapa,
    probabilidad: PROBABILIDAD_POR_ETAPA[etapa],
    cerradaAt: ETAPAS_CERRADAS.has(etapa) ? new Date().toISOString() : null,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.oportunidades)
      .set(patch)
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
  const user = await assertPerm("leads", "edit");
  if (!(await puedeAccederLead(user, id))) throw new Error(SIN_ACCESO);
  const actor = actorOf(user);

  await db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    if (!lead) throw new Error("Lead no encontrado");

    // Candado de idempotencia: no reconvertir. Se valida tanto por el estado
    // como por la existencia real de un cliente generado desde este lead (cubre
    // estados inconsistentes o una segunda llamada concurrente).
    if (lead.estado === "convertido") {
      throw new Error("Este lead ya fue convertido.");
    }
    const [clienteExistente] = await tx
      .select({ id: schema.clientes.id })
      .from(schema.clientes)
      .where(eq(schema.clientes.leadOrigenId, id))
      .limit(1);
    if (clienteExistente) {
      throw new Error("Este lead ya tiene un cliente generado.");
    }

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

/* ─────────────────────────── Compartimentación ─────────────────────────────
 * Defensa en profundidad: los roles "scoped" (vendedor/preventa) solo pueden
 * tocar SUS propios registros. Las listas/detalle ya filtran por scope; estas
 * comprobaciones evitan además que una acción directa (por id) mute el registro
 * de otro asesor. Los roles no scoped (admin, gerente, etc.) pasan siempre.
 * ──────────────────────────────────────────────────────────────────────────*/

const SIN_ACCESO = "No tienes acceso a este registro.";

/**
 * IDs del ámbito de visibilidad del usuario (self + descendientes en la línea
 * de reporte). Usado por los puedeAcceder* para roles scoped (Fase 3). Devuelve
 * [] si no hay id de sesión (fail-closed).
 */
async function ambitoDe(user: SessionUser): Promise<string[]> {
  if (!user.id) return [];
  return [user.id, ...(await getDescendientes(user.id))];
}

/** true si `user` puede acceder al lead (no scoped, o está en su subárbol). */
async function puedeAccederLead(user: SessionUser, leadId: string): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  const [row] = await db
    .select({ vendedorId: schema.leads.vendedorId })
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  const amb = await ambitoDe(user);
  return !!row && row.vendedorId != null && amb.includes(row.vendedorId);
}

/** true si `user` puede acceder al cliente (no scoped, o es su vendedor). */
async function puedeAccederCliente(user: SessionUser, clienteId: string): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  const [row] = await db
    .select({ vendedorId: schema.clientes.vendedorId })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, clienteId))
    .limit(1);
  const amb = await ambitoDe(user);
  return !!row && row.vendedorId != null && amb.includes(row.vendedorId);
}

/** true si `user` puede acceder a la oportunidad (no scoped, o es su vendedor). */
async function puedeAccederOportunidad(user: SessionUser, oportunidadId: string): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  const [row] = await db
    .select({ vendedorId: schema.oportunidades.vendedorId })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.id, oportunidadId))
    .limit(1);
  const amb = await ambitoDe(user);
  return !!row && row.vendedorId != null && amb.includes(row.vendedorId);
}

/** true si `user` puede acceder a la cotización (no scoped, o es su vendedor). */
async function puedeAccederCotizacion(user: SessionUser, cotizacionId: string): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  const [row] = await db
    .select({ vendedorId: schema.cotizaciones.vendedorId })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);
  const amb = await ambitoDe(user);
  return !!row && row.vendedorId != null && amb.includes(row.vendedorId);
}

/** true si `user` puede acceder al proyecto (no scoped, o está en su subárbol). */
async function puedeAccederProyecto(user: SessionUser, proyectoId: string): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  const [row] = await db
    .select({ vendedorId: schema.proyectos.vendedorId })
    .from(schema.proyectos)
    .where(eq(schema.proyectos.id, proyectoId))
    .limit(1);
  const amb = await ambitoDe(user);
  return !!row && row.vendedorId != null && amb.includes(row.vendedorId);
}

/**
 * Comprobación de propiedad por tipo de entidad (documentos/actividades, que
 * referencian leads/clientes/oportunidades/cotizaciones/proyectos). Para tipos
 * sin vendedorId propio (instalacion/contacto) se delega al RBAC (return true).
 */
async function puedeAccederEntidad(
  user: SessionUser,
  tipo: string,
  id: string,
): Promise<boolean> {
  if (!isScoped((user.rol ?? "lectura") as Rol)) return true;
  switch (tipo) {
    case "lead":
      return puedeAccederLead(user, id);
    case "cliente":
      return puedeAccederCliente(user, id);
    case "oportunidad":
      return puedeAccederOportunidad(user, id);
    case "cotizacion":
      return puedeAccederCotizacion(user, id);
    case "proyecto":
      return puedeAccederProyecto(user, id);
    default:
      return true;
  }
}

const rolSchema = z.enum(schema.usuarioRol.enumValues);

/** Campos de organigrama compartidos por alta/edición de usuario. */
const usuarioOrgFields = {
  cargoId: z.string().uuid("Cargo no válido.").nullish().transform((v) => v ?? null),
  reportaA: z.string().uuid("Jefe no válido.").nullish().transform((v) => v ?? null),
  areaId: z.string().uuid("Área no válida.").nullish().transform((v) => v ?? null),
} as const;

/** Resuelve el nombre de un cargo del catálogo (para denormalizar en usuarios.cargo). */
async function resolverCargoNombre(cargoId: string | null): Promise<string | null> {
  if (!cargoId) return null;
  const [c] = await db
    .select({ nombre: schema.cargos.nombre })
    .from(schema.cargos)
    .where(eq(schema.cargos.id, cargoId))
    .limit(1);
  return c?.nombre ?? null;
}

const createUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().trim().toLowerCase().email("Correo no válido."),
  rol: rolSchema,
  telefono: z
    .string()
    .trim()
    .max(40, "Teléfono demasiado largo.")
    .nullish()
    .transform((v) => (v ? v : null)),
  ...usuarioOrgFields,
});

const updateUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  rol: rolSchema,
  telefono: z
    .string()
    .trim()
    .max(40, "Teléfono demasiado largo.")
    .nullish()
    .transform((v) => (v ? v : null)),
  ...usuarioOrgFields,
});

type CreateUsuarioInput = z.input<typeof createUsuarioSchema>;
type UpdateUsuarioInput = z.input<typeof updateUsuarioSchema>;

function isUniqueEmailViolation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("ux_usuarios_email");
}

/** Resuelve la empresa por el dominio del correo; si no hay match, la primera. */
async function empresaPorEmail(email: string): Promise<string | null> {
  const dominio = (email.split("@")[1] ?? "").toLowerCase();
  const [porDom] = await db
    .select({ id: schema.empresas.id })
    .from(schema.empresas)
    .where(sql`lower(${schema.empresas.dominio}) = ${dominio}`)
    .limit(1);
  if (porDom) return porDom.id;
  const [def] = await db
    .select({ id: schema.empresas.id })
    .from(schema.empresas)
    .orderBy(asc(schema.empresas.nombre))
    .limit(1);
  return def?.id ?? null;
}

/**
 * Da de alta a un miembro del equipo (incluye posición en el organigrama:
 * cargo, jefe y área). No fija contraseña: entran por OTP al correo. NO escribe
 * en `eventos` (el enum entidad_tipo no incluye 'usuario').
 */
export async function createUsuario(data: CreateUsuarioInput): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");

  const parsed = createUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;

  const cargoNombre = await resolverCargoNombre(d.cargoId);
  const empresaId = await empresaPorEmail(d.email);
  try {
    await db.insert(schema.usuarios).values({
      nombre: d.nombre,
      email: d.email,
      empresaId,
      rol: d.rol,
      telefono: d.telefono,
      cargo: cargoNombre,
      cargoId: d.cargoId,
      reportaA: d.reportaA,
      areaId: d.areaId,
      activo: true,
    });
  } catch (error: unknown) {
    if (isUniqueEmailViolation(error)) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    return { ok: false, error: "No se pudo crear el usuario." };
  }

  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/organigrama");
  return { ok: true };
}

/** Actualiza nombre, rol, teléfono y organigrama (cargo/jefe/área) de un usuario. */
export async function updateUsuario(
  id: string,
  data: UpdateUsuarioInput,
): Promise<ActionResult> {
  await assertPerm("usuarios", "edit");

  const parsed = updateUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;

  // Anti-ciclos en la línea de reporte: no puede reportar a sí mismo ni a un
  // descendiente suyo.
  if (d.reportaA) {
    if (d.reportaA === id) {
      return { ok: false, error: "Un usuario no puede reportarse a sí mismo." };
    }
    const descendientes = await getDescendientes(id);
    if (descendientes.includes(d.reportaA)) {
      return {
        ok: false,
        error: "No puedes asignar como jefe a alguien que depende de este usuario.",
      };
    }
  }

  const cargoNombre = await resolverCargoNombre(d.cargoId);
  try {
    await db
      .update(schema.usuarios)
      .set({
        nombre: d.nombre,
        rol: d.rol,
        telefono: d.telefono,
        cargo: cargoNombre,
        cargoId: d.cargoId,
        reportaA: d.reportaA,
        areaId: d.areaId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.usuarios.id, id));
  } catch {
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }

  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/organigrama");
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
  const user = await assertPerm("leads", "edit");
  const actor = actorOf(user);

  const parsed = asignarLeadSchema.safeParse({ leadId, vendedorId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  }
  const { leadId: id, vendedorId: vid } = parsed.data;

  // Un asesor scoped solo puede (re)asignar leads que ya son suyos.
  if (!(await puedeAccederLead(user, id))) throw new Error(SIN_ACCESO);

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
  const user = await assertPerm("leads", "edit");
  const actor = actorOf(user);

  const parsed = leadFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  // Un rol scoped (vendedor/preventa) solo puede crear leads a su propio nombre
  // (si no, podría "regalar" un lead a otro asesor o crear uno que no vería).
  if (isScoped((user.rol ?? "lectura") as Rol)) {
    d.vendedorId = user.id;
  }

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
  const user = await assertPerm("leads", "edit");
  if (!(await puedeAccederLead(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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

/**
 * Página de leads del lado del servidor (paginación de la tabla y scroll
 * infinito por columna del kanban). Aplica permiso y scope por rol; devuelve la
 * ventana solicitada + el total que cumple el filtro.
 */
export async function fetchLeads(input: FetchLeadsInput): Promise<LeadsPage> {
  const user = await assertPerm("leads", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: (user.id ?? "") as string,
  };

  const f = input.filtros ?? {};
  const filtros: LeadsFiltros = {
    estado: (f.estado ?? undefined) as LeadsFiltros["estado"],
    canal: (f.canal ?? undefined) as LeadsFiltros["canal"],
    vendedorId: f.vendedorId,
    scoreMin: typeof f.scoreMin === "number" ? f.scoreMin : undefined,
    busqueda: f.busqueda,
    desde: f.desde,
    hasta: f.hasta,
  };

  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getLeadsPage(scope, filtros, { limit, offset });
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
  // Correo del agente en Chatwoot (para invitar/reconciliar). Opcional: si se
  // vincula un usuario y se deja vacío, se usa el correo del usuario.
  email: emailOpcional,
  // Id del agente en Chatwoot: opcional (puede quedar pendiente o vincularse por
  // reconciliación). "" / ausente -> null.
  chatwootAgentId: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
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

/** Valores comunes para INSERT/UPDATE de un asesor (sin campos de sync). */
function asesorValues(d: z.output<typeof asesorSchema>) {
  return {
    usuarioId: d.usuarioId,
    nombre: d.nombre,
    email: d.email,
    chatwootAgentId: d.chatwootAgentId,
    msEmail: d.msEmail,
    telefono: d.telefono,
    zonas: d.zonas,
    segmentos: d.segmentos,
    activo: d.activo,
  };
}

/** Correo efectivo del asesor: el del form o, si falta, el del usuario vinculado. */
async function resolverEmailAsesor(
  email: string | null,
  usuarioId: string | null,
): Promise<string | null> {
  if (email) return email;
  if (!usuarioId) return null;
  const [u] = await db
    .select({ email: schema.usuarios.email })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);
  return u?.email ?? null;
}

/**
 * Registra un asesor. Si Chatwoot está configurado, no se capturó un agente y
 * hay correo, invita al agente en Chatwoot (Application API) y guarda su id +
 * estado. Si no, queda en modo manual/pendiente. Nunca falla el alta por un
 * error de Chatwoot: se guarda con estado 'error' y se puede reintentar.
 */
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
  const d = parsed.data;
  const email = await resolverEmailAsesor(d.email, d.usuarioId);

  let chatwootAgentId = d.chatwootAgentId;
  let chatwootEstado = chatwootAgentId != null ? "activo" : "no_sincronizado";
  let chatwootError: string | null = null;

  // Aprovisionamiento por invitación (solo si hay correo, no hay id previo y
  // Chatwoot está configurado).
  if ((await chatwootConfigurado()) && chatwootAgentId == null && email) {
    const res = await crearAgente({ name: d.nombre, email, role: "agent" });
    if (res.ok && res.data?.id) {
      chatwootAgentId = res.data.id;
      chatwootEstado = "invitado";
    } else {
      chatwootEstado = "error";
      chatwootError = res.ok ? "Respuesta inesperada de Chatwoot." : res.error;
    }
  }

  try {
    await db.insert(schema.asesores).values({
      ...asesorValues(d),
      email,
      chatwootAgentId,
      chatwootEstado,
      chatwootError,
      chatwootSyncAt: chatwootAgentId != null ? new Date().toISOString() : null,
    });
  } catch {
    return { ok: false, error: "No se pudo crear el asesor." };
  }
  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/leads");
  return { ok: true };
}

/** Actualiza los datos de un asesor (no re-invita en Chatwoot; eso va por sync). */
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
  const d = parsed.data;
  const email = await resolverEmailAsesor(d.email, d.usuarioId);
  try {
    await db
      .update(schema.asesores)
      .set({
        ...asesorValues(d),
        email,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.asesores.id, id));
  } catch {
    return { ok: false, error: "No se pudo actualizar el asesor." };
  }
  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/leads");
  return { ok: true };
}

/**
 * Reconciliación con Chatwoot: trae los agentes de la cuenta y enlaza por correo
 * (case-insensitive) los asesores que no tengan chatwoot_agent_id. Evita
 * re-crear agentes que ya existen en el Chatwoot del droplet.
 */
export async function sincronizarAsesoresChatwoot(): Promise<
  ActionResult & { enlazados?: number; sinMatch?: number }
> {
  await assertPerm("usuarios", "edit");
  if (!(await chatwootConfigurado())) {
    return { ok: false, error: "Chatwoot no está configurado." };
  }
  const res = await listarAgentes();
  if (!res.ok) return { ok: false, error: res.error };

  const porEmail = new Map<string, number>();
  for (const a of res.data) {
    if (a.email) porEmail.set(a.email.toLowerCase(), a.id);
  }

  const asesores = await db
    .select({ id: schema.asesores.id, email: schema.asesores.email, agentId: schema.asesores.chatwootAgentId })
    .from(schema.asesores);

  let enlazados = 0;
  let sinMatch = 0;
  for (const a of asesores) {
    if (a.agentId != null) continue; // ya enlazado
    const agentId = a.email ? porEmail.get(a.email.toLowerCase()) : undefined;
    if (agentId == null) {
      sinMatch += 1;
      continue;
    }
    await db
      .update(schema.asesores)
      .set({
        chatwootAgentId: agentId,
        chatwootEstado: "activo",
        chatwootError: null,
        chatwootSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.asesores.id, a.id));
    enlazados += 1;
  }

  revalidatePath("/je-admin/usuarios");
  return { ok: true, enlazados, sinMatch };
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
  const user = await assertPerm("oportunidades", "edit");
  if (!(await puedeAccederOportunidad(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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
  titularCoincide: z
    .boolean()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  municipioId: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Math.trunc(Number(v));
      if (!Number.isInteger(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Municipio no válido.",
        });
        return z.NEVER;
      }
      return n;
    }),
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
  titularCoincide: boolean | null;
  municipioId: number | null;
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
    titularCoincide: d.titularCoincide,
    municipioId: d.municipioId,
    vendedorId: d.vendedorId,
    notas: d.notas,
  };
}

/** Da de alta un cliente. Deja traza en la bitácora (eventos). */
export async function crearCliente(
  data: ClienteInput,
): Promise<ActionResult & { id?: string }> {
  const user = await assertPerm("clientes", "edit");
  const actor = actorOf(user);

  const parsed = clienteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  // Un rol scoped solo crea clientes a su propio nombre (si no, crearía uno que
  // luego no vería, ya que la lista filtra por vendedorId).
  if (isScoped((user.rol ?? "lectura") as Rol)) {
    parsed.data.vendedorId = user.id;
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
  const user = await assertPerm("clientes", "edit");
  if (!(await puedeAccederCliente(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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
  const user = await assertPerm("clientes", "edit");
  if (!(await puedeAccederCliente(user, clienteId))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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
  const user = await assertPerm("clientes", "edit");
  const actor = actorOf(user);

  const parsed = contactoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;
  const contactoId = id; // contactos.id es uuid (string)

  const [c] = await db
    .select({ clienteId: schema.contactos.clienteId })
    .from(schema.contactos)
    .where(eq(schema.contactos.id, contactoId))
    .limit(1);
  if (!c || !(await puedeAccederCliente(user, c.clienteId))) {
    return { ok: false, error: SIN_ACCESO };
  }

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
  const user = await assertPerm("clientes", "edit");
  const actor = actorOf(user);

  const contactoId = id; // contactos.id es uuid (string)

  const [c] = await db
    .select({ clienteId: schema.contactos.clienteId })
    .from(schema.contactos)
    .where(eq(schema.contactos.id, contactoId))
    .limit(1);
  if (!c || !(await puedeAccederCliente(user, c.clienteId))) {
    return { ok: false, error: SIN_ACCESO };
  }

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

type CotizacionTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Si la cotización no tiene oportunidad enlazada, la enlaza a la oportunidad
 * ABIERTA más reciente de su cliente (las cotizaciones representan el deal vivo).
 * No hace nada si ya está enlazada o si el cliente no tiene oportunidad abierta.
 */
async function autoEnlazarOportunidad(
  tx: CotizacionTx,
  cotizacionId: string,
): Promise<void> {
  const [cot] = await tx
    .select({
      oportunidadId: schema.cotizaciones.oportunidadId,
      clienteId: schema.cotizaciones.clienteId,
    })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);
  if (!cot || cot.oportunidadId || !cot.clienteId) return;

  const [abierta] = await tx
    .select({ id: schema.oportunidades.id })
    .from(schema.oportunidades)
    .where(
      and(
        eq(schema.oportunidades.clienteId, cot.clienteId),
        notInArray(schema.oportunidades.etapa, [...ETAPAS_CERRADAS] as OportEtapa[]),
      ),
    )
    .orderBy(desc(schema.oportunidades.createdAt))
    .limit(1);
  if (!abierta) return;

  await tx
    .update(schema.cotizaciones)
    .set({ oportunidadId: abierta.id })
    .where(eq(schema.cotizaciones.id, cotizacionId));
}

/**
 * Refleja el total de la cotización en el monto_estimado de su oportunidad
 * enlazada (el pipeline muestra el valor del deal). Solo requiere total > 0 (no
 * pisa con 0 una cotización vacía). Aplica también a oportunidades ganadas: el
 * monto del deal cerrado debe reflejar el valor de su cotización.
 */
async function sincronizarMontoOportunidad(
  tx: CotizacionTx,
  cotizacionId: string,
): Promise<void> {
  const [cot] = await tx
    .select({
      oportunidadId: schema.cotizaciones.oportunidadId,
      total: schema.cotizaciones.total,
    })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);
  if (!cot?.oportunidadId) return;

  const totalNum = Number(cot.total);
  if (!Number.isFinite(totalNum) || totalNum <= 0) return;

  await tx
    .update(schema.oportunidades)
    .set({ montoEstimado: cot.total })
    .where(eq(schema.oportunidades.id, cot.oportunidadId));
}

/**
 * Refleja el cierre de la cotización en la etapa de su oportunidad enlazada:
 * aceptada → ganada; rechazada/expirada → perdida. No degrada un deal ya GANADO
 * por una cotización rechazada/expirada (un deal puede tener varias cotizaciones).
 */
async function sincronizarEtapaPorEstadoCotizacion(
  tx: CotizacionTx,
  cotizacionId: string,
  estadoCot: CotizacionEstadoEnum,
  actor: string,
): Promise<void> {
  let etapa: OportEtapa | null = null;
  if (estadoCot === "aceptada") etapa = "ganada";
  else if (estadoCot === "rechazada" || estadoCot === "expirada") etapa = "perdida";
  if (!etapa) return;

  const [cot] = await tx
    .select({ oportunidadId: schema.cotizaciones.oportunidadId })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);
  if (!cot?.oportunidadId) return;

  const [op] = await tx
    .select({ etapa: schema.oportunidades.etapa })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.id, cot.oportunidadId))
    .limit(1);
  if (!op || op.etapa === etapa) return;
  // No revertir un deal ya ganado por una cotización rechazada/expirada.
  if (etapa === "perdida" && op.etapa === "ganada") return;

  await tx
    .update(schema.oportunidades)
    .set({
      etapa,
      probabilidad: PROBABILIDAD_POR_ETAPA[etapa],
      cerradaAt: new Date().toISOString(),
      ...(etapa === "perdida"
        ? {
            motivoPerdida:
              estadoCot === "expirada"
                ? "Cotización expirada"
                : "Cotización rechazada",
          }
        : {}),
    })
    .where(eq(schema.oportunidades.id, cot.oportunidadId));

  await tx.insert(schema.eventos).values({
    entidadTipo: "oportunidad",
    entidadId: cot.oportunidadId,
    tipo: "cambio_etapa",
    descripcion: `Etapa → ${etapa} (por cotización ${estadoCot})`,
    payload: { etapa, origen: "cotizacion", estadoCotizacion: estadoCot },
    actor,
  });
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

  if (!(await puedeAccederCliente(user, d.clienteId))) {
    return { ok: false, error: SIN_ACCESO };
  }

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

        // Enlaza a la oportunidad abierta del cliente si no se indicó una.
        if (!d.oportunidadId) await autoEnlazarOportunidad(tx, cot.id);

        return cot.id;
      });

      revalidatePath("/je-admin/cotizaciones");
      revalidatePath(`/je-admin/cotizaciones/${id}`);
      revalidatePath(`/je-admin/clientes/${d.clienteId}`);
      revalidatePath("/je-admin/oportunidades");
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
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, cotizacionId))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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

      // Enlaza (si falta) y refleja el total en el monto de la oportunidad.
      await autoEnlazarOportunidad(tx, cotizacionId);
      await sincronizarMontoOportunidad(tx, cotizacionId);

      return t;
    });

    revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
    revalidatePath("/je-admin/oportunidades");
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
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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

      // Refleja el cierre en la oportunidad: aceptada→ganada, rechazada/expirada→perdida.
      await sincronizarEtapaPorEstadoCotizacion(tx, id, estado, actor);

      return { ok: true as const };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/cotizaciones");
      revalidatePath(`/je-admin/cotizaciones/${id}`);
      revalidatePath("/je-admin/oportunidades");
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
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

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

/** Fecha (YYYY-MM-DD) opcional: vacío / ausente -> null. */
const fechaOpcional = z
  .string()
  .date("Fecha no válida.")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const cotizacionDatosSchema = z.object({
  capacidadKwp: z.number().nonnegative().nullable().optional(),
  paneles: z.number().int().nonnegative().nullable().optional(),
  inversor: z.string().trim().max(160).nullable().optional(),
  produccionAnualKwh: z.number().nonnegative().nullable().optional(),
  ahorroAnualMxn: z.number().nonnegative().nullable().optional(),
  paybackAnios: z.number().nonnegative().nullable().optional(),
  esquema: z.enum(schema.esquemaCfe.enumValues).nullable().optional(),
  moneda: z.string().trim().min(1).max(8).optional(),
  validaHasta: fechaOpcional,
});

type CotizacionDatosInput = z.input<typeof cotizacionDatosSchema>;

/** Estados de cotización que no admiten edición de datos. */
const COTIZACION_ESTADOS_NO_EDITABLES: ReadonlySet<CotizacionEstadoEnum> =
  new Set<CotizacionEstadoEnum>(["aceptada", "rechazada", "expirada"]);

/**
 * Actualiza los datos técnicos/comerciales de la cabecera de una cotización
 * (sistema, esquema, moneda, vigencia). NO toca subtotal/iva/total (eso va por
 * `actualizarCotizacionItems`). Se rechaza en estados terminales. numeric ->
 * String|null. Deja traza en la bitácora.
 */
export async function actualizarCotizacionDatos(
  id: string,
  data: CotizacionDatosInput,
): Promise<ActionResult> {
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

  const parsed = cotizacionDatosSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  try {
    const resultado = await db.transaction(async (tx) => {
      const [cot] = await tx
        .select({ estado: schema.cotizaciones.estado })
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, id))
        .limit(1);
      if (!cot) throw new Error("Cotización no encontrada");

      if (COTIZACION_ESTADOS_NO_EDITABLES.has(cot.estado)) {
        return {
          ok: false as const,
          error: `No se puede editar una cotización en estado ${cot.estado}.`,
        };
      }

      const update: {
        capacidadKwp?: string | null;
        paneles?: number | null;
        inversor?: string | null;
        produccionAnualKwh?: string | null;
        ahorroAnualMxn?: string | null;
        paybackAnios?: string | null;
        esquema?: EsquemaCfe | null;
        moneda?: string;
        validaHasta?: string | null;
        updatedAt: string;
      } = { updatedAt: new Date().toISOString() };

      if (d.capacidadKwp !== undefined) {
        update.capacidadKwp = numStrOrNull(d.capacidadKwp);
      }
      if (d.paneles !== undefined) update.paneles = d.paneles ?? null;
      if (d.inversor !== undefined) update.inversor = d.inversor ?? null;
      if (d.produccionAnualKwh !== undefined) {
        update.produccionAnualKwh = numStrOrNull(d.produccionAnualKwh);
      }
      if (d.ahorroAnualMxn !== undefined) {
        update.ahorroAnualMxn = numStrOrNull(d.ahorroAnualMxn);
      }
      if (d.paybackAnios !== undefined) {
        update.paybackAnios = numStrOrNull(d.paybackAnios);
      }
      if (d.esquema !== undefined) update.esquema = d.esquema ?? null;
      if (d.moneda !== undefined) update.moneda = d.moneda;
      if (d.validaHasta !== undefined) update.validaHasta = d.validaHasta;

      await tx
        .update(schema.cotizaciones)
        .set(update)
        .where(eq(schema.cotizaciones.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: id,
        tipo: "datos_actualizados",
        descripcion: "Datos de la cotización actualizados",
        payload: { ...d },
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
    return { ok: false, error: "No se pudo actualizar la cotización." };
  }
}

/* ──────────────────────── Wizard de dimensionamiento (D4) ────────────────────
 *
 * Dos pasos: `calcularDimensionamiento` produce un PREVIEW (no persiste) y
 * `aplicarDimensionamiento` PERSISTE la propuesta (sistema + partidas + totales).
 * El cálculo reutiliza lib/calc (dimensionamiento), lib/calc-config (constantes/
 * HSP/precio) y lib/admin/cotizacion-dimensionado (itemización/costeo). El
 * contexto técnico se toma de la cotización (cliente + lead origen) y los
 * overrides del input ganan sobre él.
 * ──────────────────────────────────────────────────────────────────────── */

const dimensionarInputSchema = z.object({
  cotizacionId: z.string().uuid(),
  consumoKwhMes: z.number().positive().nullable().optional(),
  reciboMxn: z.number().positive().nullable().optional(),
  capacidadKwpObjetivo: z.number().positive().nullable().optional(),
  tarifa: z.string().trim().max(16).nullable().optional(),
  modelo: z.enum(["A", "B"]).default("A"),
});

type DimensionarInput = z.input<typeof dimensionarInputSchema>;

/**
 * PREVIEW del dimensionamiento (NO persiste). Resuelve el contexto técnico de la
 * cotización y aplica los overrides del input (consumo/recibo/tarifa/capacidad).
 * Si se indica `capacidadKwpObjetivo` arma un CalcResult directamente desde las
 * constantes (sin invertir el modelo de consumo); si no, usa `calcular` con
 * consumo o recibo. Devuelve `preview` con las partidas sugeridas y el sistema.
 */
export async function calcularDimensionamiento(
  input: DimensionarInput,
): Promise<ActionResult & { preview?: DimensionarResult }> {
  const user = await assertPerm("cotizaciones", "edit");

  const parsed = dimensionarInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  // Visibilidad por subárbol: un rol acotado no puede dimensionar una cotización
  // fuera de su ámbito (getCotizacionCalcContext no valida scope).
  if (!(await puedeAccederCotizacion(user, d.cotizacionId))) {
    return { ok: false, error: SIN_ACCESO };
  }

  const ctx = await getCotizacionCalcContext(d.cotizacionId);
  if (!ctx) {
    return { ok: false, error: "Cotización o cliente no encontrado." };
  }

  // Overrides del input ganan sobre el contexto de la cotización.
  const consumoKwhMes = d.consumoKwhMes ?? ctx.consumoKwhMes;
  const reciboMxn = d.reciboMxn ?? ctx.reciboMxn;
  const tarifa = d.tarifa ?? ctx.tarifa;
  const kwpObjetivo = d.capacidadKwpObjetivo ?? null;

  if (
    kwpObjetivo === null &&
    !(consumoKwhMes && consumoKwhMes > 0) &&
    !(reciboMxn && reciboMxn > 0)
  ) {
    return {
      ok: false,
      error: "Falta consumo, recibo o capacidad objetivo para calcular.",
    };
  }

  try {
    const config = await resolveCalcConfig({
      segmento: ctx.segmento,
      municipio: ctx.municipio,
      estado: ctx.estado,
      cp: ctx.cp,
      tarifa,
    });

    let calc: CalcResult;
    if (kwpObjetivo !== null) {
      // Capacidad fijada: derivamos el sistema desde las constantes sin invertir
      // el modelo de consumo. El ahorro solo aplica si hay consumo conocido.
      const { constants, precioKwh, hsp } = config;
      const produccionAnualKwh =
        kwpObjetivo * hsp * 365 * constants.pr;
      const inversionMin = kwpObjetivo * constants.costoKwpMin;
      const inversionMax = kwpObjetivo * constants.costoKwpMax;
      const inversionProm = (inversionMin + inversionMax) / 2;
      const consumoBase =
        consumoKwhMes && consumoKwhMes > 0
          ? consumoKwhMes
          : reciboMxn && reciboMxn > 0
            ? reciboMxn / precioKwh
            : 0;
      const ahorroAnualMxn =
        consumoBase > 0
          ? Math.min(produccionAnualKwh, consumoBase * 12) * precioKwh
          : 0;
      const paybackAnios =
        ahorroAnualMxn > 0 ? inversionProm / ahorroAnualMxn : Infinity;

      calc = {
        consumoKwhMes: consumoBase,
        hsp,
        precioKwh,
        kwp: kwpObjetivo,
        paneles: Math.ceil((kwpObjetivo * 1000) / constants.wpPanel),
        produccionAnualKwh,
        inversionMin,
        inversionMax,
        inversionProm,
        ahorroAnualMxn,
        paybackAnios,
      };
    } else {
      calc = calcular(
        {
          consumoKwhMes: consumoKwhMes ?? undefined,
          reciboMxn: reciboMxn ?? undefined,
          hsp: config.hsp,
          precioKwh: config.precioKwh,
        },
        config.constants,
      );
    }

    const [catalogo, costeo] = await Promise.all([
      getCatalogoDisponible(),
      resolveCosteoConstants(),
    ]);

    const preview = dimensionarCotizacion({
      calc,
      catalogo,
      costeo,
      inversionMinMax: { min: calc.inversionMin, max: calc.inversionMax },
      modelo: d.modelo,
    });

    return { ok: true, preview };
  } catch {
    return { ok: false, error: "No se pudo calcular el dimensionamiento." };
  }
}

const aplicarDimensionamientoSchema = z.object({
  cotizacionId: z.string().uuid(),
  sistema: z.object({
    capacidadKwp: z.number().nonnegative(),
    paneles: z.number().int().nonnegative(),
    inversor: z.string().trim().max(160).nullable(),
    produccionAnualKwh: z.number().nonnegative(),
    ahorroAnualMxn: z.number().nonnegative(),
    paybackAnios: z.number().nonnegative(),
    esquema: z.enum(schema.esquemaCfe.enumValues).nullable(),
    moneda: z.string().trim().min(1).max(8).default("MXN"),
  }),
  partidas: z
    .array(
      z.object({
        equipoId: z.string().uuid().nullable(),
        descripcion: z.string().trim().min(1),
        cantidad: z.number().nonnegative(),
        precioUnitario: z.number().nonnegative(),
      }),
    )
    .max(200),
  modo: z.enum(["reemplazar", "solo_vacio"]).default("reemplazar"),
});

type AplicarDimensionamientoInput = z.input<typeof aplicarDimensionamientoSchema>;

/**
 * PERSISTE el dimensionamiento en una transacción: actualiza la cabecera
 * (sistema/esquema/moneda), reemplaza (o respeta, en modo `solo_vacio`) las
 * partidas, recalcula subtotal/iva/total con `calcularTotales` y deja traza en
 * la bitácora. Se rechaza en estados terminales. Devuelve los totales.
 */
export async function aplicarDimensionamiento(
  input: AplicarDimensionamientoInput,
): Promise<ActionResult & { subtotal?: number; iva?: number; total?: number }> {
  const user = await assertPerm("cotizaciones", "edit");
  const actor = actorOf(user);

  const parsed = aplicarDimensionamientoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const { cotizacionId, sistema, partidas, modo } = parsed.data;

  if (!(await puedeAccederCotizacion(user, cotizacionId))) {
    return { ok: false, error: SIN_ACCESO };
  }

  try {
    const resultado = await db.transaction(async (tx) => {
      const [cot] = await tx
        .select({ estado: schema.cotizaciones.estado })
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, cotizacionId))
        .limit(1);
      if (!cot) throw new Error("Cotización no encontrada");

      if (COTIZACION_ESTADOS_NO_EDITABLES.has(cot.estado)) {
        return {
          ok: false as const,
          error: `No se puede editar una cotización en estado ${cot.estado}.`,
        };
      }

      // Modo solo_vacio: si ya hay partidas, no se tocan.
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.cotizacionItems)
        .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));
      const yaTieneItems = Number(n) > 0;
      const tocarPartidas = !(modo === "solo_vacio" && yaTieneItems);

      let lineasParaTotales: { cantidad: number; precioUnitario: number }[];

      if (tocarPartidas) {
        await tx
          .delete(schema.cotizacionItems)
          .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));

        if (partidas.length > 0) {
          await tx.insert(schema.cotizacionItems).values(
            partidas.map((item) => ({
              cotizacionId,
              equipoId: item.equipoId ?? null,
              descripcion: item.descripcion,
              cantidad: String(item.cantidad),
              precioUnitario: String(item.precioUnitario),
            })),
          );
        }
        lineasParaTotales = partidas.map((item) => ({
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        }));
      } else {
        // Conserva las partidas existentes: recalcula totales desde la BD.
        const existentes = await tx
          .select({
            cantidad: schema.cotizacionItems.cantidad,
            precioUnitario: schema.cotizacionItems.precioUnitario,
          })
          .from(schema.cotizacionItems)
          .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));
        lineasParaTotales = existentes.map((item) => ({
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
        }));
      }

      const t = calcularTotales(lineasParaTotales);

      await tx
        .update(schema.cotizaciones)
        .set({
          capacidadKwp: numStrOrNull(sistema.capacidadKwp),
          paneles: sistema.paneles,
          inversor: sistema.inversor,
          produccionAnualKwh: numStrOrNull(sistema.produccionAnualKwh),
          ahorroAnualMxn: numStrOrNull(sistema.ahorroAnualMxn),
          paybackAnios: numStrOrNull(sistema.paybackAnios),
          esquema: sistema.esquema,
          moneda: sistema.moneda,
          subtotal: String(t.subtotal),
          iva: String(t.iva),
          total: String(t.total),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cotizaciones.id, cotizacionId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: cotizacionId,
        tipo: "dimensionamiento_aplicado",
        descripcion: `Dimensionamiento aplicado (${sistema.capacidadKwp} kWp, ${tocarPartidas ? partidas.length : lineasParaTotales.length} partidas)`,
        payload: {
          capacidadKwp: sistema.capacidadKwp,
          paneles: sistema.paneles,
          partidas: tocarPartidas ? partidas.length : lineasParaTotales.length,
          total: t.total,
          modo,
        },
        actor,
      });

      // Enlaza (si falta) y refleja el total en el monto de la oportunidad.
      await autoEnlazarOportunidad(tx, cotizacionId);
      await sincronizarMontoOportunidad(tx, cotizacionId);

      return { ok: true as const, ...t };
    });

    if (resultado.ok) {
      revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
      revalidatePath("/je-admin/oportunidades");
    }
    return resultado;
  } catch {
    return { ok: false, error: "No se pudo aplicar el dimensionamiento." };
  }
}

/**
 * Enlaza (o desenlaza, con null) una cotización a una oportunidad del mismo
 * cliente y refleja su total en el monto de la oportunidad. Para corregir
 * cotizaciones huérfanas o reasignar el deal desde el detalle.
 */
export async function enlazarCotizacionConOportunidad(
  cotizacionId: string,
  oportunidadId: string | null,
): Promise<ActionResult> {
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, cotizacionId))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

  try {
    const res = await db.transaction(async (tx) => {
      const [cot] = await tx
        .select({ clienteId: schema.cotizaciones.clienteId })
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, cotizacionId))
        .limit(1);
      if (!cot) throw new Error("Cotización no encontrada");

      if (oportunidadId) {
        const [op] = await tx
          .select({ clienteId: schema.oportunidades.clienteId })
          .from(schema.oportunidades)
          .where(eq(schema.oportunidades.id, oportunidadId))
          .limit(1);
        if (!op) return { ok: false as const, error: "La oportunidad no existe." };
        if (op.clienteId !== cot.clienteId) {
          return { ok: false as const, error: "La oportunidad es de otro cliente." };
        }
      }

      await tx
        .update(schema.cotizaciones)
        .set({ oportunidadId })
        .where(eq(schema.cotizaciones.id, cotizacionId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: cotizacionId,
        tipo: "oportunidad_enlazada",
        descripcion: oportunidadId
          ? "Oportunidad enlazada a la cotización"
          : "Oportunidad desenlazada de la cotización",
        payload: { oportunidadId },
        actor,
      });

      if (oportunidadId) await sincronizarMontoOportunidad(tx, cotizacionId);
      return { ok: true as const };
    });

    if (res.ok) {
      revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
      revalidatePath("/je-admin/oportunidades");
    }
    return res;
  } catch {
    return { ok: false, error: "No se pudo enlazar la oportunidad." };
  }
}

/** Scope admin-like para leer una cotización sin acotar por vendedor. */
const SCOPE_ADMIN: DashboardScope = { rol: "admin", userId: "" };

/**
 * Genera el PDF de la cotización y lo envía por correo al cliente (vía
 * sendMail/Microsoft Graph; en dev queda { skipped:true }). Si el cliente no
 * tiene correo se rechaza. Tras un envío exitoso (o skipped en dev), una
 * cotización en 'borrador' transiciona a 'enviada'. Deja traza en la bitácora.
 */
export async function enviarCotizacionPorCorreo(
  id: string,
): Promise<ActionResult & { skipped?: boolean }> {
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, id))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

  const detalle = await getCotizacion(SCOPE_ADMIN, id);
  if (!detalle) {
    return { ok: false, error: "Cotización no encontrada." };
  }

  const { cotizacion: cab, items, cliente } = detalle;
  if (!cliente) {
    return { ok: false, error: "El cliente no tiene correo." };
  }

  // El correo del cliente no viene en el resumen; se consulta directo.
  const [clienteRow] = await db
    .select({
      email: schema.clientes.email,
      nombre: schema.clientes.nombre,
      rfc: schema.clientes.rfc,
    })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, cliente.id))
    .limit(1);

  const email = clienteRow?.email?.trim();
  if (!email) {
    return { ok: false, error: "El cliente no tiene correo." };
  }

  const folio = cab.folio ?? id;
  const moneda = cab.moneda || "MXN";

  const pdfData: CotizacionPdfData = {
    folio,
    version: cab.version,
    fecha: cab.createdAt,
    validaHasta: cab.validaHasta,
    estado: cab.estado,
    moneda,
    cliente: { nombre: clienteRow?.nombre ?? cliente.nombre, rfc: clienteRow?.rfc ?? null },
    sistema: {
      capacidadKwp: cab.capacidadKwp,
      paneles: cab.paneles,
      inversor: cab.inversor,
      produccionAnualKwh: cab.produccionAnualKwh,
      ahorroAnualMxn: cab.ahorroAnualMxn,
      paybackAnios: cab.paybackAnios,
      esquema: cab.esquema,
    },
    items: items.map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      importe: it.cantidad * it.precioUnitario,
    })),
    subtotal: cab.subtotal,
    iva: cab.iva,
    total: cab.total,
  };

  let contentBytes: string;
  try {
    const pdf = await renderCotizacionPdf(pdfData);
    contentBytes = pdf.toString("base64");
  } catch {
    return { ok: false, error: "No se pudo generar el PDF de la cotización." };
  }

  const totalFmt = formatMoneda(cab.total, moneda);
  const html = `
    <p>Estimado(a) ${escapeHtml(clienteRow?.nombre ?? cliente.nombre)}:</p>
    <p>Adjuntamos la cotización <strong>${escapeHtml(folio)}</strong> de JYGASOFT Energy.</p>
    <p>Total: <strong>${escapeHtml(totalFmt)}</strong>${
      cab.validaHasta ? ` · Vigencia hasta ${escapeHtml(cab.validaHasta)}` : ""
    }.</p>
    <p>Quedamos a sus órdenes para cualquier aclaración.</p>
  `.trim();

  const result = await sendMail({
    to: email,
    subject: `Cotización ${folio}`,
    html,
    attachments: [
      {
        name: `Cotizacion-${folio}.pdf`,
        contentType: "application/pdf",
        contentBytes,
      },
    ],
  });

  if (!result.ok) {
    return { ok: false, error: "No se pudo enviar el correo al cliente." };
  }

  try {
    await db.transaction(async (tx) => {
      if (cab.estado === "borrador") {
        await tx
          .update(schema.cotizaciones)
          .set({ estado: "enviada", updatedAt: new Date().toISOString() })
          .where(eq(schema.cotizaciones.id, id));
      }

      await tx.insert(schema.eventos).values({
        entidadTipo: "cotizacion",
        entidadId: id,
        tipo: "enviada_correo",
        descripcion: `Cotización enviada por correo a ${email}`,
        payload: { to: email, skipped: result.skipped ?? false },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo registrar el envío." };
  }

  revalidatePath("/je-admin/cotizaciones");
  revalidatePath(`/je-admin/cotizaciones/${id}`);
  return { ok: true, skipped: result.skipped };
}

/** Formatea un monto con la moneda dada (es-MX); cae a $n.nn si falla. */
function formatMoneda(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda || "MXN",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/** Escapa caracteres con significado en HTML para interpolar texto seguro. */
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isUniqueProyectoFolioViolation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("proyectos_folio_key");
}

/** Genera el folio PRY-YYYY-NNNN para el año en curso (NNNN = count+1+offset). */
async function siguienteFolioProyecto(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  anio: number,
  offset: number,
): Promise<string> {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.proyectos)
    .where(eq(schema.proyectos.anio, anio));
  const consecutivo = Number(n) + 1 + offset;
  return `PRY-${anio}-${String(consecutivo).padStart(4, "0")}`;
}

/**
 * Genera un proyecto a partir de una cotización ACEPTADA (si no, se rechaza).
 * Hereda cliente/oportunidad/vendedor de la cotización; fase inicial
 * 'input_comercial'; precioSinIva = subtotal y totalConIva = total de la
 * cotización. Reintenta el folio ante colisión de unique. Deja traza tanto en
 * el proyecto creado como en la cotización origen.
 */
export async function crearProyectoDeCotizacion(
  cotizacionId: string,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const anio = new Date().getFullYear();
  const MAX_RETRIES = 5;

  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    try {
      const resultado = await db.transaction(async (tx) => {
        const [cot] = await tx
          .select()
          .from(schema.cotizaciones)
          .where(eq(schema.cotizaciones.id, cotizacionId))
          .limit(1);
        if (!cot) throw new Error("Cotización no encontrada");

        if (cot.estado !== "aceptada") {
          return {
            ok: false as const,
            error: "Solo se genera proyecto de una cotización aceptada.",
          };
        }

        const folio = await siguienteFolioProyecto(tx, anio, intento);

        const [proy] = await tx
          .insert(schema.proyectos)
          .values({
            clienteId: cot.clienteId,
            oportunidadId: cot.oportunidadId,
            vendedorId: cot.vendedorId,
            folio,
            anio,
            fase: "input_comercial",
            capacidadKwp: cot.capacidadKwp,
            esquema: cot.esquema,
            precioSinIva: cot.subtotal,
            totalConIva: cot.total,
          })
          .returning({ id: schema.proyectos.id });

        await tx.insert(schema.eventos).values([
          {
            entidadTipo: "proyecto",
            entidadId: proy.id,
            tipo: "creado",
            descripcion: `Proyecto ${folio} generado desde cotización ${cot.folio ?? cotizacionId}`,
            payload: { folio, cotizacionId },
            actor,
          },
          {
            entidadTipo: "cotizacion",
            entidadId: cotizacionId,
            tipo: "proyecto_generado",
            descripcion: `Proyecto ${folio} generado`,
            payload: { proyectoId: proy.id },
            actor,
          },
        ]);

        return { ok: true as const, id: proy.id };
      });

      if (resultado.ok) {
        revalidatePath("/je-admin/proyectos");
        revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
        return { ok: true, id: resultado.id };
      }
      return resultado;
    } catch (error: unknown) {
      if (isUniqueProyectoFolioViolation(error) && intento < MAX_RETRIES - 1) {
        continue;
      }
      return { ok: false, error: "No se pudo generar el proyecto." };
    }
  }

  return { ok: false, error: "No se pudo asignar un folio único." };
}

/* ──────────────── Proyectos / Trámites / Instalación / Materiales / Pagos (D5)
 *
 * Estilo calcado de D4: assertPerm + actorOf, ActionResult, validación Zod con
 * safeParse, transacciones con traza en `eventos`, numeric -> String(n) al
 * persistir. proyecto_materiales.id es bigint -> Number(id) en where. La tabla
 * `eventos` solo admite entidadTipo proyecto/instalacion (entre otros): para
 * trámite/instalación/material/pago se usa entidadTipo "proyecto" con
 * entidadId = proyectoId; un pago sin proyectoId NO genera evento.
 * ──────────────────────────────────────────────────────────────────────── */

type ProyectoFase = (typeof schema.proyectoFase.enumValues)[number];
type TramiteCfeEstado = (typeof schema.tramiteCfeEstado.enumValues)[number];
type InstalacionEstado = (typeof schema.instalacionEstado.enumValues)[number];
type PagoEstado = (typeof schema.pagoEstado.enumValues)[number];
type EsquemaCfe = (typeof schema.esquemaCfe.enumValues)[number];

/** Orden canónico de fases (igual a queries.FASE_ORDER) para validar avances. */
const FASE_ORDER_ACTIONS = schema.proyectoFase.enumValues;

/**
 * Avanza (o retrocede) la fase de un proyecto en UN solo paso del orden
 * canónico; rechaza saltos. Si la nueva fase es 'cierre' sella cierreAt = now.
 * Deja traza en la bitácora (eventos).
 */
export async function avanzarFaseProyecto(
  id: string,
  fase: ProyectoFase,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  try {
    const resultado = await db.transaction(async (tx) => {
      const [proy] = await tx
        .select({ fase: schema.proyectos.fase })
        .from(schema.proyectos)
        .where(eq(schema.proyectos.id, id))
        .limit(1);
      if (!proy) throw new Error("Proyecto no encontrado");

      const desde = FASE_ORDER_ACTIONS.indexOf(proy.fase);
      const hasta = FASE_ORDER_ACTIONS.indexOf(fase);
      if (desde === -1 || hasta === -1 || Math.abs(hasta - desde) !== 1) {
        return {
          ok: false as const,
          error: `Transición de fase no permitida: ${proy.fase} → ${fase}.`,
        };
      }

      const update: { fase: ProyectoFase; updatedAt: string; cierreAt?: string } =
        {
          fase,
          updatedAt: new Date().toISOString(),
        };
      if (fase === "cierre") update.cierreAt = new Date().toISOString();

      await tx
        .update(schema.proyectos)
        .set(update)
        .where(eq(schema.proyectos.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: id,
        tipo: "cambio_fase",
        descripcion: `Fase → ${fase}`,
        payload: { de: proy.fase, a: fase },
        actor,
      });

      return { ok: true as const };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/proyectos");
      revalidatePath(`/je-admin/proyectos/${id}`);
    }
    return resultado;
  } catch {
    return { ok: false, error: "No se pudo cambiar la fase del proyecto." };
  }
}

const tramiteCfeSchema = z.object({
  estado: z.enum(schema.tramiteCfeEstado.enumValues),
  folioCfe: optionalText(60),
  esquema: z
    .enum(schema.esquemaCfe.enumValues)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  estudioRequerido: z.boolean(),
  fechaSolicitud: fechaOpcional,
  fechaOficio: fechaOpcional,
  fechaMedidor: fechaOpcional,
  fechaOperacion: fechaOpcional,
  observaciones: optionalText(2000),
});

type TramiteCfeInput = z.input<typeof tramiteCfeSchema>;

/** Mapea los datos validados del trámite CFE a columnas persistibles. */
function tramiteCfeValuesOf(d: z.output<typeof tramiteCfeSchema>): {
  estado: TramiteCfeEstado;
  folioCfe: string | null;
  esquema: EsquemaCfe | null;
  estudioRequerido: boolean;
  fechaSolicitud: string | null;
  fechaOficio: string | null;
  fechaMedidor: string | null;
  fechaOperacion: string | null;
  observaciones: string | null;
} {
  return {
    estado: d.estado,
    folioCfe: d.folioCfe,
    esquema: d.esquema,
    estudioRequerido: d.estudioRequerido,
    fechaSolicitud: d.fechaSolicitud,
    fechaOficio: d.fechaOficio,
    fechaMedidor: d.fechaMedidor,
    fechaOperacion: d.fechaOperacion,
    observaciones: d.observaciones,
  };
}

/**
 * Crea o actualiza (upsert por proyecto) el trámite CFE de un proyecto: si ya
 * existe uno lo actualiza; si no, inserta. Deja traza en la bitácora.
 */
export async function guardarTramiteCfe(
  proyectoId: string,
  data: TramiteCfeInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const parsed = tramiteCfeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const values = tramiteCfeValuesOf(parsed.data);

  try {
    await db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: schema.tramitesCfe.id })
        .from(schema.tramitesCfe)
        .where(eq(schema.tramitesCfe.proyectoId, proyectoId))
        .limit(1);

      if (existente) {
        await tx
          .update(schema.tramitesCfe)
          .set({ ...values, updatedAt: new Date().toISOString() })
          .where(eq(schema.tramitesCfe.id, existente.id));
      } else {
        await tx
          .insert(schema.tramitesCfe)
          .values({ proyectoId, ...values });
      }

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: proyectoId,
        tipo: "tramite_cfe",
        descripcion: `Trámite CFE → ${values.estado}`,
        payload: { estado: values.estado },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo guardar el trámite CFE." };
  }

  revalidatePath(`/je-admin/proyectos/${proyectoId}`);
  return { ok: true };
}

const instalacionSchema = z.object({
  cuadrillaId: z
    .string()
    .uuid("Cuadrilla no válida.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  estado: z.enum(schema.instalacionEstado.enumValues),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  avancePct: z
    .number()
    .int("El avance debe ser un entero.")
    .min(0, "El avance mínimo es 0.")
    .max(100, "El avance máximo es 100."),
  notas: optionalText(2000),
});

type InstalacionInput = z.input<typeof instalacionSchema>;

/** Mapea los datos validados de la instalación a columnas persistibles. */
function instalacionValuesOf(d: z.output<typeof instalacionSchema>): {
  cuadrillaId: string | null;
  estado: InstalacionEstado;
  fechaInicio: string | null;
  fechaFin: string | null;
  avancePct: number;
  notas: string | null;
} {
  return {
    cuadrillaId: d.cuadrillaId,
    estado: d.estado,
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin,
    avancePct: d.avancePct,
    notas: d.notas,
  };
}

/**
 * Crea o actualiza (upsert por proyecto) la instalación de un proyecto. Deja
 * traza en la bitácora.
 */
export async function guardarInstalacion(
  proyectoId: string,
  data: InstalacionInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const parsed = instalacionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const values = instalacionValuesOf(parsed.data);

  try {
    await db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: schema.instalaciones.id })
        .from(schema.instalaciones)
        .where(eq(schema.instalaciones.proyectoId, proyectoId))
        .limit(1);

      if (existente) {
        await tx
          .update(schema.instalaciones)
          .set({ ...values, updatedAt: new Date().toISOString() })
          .where(eq(schema.instalaciones.id, existente.id));
      } else {
        await tx
          .insert(schema.instalaciones)
          .values({ proyectoId, ...values });
      }

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: proyectoId,
        tipo: "instalacion",
        descripcion: `Instalación → ${values.estado} (${values.avancePct}%)`,
        payload: { estado: values.estado, avancePct: values.avancePct },
        actor,
      });
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la instalación." };
  }

  revalidatePath(`/je-admin/proyectos/${proyectoId}`);
  return { ok: true };
}

const materialSchema = z.object({
  equipoId: z
    .string()
    .uuid("Equipo no válido.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
  cantidad: z.number().nonnegative("La cantidad no puede ser negativa."),
  precioUnitario: z
    .number()
    .nonnegative("El precio no puede ser negativo."),
});

type MaterialInput = z.input<typeof materialSchema>;

/** Resuelve el proyecto dueño de un material (bigint -> Number en where). */
async function getProyectoIdDeMaterial(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  materialId: number,
): Promise<string | null> {
  const [row] = await tx
    .select({ proyectoId: schema.proyectoMateriales.proyectoId })
    .from(schema.proyectoMateriales)
    .where(eq(schema.proyectoMateriales.id, materialId))
    .limit(1);
  return row?.proyectoId ?? null;
}

/**
 * Agrega un material a un proyecto. NO escribe `importe` (no existe en el
 * esquema; se calcula en lectura como cantidad * precioUnitario). Deja traza.
 */
export async function agregarMaterial(
  proyectoId: string,
  data: MaterialInput,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const parsed = materialSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  try {
    const id = await db.transaction(async (tx) => {
      const [material] = await tx
        .insert(schema.proyectoMateriales)
        .values({
          proyectoId,
          equipoId: d.equipoId,
          descripcion: d.descripcion,
          cantidad: String(d.cantidad),
          precioUnitario: String(d.precioUnitario),
        })
        .returning({ id: schema.proyectoMateriales.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: proyectoId,
        tipo: "material_creado",
        descripcion: `Material agregado: ${d.descripcion}`,
        payload: { materialId: String(material.id), descripcion: d.descripcion },
        actor,
      });

      return material.id;
    });

    revalidatePath(`/je-admin/proyectos/${proyectoId}`);
    return { ok: true, id: String(id) };
  } catch {
    return { ok: false, error: "No se pudo agregar el material." };
  }
}

/** Actualiza un material. Resuelve el proyecto para revalidar + traza. */
export async function actualizarMaterial(
  id: string,
  data: MaterialInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const parsed = materialSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;
  const materialId = Number(id); // proyecto_materiales.id es bigint

  try {
    const proyectoId = await db.transaction(async (tx) => {
      const pid = await getProyectoIdDeMaterial(tx, materialId);
      if (!pid) throw new Error("Material no encontrado");

      await tx
        .update(schema.proyectoMateriales)
        .set({
          equipoId: d.equipoId,
          descripcion: d.descripcion,
          cantidad: String(d.cantidad),
          precioUnitario: String(d.precioUnitario),
        })
        .where(eq(schema.proyectoMateriales.id, materialId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: pid,
        tipo: "material_actualizado",
        descripcion: `Material actualizado: ${d.descripcion}`,
        payload: { materialId: String(materialId), descripcion: d.descripcion },
        actor,
      });

      return pid;
    });

    revalidatePath(`/je-admin/proyectos/${proyectoId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el material." };
  }
}

/** Elimina un material. Resuelve el proyecto para revalidar + traza. */
export async function eliminarMaterial(id: string): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const materialId = Number(id); // proyecto_materiales.id es bigint

  try {
    const proyectoId = await db.transaction(async (tx) => {
      const pid = await getProyectoIdDeMaterial(tx, materialId);
      if (!pid) throw new Error("Material no encontrado");

      await tx
        .delete(schema.proyectoMateriales)
        .where(eq(schema.proyectoMateriales.id, materialId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: pid,
        tipo: "material_eliminado",
        descripcion: "Material eliminado",
        payload: { materialId: String(materialId) },
        actor,
      });

      return pid;
    });

    revalidatePath(`/je-admin/proyectos/${proyectoId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el material." };
  }
}

/** Marca un material como entregado / no entregado. */
export async function toggleMaterialEntregado(
  id: string,
  entregado: boolean,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("proyectos", "edit"));

  const materialId = Number(id); // proyecto_materiales.id es bigint

  try {
    const proyectoId = await db.transaction(async (tx) => {
      const pid = await getProyectoIdDeMaterial(tx, materialId);
      if (!pid) throw new Error("Material no encontrado");

      await tx
        .update(schema.proyectoMateriales)
        .set({ entregado })
        .where(eq(schema.proyectoMateriales.id, materialId));

      await tx.insert(schema.eventos).values({
        entidadTipo: "proyecto",
        entidadId: pid,
        tipo: "material_entregado",
        descripcion: entregado
          ? "Material marcado como entregado"
          : "Material marcado como no entregado",
        payload: { materialId: String(materialId), entregado },
        actor,
      });

      return pid;
    });

    revalidatePath(`/je-admin/proyectos/${proyectoId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el material." };
  }
}

/* ──────────────────────────── Pagos (D5) ─────────────────────────────────── */

const pagoSchema = z.object({
  proyectoId: z
    .string()
    .uuid("Proyecto no válido.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  cotizacionId: z
    .string()
    .uuid("Cotización no válida.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  concepto: z.string().trim().min(1, "El concepto es obligatorio."),
  monto: z.number().positive("El monto debe ser mayor a 0."),
  moneda: z.string().trim().min(1).max(8).default("MXN"),
  fechaProgramada: fechaOpcional,
  metodo: optionalText(60),
});

type PagoInput = z.input<typeof pagoSchema>;

/** Estados terminales de un pago (no admiten más transiciones). */
const PAGO_ESTADOS_TERMINALES: ReadonlySet<PagoEstado> = new Set<PagoEstado>([
  "pagado",
  "cancelado",
]);

/** Inserta el evento de un pago SOLO si tiene proyectoId (si no, se omite). */
async function eventoPagoSiProyecto(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  proyectoId: string | null,
  tipo: string,
  descripcion: string,
  payload: Record<string, unknown>,
  actor: string,
): Promise<void> {
  if (!proyectoId) return;
  await tx.insert(schema.eventos).values({
    entidadTipo: "proyecto",
    entidadId: proyectoId,
    tipo,
    descripcion,
    payload,
    actor,
  });
}

/** Hoy en formato YYYY-MM-DD (para fecha_pagada por defecto). */
function hoyFecha(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Crea un pago (estado programado). Evento solo si tiene proyectoId. */
export async function crearPago(
  data: PagoInput,
): Promise<ActionResult & { id?: string }> {
  const actor = actorOf(await assertPerm("pagos", "edit"));

  const parsed = pagoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  try {
    const id = await db.transaction(async (tx) => {
      const [pago] = await tx
        .insert(schema.pagos)
        .values({
          proyectoId: d.proyectoId,
          cotizacionId: d.cotizacionId,
          concepto: d.concepto,
          monto: String(d.monto),
          moneda: d.moneda,
          estado: "programado",
          fechaProgramada: d.fechaProgramada,
          metodo: d.metodo,
        })
        .returning({ id: schema.pagos.id });

      await eventoPagoSiProyecto(
        tx,
        d.proyectoId,
        "pago_creado",
        `Pago programado: ${d.concepto}`,
        { pagoId: pago.id, concepto: d.concepto, monto: d.monto },
        actor,
      );

      return pago.id;
    });

    revalidatePath("/je-admin/pagos");
    if (d.proyectoId) revalidatePath(`/je-admin/proyectos/${d.proyectoId}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo crear el pago." };
  }
}

/** Actualiza datos editables de un pago (no cambia su estado). */
export async function actualizarPago(
  id: string,
  data: PagoInput,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("pagos", "edit"));

  const parsed = pagoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.pagos)
        .set({
          proyectoId: d.proyectoId,
          cotizacionId: d.cotizacionId,
          concepto: d.concepto,
          monto: String(d.monto),
          moneda: d.moneda,
          fechaProgramada: d.fechaProgramada,
          metodo: d.metodo,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.pagos.id, id));

      await eventoPagoSiProyecto(
        tx,
        d.proyectoId,
        "pago_actualizado",
        `Pago actualizado: ${d.concepto}`,
        { pagoId: id, concepto: d.concepto, monto: d.monto },
        actor,
      );
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar el pago." };
  }

  revalidatePath("/je-admin/pagos");
  if (d.proyectoId) revalidatePath(`/je-admin/proyectos/${d.proyectoId}`);
  return { ok: true };
}

/**
 * Marca un pago como pagado. Solo desde programado/vencido (terminales
 * rechazados). fechaPagada por defecto = hoy. Evento solo si tiene proyectoId.
 */
export async function marcarPagoPagado(
  id: string,
  fechaPagada?: string | null,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("pagos", "edit"));

  const parsedFecha = fechaOpcional.safeParse(fechaPagada);
  if (!parsedFecha.success) {
    return { ok: false, error: "Fecha de pago no válida." };
  }

  try {
    const resultado = await db.transaction(async (tx) => {
      const [pago] = await tx
        .select({
          estado: schema.pagos.estado,
          proyectoId: schema.pagos.proyectoId,
        })
        .from(schema.pagos)
        .where(eq(schema.pagos.id, id))
        .limit(1);
      if (!pago) throw new Error("Pago no encontrado");

      if (PAGO_ESTADOS_TERMINALES.has(pago.estado)) {
        return {
          ok: false as const,
          error: `El pago ya está en estado terminal (${pago.estado}).`,
        };
      }

      const fecha = parsedFecha.data ?? hoyFecha();

      await tx
        .update(schema.pagos)
        .set({
          estado: "pagado",
          fechaPagada: fecha,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.pagos.id, id));

      await eventoPagoSiProyecto(
        tx,
        pago.proyectoId,
        "pago_pagado",
        `Pago marcado como pagado (${fecha})`,
        { pagoId: id, fechaPagada: fecha },
        actor,
      );

      return { ok: true as const, proyectoId: pago.proyectoId };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/pagos");
      if (resultado.proyectoId) {
        revalidatePath(`/je-admin/proyectos/${resultado.proyectoId}`);
      }
    }
    return resultado.ok ? { ok: true } : resultado;
  } catch {
    return { ok: false, error: "No se pudo marcar el pago como pagado." };
  }
}

/**
 * Registra el CFDI (UUID) de un pago. No cambia el estado; se rechaza si el
 * pago está cancelado. Evento solo si tiene proyectoId.
 */
export async function registrarCfdiPago(
  id: string,
  cfdiUuid: string,
): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("pagos", "edit"));

  const parsed = z
    .string()
    .trim()
    .min(1, "CFDI no válido.")
    .max(60, "CFDI demasiado largo.")
    .safeParse(cfdiUuid);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "CFDI no válido.",
    };
  }
  const uuid = parsed.data;

  try {
    const resultado = await db.transaction(async (tx) => {
      const [pago] = await tx
        .select({
          estado: schema.pagos.estado,
          proyectoId: schema.pagos.proyectoId,
        })
        .from(schema.pagos)
        .where(eq(schema.pagos.id, id))
        .limit(1);
      if (!pago) throw new Error("Pago no encontrado");

      if (pago.estado === "cancelado") {
        return {
          ok: false as const,
          error: "No se puede registrar CFDI en un pago cancelado.",
        };
      }

      await tx
        .update(schema.pagos)
        .set({ cfdiUuid: uuid, updatedAt: new Date().toISOString() })
        .where(eq(schema.pagos.id, id));

      await eventoPagoSiProyecto(
        tx,
        pago.proyectoId,
        "pago_cfdi",
        "CFDI registrado",
        { pagoId: id, cfdiUuid: uuid },
        actor,
      );

      return { ok: true as const, proyectoId: pago.proyectoId };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/pagos");
      if (resultado.proyectoId) {
        revalidatePath(`/je-admin/proyectos/${resultado.proyectoId}`);
      }
    }
    return resultado.ok ? { ok: true } : resultado;
  } catch {
    return { ok: false, error: "No se pudo registrar el CFDI." };
  }
}

/**
 * Cancela un pago. Solo desde programado/vencido (terminales rechazados).
 * Evento solo si tiene proyectoId.
 */
export async function cancelarPago(id: string): Promise<ActionResult> {
  const actor = actorOf(await assertPerm("pagos", "edit"));

  try {
    const resultado = await db.transaction(async (tx) => {
      const [pago] = await tx
        .select({
          estado: schema.pagos.estado,
          proyectoId: schema.pagos.proyectoId,
        })
        .from(schema.pagos)
        .where(eq(schema.pagos.id, id))
        .limit(1);
      if (!pago) throw new Error("Pago no encontrado");

      if (PAGO_ESTADOS_TERMINALES.has(pago.estado)) {
        return {
          ok: false as const,
          error: `El pago ya está en estado terminal (${pago.estado}).`,
        };
      }

      await tx
        .update(schema.pagos)
        .set({ estado: "cancelado", updatedAt: new Date().toISOString() })
        .where(eq(schema.pagos.id, id));

      await eventoPagoSiProyecto(
        tx,
        pago.proyectoId,
        "pago_cancelado",
        "Pago cancelado",
        { pagoId: id },
        actor,
      );

      return { ok: true as const, proyectoId: pago.proyectoId };
    });

    if (resultado.ok) {
      revalidatePath("/je-admin/pagos");
      if (resultado.proyectoId) {
        revalidatePath(`/je-admin/proyectos/${resultado.proyectoId}`);
      }
    }
    return resultado.ok ? { ok: true } : resultado;
  } catch {
    return { ok: false, error: "No se pudo cancelar el pago." };
  }
}

/* ──────────────── Cliente 360°: oportunidades / documentos / actividades ─────
 *
 * Acciones que completan el detalle del cliente (D4). Estilo calcado: assertPerm
 * + actorOf, ActionResult, validación Zod con safeParse, transacciones con traza
 * en `eventos`. La tabla `actividades.id` es bigint -> Number(id) en where,
 * String(id) al exponer; `documentos.id` es uuid. La subida real de archivos va
 * por una ruta aparte; aquí solo se registra el documento por URL.
 * ──────────────────────────────────────────────────────────────────────────── */

type EntidadTipo = (typeof schema.entidadTipo.enumValues)[number];
type DocumentoTipo = (typeof schema.documentoTipo.enumValues)[number];
type ActividadTipo = (typeof schema.actividadTipo.enumValues)[number];

const crearOportunidadDeClienteSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  etapa: z.enum(schema.oportunidadEtapa.enumValues).optional(),
  capacidadKwp: z.number().nonnegative().nullable().optional(),
  montoEstimado: z.number().nonnegative().nullable().optional(),
  fechaCierreEstimada: fechaOpcional,
});

type CrearOportunidadDeClienteInput = z.input<
  typeof crearOportunidadDeClienteSchema
>;

/**
 * Crea una oportunidad asociada a un cliente. La probabilidad la define la etapa
 * (modelo de embudo). El vendedor se hereda: rol acotado -> su userId; si no, el
 * vendedor del cliente. Deja traza en la bitácora (oportunidad + cliente).
 */
export async function crearOportunidadDeCliente(
  clienteId: string,
  data: CrearOportunidadDeClienteInput,
): Promise<ActionResult & { id?: string }> {
  const user = await assertPerm("oportunidades", "edit");
  if (!(await puedeAccederCliente(user, clienteId))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

  const parsed = crearOportunidadDeClienteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;
  const etapa: OportEtapa = d.etapa ?? "calificacion";
  const probabilidad = PROBABILIDAD_POR_ETAPA[etapa];

  try {
    const id = await db.transaction(async (tx) => {
      const [cliente] = await tx
        .select({ vendedorId: schema.clientes.vendedorId })
        .from(schema.clientes)
        .where(eq(schema.clientes.id, clienteId))
        .limit(1);
      if (!cliente) throw new Error("Cliente no encontrado");

      const scoped = isScoped((user.rol ?? "") as Parameters<typeof isScoped>[0]);
      const vendedorId = scoped ? user.id : cliente.vendedorId;

      const [oport] = await tx
        .insert(schema.oportunidades)
        .values({
          clienteId,
          vendedorId,
          nombre: d.nombre,
          etapa,
          probabilidad,
          capacidadKwp:
            d.capacidadKwp == null ? null : String(d.capacidadKwp),
          montoEstimado:
            d.montoEstimado == null ? null : String(d.montoEstimado),
          fechaCierreEstimada: d.fechaCierreEstimada,
        })
        .returning({ id: schema.oportunidades.id });

      await tx.insert(schema.eventos).values([
        {
          entidadTipo: "oportunidad",
          entidadId: oport.id,
          tipo: "creado",
          descripcion: `Oportunidad ${d.nombre} creada`,
          payload: { clienteId, etapa },
          actor,
        },
        {
          entidadTipo: "cliente",
          entidadId: clienteId,
          tipo: "oportunidad_creada",
          descripcion: `Oportunidad ${d.nombre} creada`,
          payload: { oportunidadId: oport.id, etapa },
          actor,
        },
      ]);

      return oport.id;
    });

    revalidatePath("/je-admin/oportunidades");
    revalidatePath(`/je-admin/clientes/${clienteId}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo crear la oportunidad." };
  }
}

const registrarDocumentoSchema = z.object({
  entidadTipo: z.enum(schema.entidadTipo.enumValues),
  entidadId: z.string().uuid("Entidad no válida."),
  tipo: z.enum(schema.documentoTipo.enumValues).default("otro"),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(200, "Nombre demasiado largo."),
  url: z.string().url("URL no válida.").max(2000, "URL demasiado larga."),
});

type RegistrarDocumentoInput = z.input<typeof registrarDocumentoSchema>;

/**
 * Registra un documento (alta por URL) sobre una entidad. La subida real del
 * archivo va por una ruta aparte; aquí solo se persiste el registro y se deja
 * traza. `subidoPor` = usuario actual.
 */
/**
 * Página del listado global de documentos con scope por rol (server-side).
 * Roles acotados solo ven documentos de entidades de su subárbol.
 */
export async function fetchDocumentos(input: {
  filtros?: DocumentosFiltros;
  limit: number;
  offset: number;
}): Promise<DocumentosPage> {
  const user = await assertPerm("documentos", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getDocumentosPage(scope, input.filtros ?? {}, { limit, offset });
}

export async function registrarDocumento(
  data: RegistrarDocumentoInput,
): Promise<ActionResult & { id?: string }> {
  const user = await assertPerm("documentos", "edit");
  const actor = actorOf(user);

  const parsed = registrarDocumentoSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  if (!(await puedeAccederEntidad(user, d.entidadTipo, d.entidadId))) {
    return { ok: false, error: SIN_ACCESO };
  }

  try {
    const id = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.documentos)
        .values({
          entidadTipo: d.entidadTipo,
          entidadId: d.entidadId,
          tipo: d.tipo,
          nombre: d.nombre,
          url: d.url,
          subidoPor: user.id ?? null,
        })
        .returning({ id: schema.documentos.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: d.entidadTipo,
        entidadId: d.entidadId,
        tipo: "documento_registrado",
        descripcion: `Documento registrado: ${d.nombre}`,
        payload: { documentoId: doc.id, tipo: d.tipo, nombre: d.nombre },
        actor,
      });

      return doc.id;
    });

    revalidatePath(`/je-admin/${d.entidadTipo}s/${d.entidadId}`);
    revalidatePath("/je-admin/documentos");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo registrar el documento." };
  }
}

/** Elimina un documento. Resuelve su entidad para revalidar + traza. */
export async function eliminarDocumento(id: string): Promise<ActionResult> {
  const user = await assertPerm("documentos", "edit");
  const actor = actorOf(user);

  const documentoId = id; // documentos.id es uuid (string)

  const [d] = await db
    .select({
      t: schema.documentos.entidadTipo,
      e: schema.documentos.entidadId,
    })
    .from(schema.documentos)
    .where(eq(schema.documentos.id, documentoId))
    .limit(1);
  if (!d || !(await puedeAccederEntidad(user, d.t, d.e))) {
    return { ok: false, error: SIN_ACCESO };
  }

  try {
    const entidad = await db.transaction(async (tx) => {
      const [doc] = await tx
        .select({
          entidadTipo: schema.documentos.entidadTipo,
          entidadId: schema.documentos.entidadId,
        })
        .from(schema.documentos)
        .where(eq(schema.documentos.id, documentoId))
        .limit(1);
      if (!doc) throw new Error("Documento no encontrado");

      await tx
        .delete(schema.documentos)
        .where(eq(schema.documentos.id, documentoId));

      await tx.insert(schema.eventos).values({
        entidadTipo: doc.entidadTipo,
        entidadId: doc.entidadId,
        tipo: "documento_eliminado",
        descripcion: "Documento eliminado",
        payload: { documentoId },
        actor,
      });

      return doc;
    });

    revalidatePath(`/je-admin/clientes/${entidad.entidadId}`);
    revalidatePath("/je-admin/documentos");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el documento." };
  }
}

/** ISO datetime (acepta date o datetime); vacío / ausente -> null. */
const venceAtOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fecha de vencimiento no válida.",
      });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

/** Campos editables comunes a alta y edición de actividad. */
const actividadCamposSchema = {
  tipo: z.enum(schema.actividadTipo.enumValues),
  titulo: z
    .string()
    .trim()
    .min(2, "El título debe tener al menos 2 caracteres.")
    .max(200, "Título demasiado largo."),
  descripcion: optionalText(2000),
  prioridad: z.enum(schema.actividadPrioridad.enumValues).default("media"),
  asignadoA: z
    .string()
    .uuid("Asignado no válido.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  venceAt: venceAtOpcional,
} as const;

const crearActividadSchema = z.object({
  entidadTipo: z.enum(schema.entidadTipo.enumValues),
  entidadId: z.string().uuid("Entidad no válida."),
  ...actividadCamposSchema,
});

const actualizarActividadSchema = z.object(actividadCamposSchema);

type CrearActividadInput = z.input<typeof crearActividadSchema>;
type ActualizarActividadInput = z.input<typeof actualizarActividadSchema>;

const ACTIVIDADES_PATH = "/je-admin/actividades";

/**
 * Mapa entidadTipo -> segmento de ruta del back-office, para revalidar la ficha
 * dueña de la actividad. Los tipos sin detalle propio (contacto, instalacion)
 * devuelven null y no se revalidan.
 */
const SEGMENTO_ENTIDAD: Partial<Record<string, string>> = {
  lead: "leads",
  cliente: "clientes",
  oportunidad: "oportunidades",
  cotizacion: "cotizaciones",
  proyecto: "proyectos",
};

/** Revalida la ficha de la entidad dueña de la actividad (si tiene ruta). */
function revalidarEntidad(tipo: string | null, id: string | null): void {
  if (!tipo || !id) return;
  const seg = SEGMENTO_ENTIDAD[tipo];
  if (seg) revalidatePath(`/je-admin/${seg}/${id}`);
}

const ASIGNACION_NO_PERMITIDA =
  "Solo puedes asignar esta actividad a ti mismo o a alguien de tu equipo.";

/**
 * Regla de asignación de actividades POR JERARQUÍA (Fase 2):
 *  - "Sin asignar" (null) siempre permitido.
 *  - a sí mismo: siempre permitido.
 *  - admin: a cualquiera (es global).
 *  - resto de roles: solo a sus descendientes en la línea de reporte (subárbol).
 * Los casos baratos (null / self / admin) cortocircuitan antes de tocar la BD;
 * solo se consulta el subárbol al asignar a un tercero. Se valida en el servidor
 * aunque la UI ya acote la lista (defensa en profundidad).
 */
async function puedeAsignarActividad(
  user: SessionUser,
  asignadoA: string | null,
): Promise<boolean> {
  if (asignadoA == null) return true; // sin asignar
  if (!user.id) return false; // sesión sin id -> fail-closed
  if (asignadoA === user.id) return true; // a sí mismo
  if (user.rol === "admin") return true; // global
  // Resto: el destino debe estar en su subárbol Y activo (coherente con
  // getUsuariosAsignables, que solo ofrece activos).
  const descendientes = await getDescendientes(user.id);
  if (!descendientes.includes(asignadoA)) return false;
  const [u] = await db
    .select({ activo: schema.usuarios.activo })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, asignadoA))
    .limit(1);
  return !!u && u.activo;
}

/**
 * Crea una actividad sobre una entidad. `createdBy` = usuario actual. Deja traza
 * en la bitácora del cliente. `actividades.id` es bigint -> String(id) al
 * exponer.
 */
export async function crearActividad(
  data: CrearActividadInput,
): Promise<ActionResult & { id?: string }> {
  const user = await assertPerm("actividades", "edit");
  const actor = actorOf(user);

  const parsed = crearActividadSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  if (!(await puedeAccederEntidad(user, d.entidadTipo, d.entidadId))) {
    return { ok: false, error: SIN_ACCESO };
  }

  if (!(await puedeAsignarActividad(user, d.asignadoA))) {
    return { ok: false, error: ASIGNACION_NO_PERMITIDA };
  }

  try {
    const id = await db.transaction(async (tx) => {
      const [actividad] = await tx
        .insert(schema.actividades)
        .values({
          entidadTipo: d.entidadTipo,
          entidadId: d.entidadId,
          tipo: d.tipo,
          titulo: d.titulo,
          descripcion: d.descripcion,
          prioridad: d.prioridad,
          asignadoA: d.asignadoA,
          venceAt: d.venceAt,
          createdBy: user.id ?? null,
        })
        .returning({ id: schema.actividades.id });

      await tx.insert(schema.eventos).values({
        entidadTipo: d.entidadTipo,
        entidadId: d.entidadId,
        tipo: "actividad_creada",
        descripcion: `Actividad creada: ${d.titulo}`,
        payload: { actividadId: String(actividad.id), titulo: d.titulo },
        actor,
      });

      return actividad.id;
    });

    revalidarEntidad(d.entidadTipo, d.entidadId);
    revalidatePath(ACTIVIDADES_PATH);
    return { ok: true, id: String(id) };
  } catch {
    return { ok: false, error: "No se pudo crear la actividad." };
  }
}

/**
 * Marca una actividad como completada / pendiente. Resuelve la entidad para
 * revalidar + traza. `actividades.id` es bigint -> Number(id) en where.
 */
export async function completarActividad(
  id: string,
  completada: boolean,
): Promise<ActionResult> {
  const user = await assertPerm("actividades", "edit");
  const actor = actorOf(user);

  const actividadId = Number(id); // actividades.id es bigint

  const [a] = await db
    .select({
      entidadTipo: schema.actividades.entidadTipo,
      entidadId: schema.actividades.entidadId,
    })
    .from(schema.actividades)
    .where(eq(schema.actividades.id, actividadId))
    .limit(1);
  if (!a) {
    return { ok: false, error: SIN_ACCESO };
  }
  if (
    a.entidadTipo &&
    a.entidadId &&
    !(await puedeAccederEntidad(user, a.entidadTipo, a.entidadId))
  ) {
    return { ok: false, error: SIN_ACCESO };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.actividades)
        .set({
          estado: completada ? "completada" : "pendiente",
          completadoAt: completada ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.actividades.id, actividadId));

      if (a.entidadTipo && a.entidadId) {
        await tx.insert(schema.eventos).values({
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          tipo: "actividad_completada",
          descripcion: completada
            ? "Actividad completada"
            : "Actividad reabierta",
          payload: { actividadId: String(actividadId), completada },
          actor,
        });
      }
    });

    revalidarEntidad(a.entidadTipo, a.entidadId);
    revalidatePath(ACTIVIDADES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la actividad." };
  }
}

/**
 * Edita los campos de una actividad (tipo, título, descripción, prioridad,
 * asignado, vencimiento). La entidad asociada es inmutable. Valida permiso +
 * acceso a la entidad dueña; deja traza y revalida.
 */
export async function actualizarActividad(
  id: string,
  data: ActualizarActividadInput,
): Promise<ActionResult> {
  const user = await assertPerm("actividades", "edit");
  const actor = actorOf(user);
  const actividadId = Number(id);

  const parsed = actualizarActividadSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }
  const d = parsed.data;

  const [a] = await db
    .select({
      entidadTipo: schema.actividades.entidadTipo,
      entidadId: schema.actividades.entidadId,
      asignadoA: schema.actividades.asignadoA,
    })
    .from(schema.actividades)
    .where(eq(schema.actividades.id, actividadId))
    .limit(1);
  if (!a) return { ok: false, error: SIN_ACCESO };
  if (
    a.entidadTipo &&
    a.entidadId &&
    !(await puedeAccederEntidad(user, a.entidadTipo, a.entidadId))
  ) {
    return { ok: false, error: SIN_ACCESO };
  }

  // La regla de jerarquía solo aplica si el responsable CAMBIA: editar título o
  // fecha de una actividad ya asignada a un tercero no debe bloquearse. Nota: no
  // se re-sanea retroactivamente un asignadoA previo fuera de subárbol (p. ej.
  // dejado por un admin); la invariante se garantiza en la asignación, no aquí.
  if (
    d.asignadoA !== a.asignadoA &&
    !(await puedeAsignarActividad(user, d.asignadoA))
  ) {
    return { ok: false, error: ASIGNACION_NO_PERMITIDA };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.actividades)
        .set({
          tipo: d.tipo,
          titulo: d.titulo,
          descripcion: d.descripcion,
          prioridad: d.prioridad,
          asignadoA: d.asignadoA,
          venceAt: d.venceAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.actividades.id, actividadId));

      if (a.entidadTipo && a.entidadId) {
        await tx.insert(schema.eventos).values({
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          tipo: "actividad_actualizada",
          descripcion: `Actividad actualizada: ${d.titulo}`,
          payload: { actividadId: String(actividadId), titulo: d.titulo },
          actor,
        });
      }
    });

    revalidarEntidad(a.entidadTipo, a.entidadId);
    revalidatePath(ACTIVIDADES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la actividad." };
  }
}

/**
 * Cancela / reactiva una actividad (estado 'cancelada' <-> 'pendiente'). Cancelar
 * es la baja "suave": conserva la traza sin borrar el registro.
 */
export async function cancelarActividad(
  id: string,
  cancelada: boolean,
): Promise<ActionResult> {
  const user = await assertPerm("actividades", "edit");
  const actor = actorOf(user);
  const actividadId = Number(id);

  const [a] = await db
    .select({
      entidadTipo: schema.actividades.entidadTipo,
      entidadId: schema.actividades.entidadId,
    })
    .from(schema.actividades)
    .where(eq(schema.actividades.id, actividadId))
    .limit(1);
  if (!a) return { ok: false, error: SIN_ACCESO };
  if (
    a.entidadTipo &&
    a.entidadId &&
    !(await puedeAccederEntidad(user, a.entidadTipo, a.entidadId))
  ) {
    return { ok: false, error: SIN_ACCESO };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.actividades)
        .set({
          estado: cancelada ? "cancelada" : "pendiente",
          completadoAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.actividades.id, actividadId));

      if (a.entidadTipo && a.entidadId) {
        await tx.insert(schema.eventos).values({
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          tipo: "actividad_cancelada",
          descripcion: cancelada
            ? "Actividad cancelada"
            : "Actividad reactivada",
          payload: { actividadId: String(actividadId), cancelada },
          actor,
        });
      }
    });

    revalidarEntidad(a.entidadTipo, a.entidadId);
    revalidatePath(ACTIVIDADES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cancelar la actividad." };
  }
}

/**
 * Elimina una actividad de forma permanente. Solo admin. Deja traza del borrado
 * en la bitácora de la entidad dueña.
 */
export async function eliminarActividad(id: string): Promise<ActionResult> {
  const user = await assertPerm("actividades", "edit");
  if (user.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede eliminar actividades." };
  }
  const actor = actorOf(user);
  const actividadId = Number(id);

  const [a] = await db
    .select({
      entidadTipo: schema.actividades.entidadTipo,
      entidadId: schema.actividades.entidadId,
      titulo: schema.actividades.titulo,
    })
    .from(schema.actividades)
    .where(eq(schema.actividades.id, actividadId))
    .limit(1);
  if (!a) return { ok: false, error: "La actividad no existe." };

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.actividades)
        .where(eq(schema.actividades.id, actividadId));

      if (a.entidadTipo && a.entidadId) {
        await tx.insert(schema.eventos).values({
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          tipo: "actividad_eliminada",
          descripcion: `Actividad eliminada: ${a.titulo}`,
          payload: { titulo: a.titulo },
          actor,
        });
      }
    });

    revalidarEntidad(a.entidadTipo, a.entidadId);
    revalidatePath(ACTIVIDADES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la actividad." };
  }
}

/**
 * Página de la agenda global con scope por rol (server-side). El scope se arma
 * desde la sesión: los roles acotados solo ven sus actividades.
 */
export async function fetchActividades(input: {
  filtros?: ActividadesFiltros;
  limit: number;
  offset: number;
}): Promise<ActividadesPage> {
  const user = await assertPerm("actividades", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getActividadesPage(scope, input.filtros ?? {}, { limit, offset });
}

/**
 * Autocompletado de entidades para asociar una actividad (alta desde la agenda
 * global). Respeta el scope del rol.
 */
export async function buscarEntidadActividad(
  tipo: string,
  q: string,
): Promise<EntidadOpcion[]> {
  const user = await assertPerm("actividades", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };
  return buscarEntidadesActividad(scope, tipo, q, 10);
}

/**
 * Elimina un cliente. Solo admin. Se bloquea si tiene relaciones comerciales
 * (proyectos / cotizaciones / oportunidades). Los contactos caen por cascade.
 */
export async function eliminarCliente(id: string): Promise<ActionResult> {
  const user = await assertPerm("clientes", "edit");
  if (user.rol !== "admin") {
    return {
      ok: false,
      error: "Solo un administrador puede eliminar clientes.",
    };
  }
  const actor = actorOf(user);

  try {
    const resultado = await db.transaction(async (tx) => {
      const [{ relaciones }] = await tx
        .select({
          relaciones: sql<number>`(
            (SELECT count(*) FROM proyectos WHERE cliente_id = ${id})
          + (SELECT count(*) FROM cotizaciones WHERE cliente_id = ${id})
          + (SELECT count(*) FROM oportunidades WHERE cliente_id = ${id})
          )::int`,
        })
        .from(sql`(select 1) as x`);

      if (Number(relaciones) > 0) {
        return {
          ok: false as const,
          error:
            "No se puede eliminar: tiene relaciones (proyectos/cotizaciones/oportunidades).",
        };
      }

      await tx.delete(schema.clientes).where(eq(schema.clientes.id, id));

      await tx.insert(schema.eventos).values({
        entidadTipo: "cliente",
        entidadId: id,
        tipo: "eliminado",
        descripcion: "Cliente eliminado",
        payload: {},
        actor,
      });

      return { ok: true as const };
    });

    if (resultado.ok) revalidatePath("/je-admin/clientes");
    return resultado;
  } catch {
    return { ok: false, error: "No se pudo eliminar el cliente." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * PRODUCTOS (catálogo unificado) — mutaciones
 *
 * producto_tipos: catálogo de tipos editable. No se puede borrar un tipo con
 * productos asociados (sugerir desactivar). productos: CRUD con atributos JSON.
 * Permiso: módulo "productos" (edit = OPS). Borrado duro: solo admin.
 * ───────────────────────────────────────────────────────────────────────── */

const PRODUCTOS_PATH = "/je-admin/productos";

/** "" o solo-espacios → null; recorta el resto. Para columnas de texto opcional. */
function txtOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** numeric (Postgres) se persiste como string o null. */
function numParaDb(v: number | null | undefined): string | null {
  return v == null ? null : String(v);
}

/** Página de productos para la tabla cliente (filtros + paginación server-side). */
export async function fetchProductos(input: {
  filtros?: ProductosFiltros;
  limit: number;
  offset: number;
}): Promise<ProductosPage> {
  await assertPerm("productos", "view");
  const f = input.filtros ?? {};
  const filtros: ProductosFiltros = {
    productoTipoId: f.productoTipoId ?? undefined,
    busqueda: f.busqueda,
    soloActivos: f.soloActivos,
  };
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getProductosPage(filtros, { limit, offset });
}

// ── Tipos de producto ──────────────────────────────────────────────────────

const productoTipoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "El nombre es demasiado largo."),
  clave: z
    .string()
    .trim()
    .min(1, "La clave es obligatoria.")
    .max(60, "La clave es demasiado larga.")
    .regex(
      /^[a-z0-9_]+$/,
      "La clave solo admite minúsculas, números y guion bajo.",
    ),
  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción es demasiado larga.")
    .nullable()
    .optional(),
  activo: z.boolean().optional(),
});

function productoTipoValues(data: z.output<typeof productoTipoSchema>) {
  return {
    nombre: data.nombre,
    clave: data.clave,
    descripcion: txtOrNull(data.descripcion),
    activo: data.activo ?? true,
  };
}

/** Traduce errores de unicidad (nombre/clave) a un mensaje claro. */
function mensajeTipoConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("producto_tipos_clave_key")) return "Ya existe un tipo con esa clave.";
  if (msg.includes("producto_tipos_nombre_key")) return "Ya existe un tipo con ese nombre.";
  return "No se pudo guardar el tipo de producto.";
}

export async function crearProductoTipo(
  data: z.input<typeof productoTipoSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("productos", "edit");
  const parsed = productoTipoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    const [row] = await db
      .insert(schema.productoTipos)
      .values(productoTipoValues(parsed.data))
      .returning({ id: schema.productoTipos.id });
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajeTipoConflicto(e) };
  }
}

export async function actualizarProductoTipo(
  id: string,
  data: z.input<typeof productoTipoSchema>,
): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  const parsed = productoTipoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    await db
      .update(schema.productoTipos)
      .set({ ...productoTipoValues(parsed.data), updatedAt: new Date().toISOString() })
      .where(eq(schema.productoTipos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeTipoConflicto(e) };
  }
}

/** Activa/desactiva un tipo (inactivo = no ofrecible al crear productos). */
export async function toggleProductoTipoActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  try {
    await db
      .update(schema.productoTipos)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.productoTipos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del tipo." };
  }
}

/** Borra un tipo solo si no tiene productos asociados (si los tiene, desactivar). */
export async function eliminarProductoTipo(id: string): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  try {
    const [{ enUso }] = await db
      .select({
        enUso: sql<number>`(SELECT count(*) FROM productos WHERE producto_tipo_id = ${id})::int`,
      })
      .from(sql`(select 1) as x`);

    if (Number(enUso) > 0) {
      return {
        ok: false,
        error: "No se puede eliminar: el tipo tiene productos. Desactívalo en su lugar.",
      };
    }

    await db.delete(schema.productoTipos).where(eq(schema.productoTipos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el tipo de producto." };
  }
}

// ── Productos ────────────────────────────────────────────────────────────────

const productoSchema = z.object({
  productoTipoId: z.string().uuid("Selecciona un tipo de producto válido."),
  sku: z.string().trim().max(80, "El SKU es demasiado largo.").nullable().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(200, "El nombre es demasiado largo."),
  marca: z.string().trim().max(120).nullable().optional(),
  marcaId: z.string().uuid("Marca no válida.").nullable().optional(),
  modelo: z.string().trim().max(120).nullable().optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  unidad: z.string().trim().min(1).max(40).optional(),
  precioCompra: z
    .number()
    .nonnegative("El precio de compra no puede ser negativo.")
    .nullable()
    .optional(),
  precioVenta: z
    .number()
    .nonnegative("El precio de venta no puede ser negativo.")
    .nullable()
    .optional(),
  moneda: z
    .string()
    .trim()
    .length(3, "La moneda debe ser un código de 3 letras (ej. MXN).")
    .optional(),
  stock: z
    .number()
    .int("El stock debe ser un entero.")
    .nonnegative("El stock no puede ser negativo.")
    .nullable()
    .optional(),
  activo: z.boolean().optional(),
  atributos: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (d) =>
    d.precioCompra == null ||
    d.precioVenta == null ||
    d.precioVenta >= d.precioCompra,
  { message: "El precio de venta no puede ser menor que el costo.", path: ["precioVenta"] },
);

function productoValues(data: z.output<typeof productoSchema>) {
  return {
    productoTipoId: data.productoTipoId,
    sku: txtOrNull(data.sku),
    nombre: data.nombre,
    marca: txtOrNull(data.marca),
    marcaId: data.marcaId ?? null,
    modelo: txtOrNull(data.modelo),
    descripcion: txtOrNull(data.descripcion),
    unidad: data.unidad?.trim() || "pieza",
    precioCompra: numParaDb(data.precioCompra),
    precioVenta: numParaDb(data.precioVenta),
    moneda: (data.moneda ?? "MXN").toUpperCase(),
    stock: data.stock ?? null,
    activo: data.activo ?? true,
    atributos: data.atributos ?? {},
  };
}

function mensajeProductoConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("productos_sku_key")) return "Ya existe un producto con ese SKU.";
  if (msg.includes("productos_producto_tipo_id_fkey")) return "El tipo de producto no existe.";
  if (msg.includes("productos_marca_id_fkey")) return "La marca seleccionada no existe.";
  return "No se pudo guardar el producto.";
}

export async function crearProducto(
  data: z.input<typeof productoSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("productos", "edit");
  const parsed = productoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    const [row] = await db
      .insert(schema.productos)
      .values(productoValues(parsed.data))
      .returning({ id: schema.productos.id });
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajeProductoConflicto(e) };
  }
}

export async function actualizarProducto(
  id: string,
  data: z.input<typeof productoSchema>,
): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  const parsed = productoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    await db
      .update(schema.productos)
      .set({ ...productoValues(parsed.data), updatedAt: new Date().toISOString() })
      .where(eq(schema.productos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeProductoConflicto(e) };
  }
}

/** Activa/desactiva un producto (desactivado = no disponible para cotizar). */
export async function toggleProductoActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  try {
    await db
      .update(schema.productos)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.productos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del producto." };
  }
}

/**
 * Borra un producto. Solo admin, y solo si no está referenciado por partidas de
 * cotización o materiales de proyecto (en ese caso, desactivar). Comparte id con
 * catalogo_equipos tras el backfill, por lo que se comprueban ambas relaciones.
 */
export async function eliminarProducto(id: string): Promise<ActionResult> {
  const user = await assertPerm("productos", "edit");
  if (user.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede eliminar productos." };
  }
  try {
    const [{ enUso }] = await db
      .select({
        enUso: sql<number>`(
            (SELECT count(*) FROM cotizacion_items WHERE equipo_id = ${id})
          + (SELECT count(*) FROM proyecto_materiales WHERE equipo_id = ${id})
          )::int`,
      })
      .from(sql`(select 1) as x`);

    if (Number(enUso) > 0) {
      return {
        ok: false,
        error: "No se puede eliminar: el producto está en uso. Desactívalo en su lugar.",
      };
    }

    await db.delete(schema.productos).where(eq(schema.productos.id, id));
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el producto." };
  }
}

/**
 * Guarda la imagen de un producto (tras subirla a SharePoint en el route).
 * Borra el item anterior en Graph si cambió (best-effort).
 */
export async function guardarImagenProducto(
  id: string,
  url: string,
  itemId: string | null,
): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  try {
    const [prev] = await db
      .select({ itemId: schema.productos.imagenItemId })
      .from(schema.productos)
      .where(eq(schema.productos.id, id))
      .limit(1);

    await db
      .update(schema.productos)
      .set({ imagenUrl: url, imagenItemId: itemId, updatedAt: new Date().toISOString() })
      .where(eq(schema.productos.id, id));

    if (prev?.itemId && prev.itemId !== itemId) {
      await deleteDriveItem(prev.itemId);
    }
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar la imagen." };
  }
}

/** Quita la imagen de un producto (limpia columnas y borra el item en Graph). */
export async function quitarImagenProducto(id: string): Promise<ActionResult> {
  await assertPerm("productos", "edit");
  try {
    const [prev] = await db
      .select({ itemId: schema.productos.imagenItemId })
      .from(schema.productos)
      .where(eq(schema.productos.id, id))
      .limit(1);

    await db
      .update(schema.productos)
      .set({ imagenUrl: null, imagenItemId: null, updatedAt: new Date().toISOString() })
      .where(eq(schema.productos.id, id));

    if (prev?.itemId) await deleteDriveItem(prev.itemId);
    revalidatePath(PRODUCTOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo quitar la imagen." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * PAQUETES (bundles) — mutaciones
 *
 * CRUD de paquetes y sus líneas (referencian productos del catálogo). Aplicar un
 * paquete COPIA sus líneas a cotizacion_items con precio_fijo (snapshot), sin
 * tocar el paso Sistema. RBAC: módulo "paquetes" (edit = admin/gerente); aplicar
 * vive bajo cotizaciones:edit.
 * ──────────────────────────────────────────────────────────────────────────*/

const PAQUETES_PATH = "/je-admin/paquetes";

/** Normaliza un nombre para el anti-duplicados (minúsculas, sin acentos, 1 espacio). */
function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug estable (a-z, 0-9, _) a partir del nombre. */
function slugPaquete(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mensajePaqueteConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("paquetes_clave_key")) return "Ya existe un paquete con esa clave.";
  if (msg.includes("paquetes_nombre_normalizado_key")) return "Ya existe un paquete con ese nombre.";
  return "No se pudo guardar el paquete.";
}

const paqueteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  clave: z.string().trim().max(80).optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  segmento: z.enum(schema.paqueteSegmento.enumValues),
  capacidadKwp: z
    .number()
    .nonnegative("La capacidad no puede ser negativa.")
    .nullable()
    .optional(),
  descuentoPct: z
    .number()
    .min(0, "El descuento no puede ser negativo.")
    .max(100, "El descuento no puede superar 100%.")
    .optional(),
  activo: z.boolean().optional(),
});

export async function fetchPaquetes(input: {
  filtros?: PaquetesFiltros;
  limit: number;
  offset: number;
}): Promise<PaquetesPage> {
  await assertPerm("paquetes", "view");
  const f = input.filtros ?? {};
  const filtros: PaquetesFiltros = {
    segmento: f.segmento ?? undefined,
    soloActivos: f.soloActivos,
    busqueda: f.busqueda,
  };
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getPaquetesPage(filtros, { limit, offset });
}

export async function crearPaquete(
  data: z.input<typeof paqueteSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("paquetes", "edit");
  const parsed = paqueteSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(schema.paquetes)
      .values({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        clave: (d.clave?.trim() || slugPaquete(d.nombre)).toLowerCase(),
        descripcion: txtOrNull(d.descripcion),
        segmento: d.segmento,
        capacidadKwp: numParaDb(d.capacidadKwp),
        descuentoPct: String(d.descuentoPct ?? 0),
        activo: d.activo ?? true,
      })
      .returning({ id: schema.paquetes.id });
    revalidatePath(PAQUETES_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajePaqueteConflicto(e) };
  }
}

export async function actualizarPaquete(
  id: string,
  data: z.input<typeof paqueteSchema>,
): Promise<ActionResult> {
  await assertPerm("paquetes", "edit");
  const parsed = paqueteSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    await db
      .update(schema.paquetes)
      .set({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        clave: (d.clave?.trim() || slugPaquete(d.nombre)).toLowerCase(),
        descripcion: txtOrNull(d.descripcion),
        segmento: d.segmento,
        capacidadKwp: numParaDb(d.capacidadKwp),
        descuentoPct: String(d.descuentoPct ?? 0),
        activo: d.activo ?? true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.paquetes.id, id));
    revalidatePath(PAQUETES_PATH);
    revalidatePath(`${PAQUETES_PATH}/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajePaqueteConflicto(e) };
  }
}

export async function togglePaqueteActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  await assertPerm("paquetes", "edit");
  try {
    await db
      .update(schema.paquetes)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.paquetes.id, id));
    revalidatePath(PAQUETES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del paquete." };
  }
}

/** Borra un paquete (sus líneas caen por cascade). No hay FK desde cotización. */
export async function eliminarPaquete(id: string): Promise<ActionResult> {
  await assertPerm("paquetes", "edit");
  try {
    await db.delete(schema.paquetes).where(eq(schema.paquetes.id, id));
    revalidatePath(PAQUETES_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el paquete." };
  }
}

const paqueteLineaSchema = z.object({
  productoId: z.string().uuid("Producto no válido."),
  descripcion: z.string().trim().max(400).nullable().optional(),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0."),
  /** Si es null, se toma snapshot del precio_venta actual del producto. */
  precioFijo: z.number().nonnegative("El precio no puede ser negativo.").nullable().optional(),
});
const paqueteLineasSchema = z
  .array(paqueteLineaSchema)
  .max(200, "Máximo 200 líneas por paquete.");

/** Reemplaza por completo las líneas de un paquete (snapshot de precio_fijo). */
export async function guardarPaqueteLineas(
  paqueteId: string,
  lineas: z.input<typeof paqueteLineaSchema>[],
): Promise<ActionResult> {
  await assertPerm("paquetes", "edit");
  const parsed = paqueteLineasSchema.safeParse(lineas);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Líneas no válidas." };
  }
  const filas = parsed.data;
  try {
    await db.transaction(async (tx) => {
      // Resuelve precios de venta para las líneas que no traen precio_fijo.
      const ids = [...new Set(filas.map((l) => l.productoId))];
      const precios = ids.length
        ? await tx
            .select({ id: schema.productos.id, pv: schema.productos.precioVenta })
            .from(schema.productos)
            .where(inArray(schema.productos.id, ids))
        : [];
      const precioMap = new Map(precios.map((p) => [p.id, p.pv]));

      await tx
        .delete(schema.paqueteLineas)
        .where(eq(schema.paqueteLineas.paqueteId, paqueteId));

      if (filas.length > 0) {
        await tx.insert(schema.paqueteLineas).values(
          filas.map((l, i) => ({
            paqueteId,
            productoId: l.productoId,
            descripcion: txtOrNull(l.descripcion),
            cantidad: String(l.cantidad),
            precioFijo:
              l.precioFijo != null
                ? String(l.precioFijo)
                : (precioMap.get(l.productoId) ?? "0"),
            orden: i,
          })),
        );
      }

      await tx
        .update(schema.paquetes)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(schema.paquetes.id, paqueteId));
    });
    revalidatePath(PAQUETES_PATH);
    revalidatePath(`${PAQUETES_PATH}/${paqueteId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudieron guardar las líneas del paquete." };
  }
}

const aplicarPaqueteSchema = z.object({
  cotizacionId: z.string().uuid(),
  paqueteId: z.string().uuid(),
  modo: z.enum(["reemplazar", "solo_vacio"]).default("reemplazar"),
});

/**
 * Aplica un paquete a una cotización: COPIA sus líneas a cotizacion_items con su
 * precio_fijo, recalcula totales y sincroniza el monto de la oportunidad. NO toca
 * el paso Sistema (capacidad/paneles/esquema). Modo reemplazar / solo_vacio.
 */
export async function aplicarPaqueteACotizacion(
  input: z.input<typeof aplicarPaqueteSchema>,
): Promise<ActionResult & { total?: number }> {
  const user = await assertPerm("cotizaciones", "edit");
  const parsed = aplicarPaqueteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const { cotizacionId, paqueteId, modo } = parsed.data;
  if (!(await puedeAccederCotizacion(user, cotizacionId))) {
    return { ok: false, error: SIN_ACCESO };
  }
  const actor = actorOf(user);

  try {
    const resultado = await db.transaction(async (tx) => {
      const [cot] = await tx
        .select({ estado: schema.cotizaciones.estado })
        .from(schema.cotizaciones)
        .where(eq(schema.cotizaciones.id, cotizacionId))
        .limit(1);
      if (!cot) throw new Error("Cotización no encontrada");
      if (COTIZACION_ESTADOS_NO_EDITABLES.has(cot.estado)) {
        return {
          ok: false as const,
          error: `No se puede editar una cotización en estado ${cot.estado}.`,
        };
      }

      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.cotizacionItems)
        .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));
      if (modo === "solo_vacio" && Number(n) > 0) {
        return { ok: true as const, total: undefined };
      }

      const lineas = await tx
        .select({
          productoId: schema.paqueteLineas.productoId,
          descripcion: schema.paqueteLineas.descripcion,
          cantidad: schema.paqueteLineas.cantidad,
          precioFijo: schema.paqueteLineas.precioFijo,
          productoNombre: schema.productos.nombre,
        })
        .from(schema.paqueteLineas)
        .innerJoin(schema.productos, eq(schema.paqueteLineas.productoId, schema.productos.id))
        .where(eq(schema.paqueteLineas.paqueteId, paqueteId))
        .orderBy(asc(schema.paqueteLineas.orden), asc(schema.paqueteLineas.id));

      if (lineas.length === 0) {
        return { ok: false as const, error: "El paquete no tiene líneas." };
      }

      // Descuento general del paquete: se aplica a CADA línea (precio_unitario).
      const [paq] = await tx
        .select({ descuentoPct: schema.paquetes.descuentoPct })
        .from(schema.paquetes)
        .where(eq(schema.paquetes.id, paqueteId))
        .limit(1);
      const factor = 1 - Number(paq?.descuentoPct ?? 0) / 100;
      const precioConDescuento = (precioFijo: string): number =>
        Math.round(Number(precioFijo) * factor * 100) / 100;

      await tx
        .delete(schema.cotizacionItems)
        .where(eq(schema.cotizacionItems.cotizacionId, cotizacionId));

      await tx.insert(schema.cotizacionItems).values(
        lineas.map((l) => ({
          cotizacionId,
          equipoId: l.productoId,
          descripcion: l.descripcion ?? l.productoNombre,
          cantidad: l.cantidad,
          precioUnitario: String(precioConDescuento(l.precioFijo)),
        })),
      );

      const t = calcularTotales(
        lineas.map((l) => ({
          cantidad: Number(l.cantidad),
          precioUnitario: precioConDescuento(l.precioFijo),
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
        tipo: "paquete_aplicado",
        descripcion: `Paquete aplicado (${lineas.length} partidas)`,
        payload: { paqueteId, partidas: lineas.length, ...t, modo },
        actor,
      });

      await autoEnlazarOportunidad(tx, cotizacionId);
      await sincronizarMontoOportunidad(tx, cotizacionId);

      return { ok: true as const, ...t };
    });

    if (resultado.ok) {
      revalidatePath(`/je-admin/cotizaciones/${cotizacionId}`);
      revalidatePath("/je-admin/oportunidades");
    }
    return resultado;
  } catch {
    return { ok: false, error: "No se pudo aplicar el paquete." };
  }
}

export interface SugerenciaPaquetes {
  ok: boolean
  error?: string
  capacidadKwp: number | null
  segmento?: PaqueteSegmento
  mejor?: PaqueteOpcion | null
  cubre?: boolean
  candidatos?: PaqueteOpcion[]
}

/**
 * Sugiere paquetes para una cotización: deriva el segmento del cliente
 * (tipo_persona) y usa la capacidad del paso Sistema para el "mejor ajuste".
 * Devuelve el sugerido + candidatos (con conteo de precios desactualizados).
 */
export async function sugerirPaquetesParaCotizacion(
  cotizacionId: string,
  capacidadKwpOverride?: number | null,
): Promise<SugerenciaPaquetes> {
  const user = await assertPerm("cotizaciones", "edit");
  if (!(await puedeAccederCotizacion(user, cotizacionId))) {
    return { ok: false, error: SIN_ACCESO, capacidadKwp: null };
  }

  const [cot] = await db
    .select({
      capacidadKwp: schema.cotizaciones.capacidadKwp,
      clienteId: schema.cotizaciones.clienteId,
    })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);
  if (!cot) return { ok: false, error: "Cotización no encontrada", capacidadKwp: null };

  let tipoPersona: string | null = null;
  if (cot.clienteId) {
    const [cl] = await db
      .select({ tipoPersona: schema.clientes.tipoPersona })
      .from(schema.clientes)
      .where(eq(schema.clientes.id, cot.clienteId))
      .limit(1);
    tipoPersona = cl?.tipoPersona ?? null;
  }

  const segmento = segmentoDeTipoPersona(tipoPersona);
  const capStored = cot.capacidadKwp != null ? Number(cot.capacidadKwp) : null;
  const cap =
    capacidadKwpOverride != null && capacidadKwpOverride > 0
      ? capacidadKwpOverride
      : capStored;
  const result = await getMejorPaquete({ capacidadKwp: cap ?? 0, segmento });
  return { ok: true, capacidadKwp: cap, segmento, ...result };
}

/**
 * Resumen de desviaciones de precio NUEVAS (no notificadas) + correo a vendedores
 * y administradores; marca las líneas como notificadas. Pensada para invocarse
 * desde el endpoint que dispara n8n (no usa sesión). Devuelve cuántas notificó.
 */
export async function notificarDesviacionesPaquetes(): Promise<{
  ok: boolean;
  notificadas: number;
  skipped?: boolean;
}> {
  const desviaciones = await getDesviacionesPaquetes(true);
  if (desviaciones.length === 0) return { ok: true, notificadas: 0 };

  // Destinatarios: vendedores y administradores activos con correo.
  const destinatarios = await db
    .select({ email: schema.usuarios.email })
    .from(schema.usuarios)
    .where(
      and(
        eq(schema.usuarios.activo, true),
        inArray(schema.usuarios.rol, ["vendedor", "admin"]),
      ),
    );
  const to = destinatarios.map((d) => d.email).filter(Boolean).join(",");

  // Agrupa por paquete para un resumen legible.
  const porPaquete = new Map<string, { nombre: string; lineas: DesviacionLinea[] }>();
  for (const d of desviaciones) {
    const g = porPaquete.get(d.paqueteId) ?? { nombre: d.paqueteNombre, lineas: [] };
    g.lineas.push(d);
    porPaquete.set(d.paqueteId, g);
  }

  const filasHtml = [...porPaquete.values()]
    .map((g) => {
      const lis = g.lineas
        .map(
          (l) =>
            `<li>${l.productoNombre}: fijo $${l.precioFijo.toLocaleString("es-MX")} → actual $${l.precioVentaActual.toLocaleString("es-MX")} (Δ $${(l.precioVentaActual - l.precioFijo).toLocaleString("es-MX")})</li>`,
        )
        .join("");
      const appUrl = serverEnv.AUTH_URL ?? clientEnv.NEXT_PUBLIC_SITE_URL;
      const url = `${appUrl}/je-admin/paquetes/${g.lineas[0]?.paqueteId ?? ""}`;
      return `<p><strong><a href="${url}">${g.nombre}</a></strong></p><ul>${lis}</ul>`;
    })
    .join("");

  const html = `<p>Se detectaron precios desactualizados en líneas de paquetes (precio fijo ≠ precio de venta actual):</p>${filasHtml}<p>Revisa cada paquete y actualiza los precios si corresponde.</p>`;

  let skipped = false;
  if (to) {
    const res = await sendMail({
      to,
      subject: "Paquetes con precios desactualizados",
      html,
      text: "Hay líneas de paquete con precio fijo distinto al precio de venta actual. Revisa el panel.",
    });
    skipped = Boolean(res.skipped);
  }

  // Marca como notificadas las líneas incluidas (aunque el correo se haya saltado
  // por falta de config, para no reintentar en cada corrida en dev).
  const lineaIds = desviaciones.map((d) => d.lineaId);
  await db
    .update(schema.paqueteLineas)
    .set({ yaNotificado: true })
    .where(inArray(schema.paqueteLineas.id, lineaIds));

  return { ok: true, notificadas: desviaciones.length, skipped };
}

/* ─────────────────────────────────────────────────────────────────────────
 * CATÁLOGOS · MARCAS — mutaciones (RBAC: módulo "marcas", edit = OPS)
 * ───────────────────────────────────────────────────────────────────────── */

const MARCAS_PATH = "/je-admin/marcas";

const marcaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});

function mensajeMarcaConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("marcas_nombre_normalizado_key")) return "Ya existe una marca con ese nombre.";
  return "No se pudo guardar la marca.";
}

export async function fetchMarcas(input: {
  filtros?: MarcasFiltros;
  limit: number;
  offset: number;
}): Promise<MarcasPage> {
  await assertPerm("marcas", "view");
  const f = input.filtros ?? {};
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getMarcasPage({ busqueda: f.busqueda, soloActivas: f.soloActivas }, { limit, offset });
}

export async function crearMarca(
  data: z.input<typeof marcaSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("marcas", "edit");
  const parsed = marcaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(schema.marcas)
      .values({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        descripcion: txtOrNull(d.descripcion),
        activo: d.activo ?? true,
      })
      .returning({ id: schema.marcas.id });
    revalidatePath(MARCAS_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajeMarcaConflicto(e) };
  }
}

export async function actualizarMarca(
  id: string,
  data: z.input<typeof marcaSchema>,
): Promise<ActionResult> {
  await assertPerm("marcas", "edit");
  const parsed = marcaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    await db
      .update(schema.marcas)
      .set({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        descripcion: txtOrNull(d.descripcion),
        activo: d.activo ?? true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.marcas.id, id));
    revalidatePath(MARCAS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeMarcaConflicto(e) };
  }
}

export async function toggleMarcaActiva(id: string, activo: boolean): Promise<ActionResult> {
  await assertPerm("marcas", "edit");
  try {
    await db
      .update(schema.marcas)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.marcas.id, id));
    revalidatePath(MARCAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado de la marca." };
  }
}

export async function eliminarMarca(id: string): Promise<ActionResult> {
  await assertPerm("marcas", "edit");
  try {
    await db.delete(schema.marcas).where(eq(schema.marcas.id, id));
    revalidatePath(MARCAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la marca." };
  }
}

/** Guarda el logo de una marca (tras subirlo a SharePoint). Borra el anterior. */
export async function guardarImagenMarca(
  id: string,
  url: string,
  itemId: string | null,
): Promise<ActionResult> {
  await assertPerm("marcas", "edit");
  try {
    const [prev] = await db
      .select({ itemId: schema.marcas.imagenItemId })
      .from(schema.marcas)
      .where(eq(schema.marcas.id, id))
      .limit(1);

    await db
      .update(schema.marcas)
      .set({ imagenUrl: url, imagenItemId: itemId, updatedAt: new Date().toISOString() })
      .where(eq(schema.marcas.id, id));

    if (prev?.itemId && prev.itemId !== itemId) await deleteDriveItem(prev.itemId);
    revalidatePath(MARCAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar el logo." };
  }
}

/** Quita el logo de una marca (limpia columnas y borra el item en Graph). */
export async function quitarImagenMarca(id: string): Promise<ActionResult> {
  await assertPerm("marcas", "edit");
  try {
    const [prev] = await db
      .select({ itemId: schema.marcas.imagenItemId })
      .from(schema.marcas)
      .where(eq(schema.marcas.id, id))
      .limit(1);

    await db
      .update(schema.marcas)
      .set({ imagenUrl: null, imagenItemId: null, updatedAt: new Date().toISOString() })
      .where(eq(schema.marcas.id, id));

    if (prev?.itemId) await deleteDriveItem(prev.itemId);
    revalidatePath(MARCAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo quitar el logo." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * ORGANIZACIÓN — Áreas (catálogo) + jerarquía de usuarios (línea de reporte).
 * Fase 1: estructura y organigrama; no altera visibilidad ni asignación.
 * ───────────────────────────────────────────────────────────────────────── */

const AREAS_PATH = "/je-admin/areas";
const ORGANIGRAMA_PATH = "/je-admin/organigrama";

const areaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  // Varios líderes por área (orden = orden del array). El rol de cada líder es su
  // cargo (del usuario). areas.lider_id se sincroniza con lideres[0].
  lideres: z
    .array(z.string().uuid("Líder no válido."))
    .optional()
    .transform((v) => (v ? [...new Set(v)] : [])),
  padreId: z.string().uuid("Área padre no válida.").nullable().optional().transform((v) => v ?? null),
  activa: z.boolean().optional(),
});

/** Reemplaza los líderes de un área (borra e inserta con su orden). */
async function reemplazarLideresArea(areaId: string, lideres: string[]): Promise<void> {
  await db.delete(schema.areaLideres).where(eq(schema.areaLideres.areaId, areaId));
  if (lideres.length > 0) {
    await db
      .insert(schema.areaLideres)
      .values(lideres.map((usuarioId, i) => ({ areaId, usuarioId, orden: i })));
  }
}

/**
 * ¿`posiblePadre` es la propia área o una descendiente suya? Evita ciclos al
 * asignar el área padre (un área no puede colgar de su propio subárbol).
 */
async function generariaCicloArea(areaId: string, posiblePadre: string): Promise<boolean> {
  if (areaId === posiblePadre) return true;
  const res = await db.execute(sql`
    WITH RECURSIVE descendientes AS (
      SELECT id FROM areas WHERE padre_id = ${areaId}
      UNION ALL
      SELECT a.id FROM areas a JOIN descendientes d ON a.padre_id = d.id
    )
    SELECT 1 FROM descendientes WHERE id = ${posiblePadre} LIMIT 1
  `);
  return (res as unknown as { rows: unknown[] }).rows.length > 0;
}

function mensajeAreaConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("ux_areas_nombre_norm")) return "Ya existe un área con ese nombre.";
  return "No se pudo guardar el área.";
}

export async function fetchAreas(input: {
  filtros?: AreasFiltros;
  limit: number;
  offset: number;
}): Promise<AreasPage> {
  await assertPerm("areas", "view");
  const f = input.filtros ?? {};
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getAreasPage({ busqueda: f.busqueda, soloActivas: f.soloActivas }, { limit, offset });
}

export async function fetchAreasArbol(): Promise<AreaArbolRow[]> {
  await assertPerm("areas", "view");
  return getAreasArbol();
}

/* ── Empresas (multi-tenant) + importación de usuarios desde M365 ─────────── */

export async function fetchEmpresas(): Promise<EmpresaRow[]> {
  await assertPerm("usuarios", "view");
  return getEmpresas();
}

/**
 * Lista los usuarios de M365 del dominio de una empresa, marcando cuáles ya
 * existen en el panel (por correo). Para el importador en Usuarios.
 */
export async function fetchUsuariosM365(
  empresaId: string,
): Promise<{ ok: true; data: (M365User & { yaExiste: boolean })[] } | { ok: false; error: string }> {
  await assertPerm("usuarios", "edit");
  const [emp] = await db
    .select({ dominio: schema.empresas.dominio })
    .from(schema.empresas)
    .where(eq(schema.empresas.id, empresaId))
    .limit(1);
  if (!emp) return { ok: false, error: "Empresa no válida." };

  const r = await listarUsuariosM365(emp.dominio);
  if (!r.ok) return r;

  const existentes = await db.select({ email: schema.usuarios.email }).from(schema.usuarios);
  const set = new Set(existentes.map((x) => x.email.toLowerCase()));
  return { ok: true, data: r.data.map((u) => ({ ...u, yaExiste: set.has(u.email) })) };
}

/**
 * Importa (crea) los usuarios de M365 seleccionados (por correo) hacia una
 * empresa, con un rol por defecto. Omite los que ya existen. Re-consulta Graph
 * para tomar los datos autoritativos (no confía en el cliente).
 */
export async function importarUsuariosM365(
  empresaId: string,
  correos: string[],
  rol: string,
): Promise<ActionResult & { creados?: number; omitidos?: number }> {
  await assertPerm("usuarios", "edit");

  const rolParsed = rolSchema.safeParse(rol);
  if (!rolParsed.success) return { ok: false, error: "Rol no válido." };

  const [emp] = await db
    .select({ dominio: schema.empresas.dominio })
    .from(schema.empresas)
    .where(eq(schema.empresas.id, empresaId))
    .limit(1);
  if (!emp) return { ok: false, error: "Empresa no válida." };

  const r = await listarUsuariosM365(emp.dominio);
  if (!r.ok) return { ok: false, error: r.error };

  const sel = new Set((correos ?? []).map((c) => c.toLowerCase()));
  const elegidos = r.data.filter((u) => sel.has(u.email));
  if (elegidos.length === 0) return { ok: false, error: "No hay usuarios seleccionados válidos." };

  const existentes = await db.select({ email: schema.usuarios.email }).from(schema.usuarios);
  const existSet = new Set(existentes.map((x) => x.email.toLowerCase()));

  let creados = 0;
  let omitidos = 0;
  for (const u of elegidos) {
    if (existSet.has(u.email)) {
      omitidos++;
      continue;
    }
    try {
      await db
        .insert(schema.usuarios)
        .values({
          nombre: u.displayName,
          email: u.email,
          empresaId,
          rol: rolParsed.data,
          telefono: u.phone,
          cargo: u.jobTitle,
          activo: true,
        })
        .onConflictDoNothing();
      creados++;
    } catch {
      omitidos++;
    }
  }

  revalidatePath("/je-admin/usuarios");
  revalidatePath("/je-admin/organigrama");
  return { ok: true, creados, omitidos };
}

export async function crearArea(
  data: z.input<typeof areaSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("areas", "edit");
  const parsed = areaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(schema.areas)
      .values({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        descripcion: txtOrNull(d.descripcion),
        liderId: d.lideres[0] ?? null,
        padreId: d.padreId,
        activa: d.activa ?? true,
      })
      .returning({ id: schema.areas.id });
    await reemplazarLideresArea(row.id, d.lideres);
    revalidatePath(AREAS_PATH);
    revalidatePath(ORGANIGRAMA_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajeAreaConflicto(e) };
  }
}

export async function actualizarArea(
  id: string,
  data: z.input<typeof areaSchema>,
): Promise<ActionResult> {
  await assertPerm("areas", "edit");
  const parsed = areaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  // Guard anti-ciclos: el área no puede colgar de sí misma ni de una descendiente.
  if (d.padreId && (await generariaCicloArea(id, d.padreId))) {
    return { ok: false, error: "El área no puede colgar de sí misma ni de una subárea suya." };
  }
  try {
    await db
      .update(schema.areas)
      .set({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        descripcion: txtOrNull(d.descripcion),
        liderId: d.lideres[0] ?? null,
        padreId: d.padreId,
        activa: d.activa ?? true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.areas.id, id));
    await reemplazarLideresArea(id, d.lideres);
    revalidatePath(AREAS_PATH);
    revalidatePath(ORGANIGRAMA_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeAreaConflicto(e) };
  }
}

export async function toggleAreaActiva(id: string, activa: boolean): Promise<ActionResult> {
  await assertPerm("areas", "edit");
  try {
    await db
      .update(schema.areas)
      .set({ activa, updatedAt: new Date().toISOString() })
      .where(eq(schema.areas.id, id));
    revalidatePath(AREAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el área." };
  }
}

export async function eliminarArea(id: string): Promise<ActionResult> {
  await assertPerm("areas", "edit");
  try {
    // usuarios.area_id es ON DELETE SET NULL: los miembros quedan sin área.
    await db.delete(schema.areas).where(eq(schema.areas.id, id));
    revalidatePath(AREAS_PATH);
    revalidatePath(ORGANIGRAMA_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el área." };
  }
}

/* ───────────────────────────── Cargos (catálogo) ───────────────────────────── */

const CARGOS_PATH = "/je-admin/cargos";

const cargoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  activo: z.boolean().optional(),
  orden: z.coerce.number().int().min(0).max(9999).optional(),
});

function mensajeCargoConflicto(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("ux_cargos_nombre_norm")) return "Ya existe un cargo con ese nombre.";
  return "No se pudo guardar el cargo.";
}

export async function fetchCargos(input: {
  filtros?: CargosFiltros;
  limit: number;
  offset: number;
}): Promise<CargosPage> {
  await assertPerm("cargos", "view");
  const f = input.filtros ?? {};
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getCargosPage({ busqueda: f.busqueda, soloActivos: f.soloActivos }, { limit, offset });
}

/** Cargos activos (id + nombre) para los selects de usuario. */
export async function fetchCargosActivos(): Promise<{ id: string; nombre: string }[]> {
  await assertPerm("cargos", "view");
  return getCargosActivos();
}

export async function crearCargo(
  data: z.input<typeof cargoSchema>,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("cargos", "edit");
  const parsed = cargoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(schema.cargos)
      .values({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        activo: d.activo ?? true,
        orden: d.orden ?? 0,
      })
      .returning({ id: schema.cargos.id });
    revalidatePath(CARGOS_PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: mensajeCargoConflicto(e) };
  }
}

export async function actualizarCargo(
  id: string,
  data: z.input<typeof cargoSchema>,
): Promise<ActionResult> {
  await assertPerm("cargos", "edit");
  const parsed = cargoSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;
  try {
    await db
      .update(schema.cargos)
      .set({
        nombre: d.nombre,
        nombreNormalizado: normalizarNombre(d.nombre),
        activo: d.activo ?? true,
        orden: d.orden ?? 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.cargos.id, id));
    // Mantiene sincronizado el texto denormalizado en usuarios.
    await db.update(schema.usuarios).set({ cargo: d.nombre }).where(eq(schema.usuarios.cargoId, id));
    revalidatePath(CARGOS_PATH);
    revalidatePath("/je-admin/usuarios");
    revalidatePath(ORGANIGRAMA_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeCargoConflicto(e) };
  }
}

export async function toggleCargoActivo(id: string, activo: boolean): Promise<ActionResult> {
  await assertPerm("cargos", "edit");
  try {
    await db
      .update(schema.cargos)
      .set({ activo, updatedAt: new Date().toISOString() })
      .where(eq(schema.cargos.id, id));
    revalidatePath(CARGOS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el cargo." };
  }
}

export async function eliminarCargo(id: string): Promise<ActionResult> {
  await assertPerm("cargos", "edit");
  try {
    // usuarios.cargo_id es ON DELETE SET NULL: quedan sin cargo del catálogo
    // (conservan el texto denormalizado como histórico).
    await db.delete(schema.cargos).where(eq(schema.cargos.id, id));
    revalidatePath(CARGOS_PATH);
    revalidatePath("/je-admin/usuarios");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el cargo." };
  }
}

const jerarquiaSchema = z.object({
  reportaA: z.string().uuid("Jefe no válido.").nullable().optional().transform((v) => v ?? null),
  cargo: z.string().trim().max(120).nullable().optional().transform((v) => (v ? v : null)),
  areaId: z.string().uuid("Área no válida.").nullable().optional().transform((v) => v ?? null),
});

/**
 * Actualiza la posición de un usuario en el organigrama: jefe directo (reportaA),
 * cargo y área. Valida que no se asigne a sí mismo ni a un descendiente suyo
 * (evita ciclos en la línea de reporte). Permiso: organizacion:edit.
 */
export async function actualizarJerarquiaUsuario(
  userId: string,
  data: z.input<typeof jerarquiaSchema>,
): Promise<ActionResult> {
  await assertPerm("organizacion", "edit");
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "Usuario no válido." };
  }
  const parsed = jerarquiaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const d = parsed.data;

  if (d.reportaA) {
    if (d.reportaA === userId) {
      return { ok: false, error: "Un usuario no puede reportarse a sí mismo." };
    }
    // No puede reportar a alguien que está por debajo de él (ciclo).
    const descendientes = await getDescendientes(userId);
    if (descendientes.includes(d.reportaA)) {
      return {
        ok: false,
        error: "No puedes asignar como jefe a alguien que depende de este usuario.",
      };
    }
  }

  try {
    await db
      .update(schema.usuarios)
      .set({
        reportaA: d.reportaA,
        cargo: d.cargo,
        areaId: d.areaId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.usuarios.id, userId));
    revalidatePath("/je-admin/usuarios");
    revalidatePath(ORGANIGRAMA_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la organización del usuario." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * CAMPAÑAS (marketing) — CRUD. Atribución de leads por leads.campana_id.
 * ───────────────────────────────────────────────────────────────────────── */

const CAMPANAS_PATH = "/je-admin/campanas";

/** numero opcional (>= 0); "" / null -> null. */
const numeroOpcional = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monto no válido." });
      return z.NEVER;
    }
    return n;
  });

const campanaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  plataforma: z.enum(schema.campanaPlataforma.enumValues),
  estado: z.enum(schema.campanaEstado.enumValues).default("borrador"),
  segmento: optionalText(120),
  zona: optionalText(120),
  objetivo: optionalText(500),
  presupuesto: numeroOpcional,
  gasto: numeroOpcional,
  moneda: z.string().trim().max(8).optional().transform((v) => (v ? v : "MXN")),
  utmCampaign: optionalText(160),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
});

type CampanaInput = z.input<typeof campanaSchema>;

/** Valores comunes de insert/update de campaña (numeric -> string; gasto -> jsonb). */
function campanaValues(d: z.output<typeof campanaSchema>) {
  return {
    nombre: d.nombre,
    plataforma: d.plataforma,
    estado: d.estado,
    segmento: txtOrNull(d.segmento),
    zona: txtOrNull(d.zona),
    objetivo: txtOrNull(d.objetivo),
    presupuesto: d.presupuesto == null ? null : String(d.presupuesto),
    moneda: d.moneda,
    utmCampaign: txtOrNull(d.utmCampaign),
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin,
    metricas: d.gasto == null ? {} : { gasto: d.gasto },
  };
}

export async function fetchCampanas(input: {
  filtros?: CampanasFiltros;
  limit: number;
  offset: number;
}): Promise<CampanasPage> {
  await assertPerm("campanas", "view");
  const f = input.filtros ?? {};
  const limit = Math.min(Math.max(1, Math.trunc(input.limit)), 100);
  const offset = Math.max(0, Math.trunc(input.offset));
  return getCampanasPage(
    { estado: f.estado, plataforma: f.plataforma, busqueda: f.busqueda },
    { limit, offset },
  );
}

export async function crearCampana(
  data: CampanaInput,
): Promise<ActionResult & { id?: string }> {
  await assertPerm("campanas", "edit");
  const parsed = campanaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    const [row] = await db
      .insert(schema.campanas)
      .values(campanaValues(parsed.data))
      .returning({ id: schema.campanas.id });
    revalidatePath(CAMPANAS_PATH);
    return { ok: true, id: row.id };
  } catch {
    return { ok: false, error: "No se pudo crear la campaña." };
  }
}

export async function actualizarCampana(
  id: string,
  data: CampanaInput,
): Promise<ActionResult> {
  await assertPerm("campanas", "edit");
  const parsed = campanaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  try {
    await db
      .update(schema.campanas)
      .set({ ...campanaValues(parsed.data), updatedAt: new Date().toISOString() })
      .where(eq(schema.campanas.id, id));
    revalidatePath(CAMPANAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la campaña." };
  }
}

export async function eliminarCampana(id: string): Promise<ActionResult> {
  await assertPerm("campanas", "edit");
  try {
    // leads.campana_id es ON DELETE SET NULL: los leads quedan sin campaña.
    await db.delete(schema.campanas).where(eq(schema.campanas.id, id));
    revalidatePath(CAMPANAS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la campaña." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * INTEGRACIONES — configuración de conexiones (secretos cifrados en BD).
 * Solo admin (RBAC integraciones:edit). Nunca se devuelven valores de secretos.
 * ───────────────────────────────────────────────────────────────────────── */

export interface CampoGuardar {
  campo: string;
  /** Sensible: ""=conservar el existente, no vacío=reemplazar. Claro: el valor. */
  valor: string;
  sensible: boolean;
}
export interface GuardarIntegracionInput {
  activo: boolean;
  /** Conjunto de campos deseado. Un campo omitido se ELIMINA (permite quitar campos). */
  campos: CampoGuardar[];
}

/**
 * Guarda una integración a partir del conjunto de campos deseado: los campos en
 * claro van a `ajustes`, los sensibles cifrados a `secretos` (AES-256-GCM). Un
 * campo ausente en `campos` se elimina (así se pueden quitar campos). Los
 * secretos con valor vacío conservan su valor cifrado previo (write-only). Para
 * integraciones del REGISTRO el flag `sensible` lo fija el sistema (no el
 * cliente) y sus campos declarados no se pueden convertir. Upsert por clave.
 */
export async function guardarIntegracion(
  clave: string,
  input: GuardarIntegracionInput,
): Promise<ActionResult> {
  const user = await assertPerm("integraciones", "edit");
  const def = REGISTRO.find((d) => d.clave === clave);

  // Fila previa (para conservar nombre/descripción de custom y secretos anteriores).
  const [prev] = await db
    .select({
      nombre: schema.integraciones.nombre,
      descripcion: schema.integraciones.descripcion,
      secretos: schema.integraciones.secretos,
    })
    .from(schema.integraciones)
    .where(eq(schema.integraciones.clave, clave))
    .limit(1);

  if (!def && !prev) return { ok: false, error: "Integración no válida." };

  const prevSecretos = (prev?.secretos as Record<string, unknown>) ?? {};
  // Flag sensible declarado por el sistema (REGISTRO): no se deja cambiar.
  const sensibleDeclarado = new Map<string, boolean>();
  if (def) {
    for (const c of def.ajustes) sensibleDeclarado.set(c.campo, false);
    for (const c of def.secretos) sensibleDeclarado.set(c.campo, true);
  }

  const ajustes: Record<string, string> = {};
  const secretos: Record<string, unknown> = {};
  try {
    for (const c of input.campos ?? []) {
      const campo = c.campo?.trim().toLowerCase() ?? "";
      if (!RE_CAMPO.test(campo)) continue;
      const sensible = sensibleDeclarado.has(campo)
        ? (sensibleDeclarado.get(campo) as boolean)
        : c.sensible;
      const valor = typeof c.valor === "string" ? c.valor.trim() : "";
      if (sensible) {
        if (valor !== "") secretos[campo] = cifrarSecreto(`${clave}:${campo}`, valor);
        else if (esSecretoCifrado(prevSecretos[campo])) secretos[campo] = prevSecretos[campo];
      } else if (valor !== "") {
        ajustes[campo] = valor;
      }
    }
  } catch {
    return { ok: false, error: "No se pudo cifrar (¿falta CONFIG_ENC_KEY?)." };
  }

  const nombre = def ? def.nombre : (prev?.nombre ?? clave);
  const descripcion = def ? def.descripcion : (prev?.descripcion ?? "");

  try {
    await db
      .insert(schema.integraciones)
      .values({
        clave,
        nombre,
        descripcion,
        activo: input.activo,
        ajustes,
        secretos,
        actualizadoPor: user.id ?? null,
      })
      .onConflictDoUpdate({
        target: schema.integraciones.clave,
        set: {
          nombre,
          descripcion,
          activo: input.activo,
          ajustes,
          secretos,
          actualizadoPor: user.id ?? null,
          updatedAt: new Date().toISOString(),
        },
      });
  } catch {
    return { ok: false, error: "No se pudo guardar la integración." };
  }

  invalidarConfig(clave);
  revalidatePath("/je-admin/integraciones");
  return { ok: true };
}

/* ── Crear / revelar / eliminar integraciones ─────────────────────────────── */

export interface CrearIntegracionInput {
  clave: string;
  nombre: string;
  descripcion?: string;
  /** Campos: sensible=true → cifrado y enmascarado; false → en claro. */
  campos: Array<{ campo: string; valor: string; sensible: boolean }>;
}

const RE_CLAVE = /^[a-z][a-z0-9_-]{1,39}$/;
const RE_CAMPO = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * Crea una integración a mano (fuera del REGISTRO). Cada campo se guarda en
 * `ajustes` (claro) o `secretos` (cifrado) según su flag `sensible`.
 */
export async function crearIntegracion(input: CrearIntegracionInput): Promise<ActionResult> {
  const user = await assertPerm("integraciones", "edit");

  const clave = input.clave?.trim().toLowerCase() ?? "";
  const nombre = input.nombre?.trim() ?? "";
  if (!RE_CLAVE.test(clave)) {
    return { ok: false, error: "Clave inválida (minúsculas, letras/números/-/_, 2-40)." };
  }
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (REGISTRO.some((d) => d.clave === clave)) {
    return { ok: false, error: "Esa clave es una integración del sistema." };
  }

  const [existe] = await db
    .select({ clave: schema.integraciones.clave })
    .from(schema.integraciones)
    .where(eq(schema.integraciones.clave, clave))
    .limit(1);
  if (existe) return { ok: false, error: "Ya existe una integración con esa clave." };

  const ajustes: Record<string, string> = {};
  const secretos: Record<string, unknown> = {};
  try {
    for (const c of input.campos ?? []) {
      const campo = c.campo?.trim().toLowerCase() ?? "";
      const valor = typeof c.valor === "string" ? c.valor.trim() : "";
      if (!RE_CAMPO.test(campo) || valor === "") continue;
      if (c.sensible) secretos[campo] = cifrarSecreto(`${clave}:${campo}`, valor);
      else ajustes[campo] = valor;
    }
  } catch {
    return { ok: false, error: "No se pudo cifrar (¿falta CONFIG_ENC_KEY?)." };
  }

  try {
    await db.insert(schema.integraciones).values({
      clave,
      nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: true,
      ajustes,
      secretos,
      actualizadoPor: user.id ?? null,
    });
  } catch {
    return { ok: false, error: "No se pudo crear la integración." };
  }

  invalidarConfig(clave);
  revalidatePath("/je-admin/integraciones");
  return { ok: true };
}

/**
 * Revela el valor efectivo de un secreto (BD descifrada o fallback a env) para
 * verlo/copiarlo en la UI. Acción explícita, solo admin (integraciones:edit).
 */
export async function revelarSecretoIntegracion(
  clave: string,
  campo: string,
): Promise<{ ok: true; valor: string } | { ok: false; error: string }> {
  await assertPerm("integraciones", "edit");
  try {
    const integ = await getIntegracion(clave);
    const valor = integ.secreto(campo);
    if (valor == null) return { ok: false, error: "Sin valor (no configurado)." };
    return { ok: true, valor };
  } catch {
    return { ok: false, error: "No se pudo revelar (¿falta CONFIG_ENC_KEY?)." };
  }
}

/** Elimina una integración creada a mano (las del REGISTRO no se borran). */
export async function eliminarIntegracion(clave: string): Promise<ActionResult> {
  await assertPerm("integraciones", "edit");
  if (REGISTRO.some((d) => d.clave === clave)) {
    return { ok: false, error: "Las integraciones del sistema no se pueden eliminar." };
  }
  try {
    await db.delete(schema.integraciones).where(eq(schema.integraciones.clave, clave));
  } catch {
    return { ok: false, error: "No se pudo eliminar la integración." };
  }
  invalidarConfig(clave);
  revalidatePath("/je-admin/integraciones");
  return { ok: true };
}
