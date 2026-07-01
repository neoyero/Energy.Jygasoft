"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db, schema } from "@/db";
import { assertPerm } from "@/lib/admin/guard";
import type { Accion } from "@/lib/admin/rbac";
import { getIntegracion, invalidarConfig } from "@/lib/config/service";
import { cifrarSecreto } from "@/lib/config/crypto";
import { cwRequest, type CwResult, type ChatwootAgent } from "@/lib/chatwoot/client";
import type {
  CwInbox,
  CwTeam,
  CwCannedResponse,
  CwLabel,
  CwCustomAttribute,
  CwWebhook,
  CwDiagnostico,
  CwContact,
  CwPagina,
  CwConversation,
  CwMessage,
  CwAutomationRule,
} from "@/lib/chatwoot/types";
import * as cw from "@/lib/chatwoot/admin";

/**
 * Server actions del módulo de administración de Chatwoot (BFF). Cada acción
 * valida sesión + permiso (chatwoot:view para leer, chatwoot:edit para mutar) y
 * valida el payload con Zod antes de reenviar a la Application API. El token de
 * Chatwoot nunca sale del backend (lo resuelve el cliente desde la BD cifrada).
 */

const NO_AUTORIZADO = { ok: false, error: "No autorizado." } as const;

async function autorizado(accion: Accion): Promise<boolean> {
  try {
    await assertPerm("chatwoot", accion);
    return true;
  } catch {
    return false;
  }
}

function errorZod(e: z.ZodError): { ok: false; error: string } {
  return { ok: false, error: e.issues[0]?.message ?? "Datos no válidos." };
}

/* ── Diagnóstico de conexión ──────────────────────────────────────────────── */

/**
 * Prueba la conexión con Chatwoot y devuelve datos de diagnóstico SIN exponer el
 * token (solo si está presente y su longitud). Ayuda a distinguir un problema de
 * config/descifrado (token ausente) de un token inválido (401 con token presente).
 */
export async function cwDiagnostico(): Promise<
  { ok: true; data: CwDiagnostico } | { ok: false; error: string }
> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  const cfg = await getIntegracion("chatwoot");
  const rawUrl = cfg.ajuste("url") ?? "";
  const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/api\/v\d+$/, "");
  const accountId = cfg.ajuste("account_id") ?? "";
  const token = cfg.secreto("api_token") ?? "";
  const baseUrl = `${url}/api/v1/accounts/${accountId}`;

  const test = await cwRequest<unknown>("GET", "/agents");
  return {
    ok: true,
    data: {
      baseUrl,
      accountId,
      tokenPresente: token.length > 0,
      tokenLongitud: token.length,
      status: test.ok ? 200 : (test.status ?? null),
      ok: test.ok,
      mensaje: test.ok ? "Conexión correcta." : test.error,
    },
  };
}

/* ── Agentes ──────────────────────────────────────────────────────────────── */

const rolAgente = z.enum(["agent", "administrator"]);
const disponibilidad = z.enum(["available", "busy", "offline"]);

export async function cwListAgents(): Promise<CwResult<ChatwootAgent[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarAgentesCw();
}

const crearAgenteSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio."),
  email: z.string().trim().email("Correo no válido."),
  role: rolAgente,
  availability_status: disponibilidad.optional(),
});
export async function cwCreateAgent(input: unknown): Promise<CwResult<ChatwootAgent>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = crearAgenteSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearAgenteCw(p.data);
}

const actualizarAgenteSchema = z.object({
  role: rolAgente.optional(),
  availability_status: disponibilidad.optional(),
});
export async function cwUpdateAgent(id: number, input: unknown): Promise<CwResult<ChatwootAgent>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = actualizarAgenteSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarAgenteCw(id, p.data);
}
export async function cwDeleteAgent(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarAgenteCw(id);
}

/* ── Inboxes + colaboradores ──────────────────────────────────────────────── */

export async function cwListInboxes(): Promise<CwResult<CwInbox[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarInboxesCw();
}
export async function cwListInboxMembers(inboxId: number): Promise<CwResult<ChatwootAgent[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarMiembrosInboxCw(inboxId);
}
const userIds = z.array(z.number().int().positive());
export async function cwSetInboxMembers(inboxId: number, ids: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = userIds.safeParse(ids);
  if (!p.success) return errorZod(p.error);
  return cw.fijarMiembrosInboxCw(inboxId, p.data);
}

/* ── Equipos + miembros ───────────────────────────────────────────────────── */

export async function cwListTeams(): Promise<CwResult<CwTeam[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarEquiposCw();
}
const equipoSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio."),
  description: z.string().trim().max(500).optional(),
  allow_auto_assign: z.boolean().optional(),
});
export async function cwCreateTeam(input: unknown): Promise<CwResult<CwTeam>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = equipoSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearEquipoCw(p.data);
}
export async function cwUpdateTeam(id: number, input: unknown): Promise<CwResult<CwTeam>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = equipoSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarEquipoCw(id, p.data);
}
export async function cwDeleteTeam(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarEquipoCw(id);
}
export async function cwListTeamMembers(teamId: number): Promise<CwResult<ChatwootAgent[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarMiembrosEquipoCw(teamId);
}
export async function cwSetTeamMembers(teamId: number, ids: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = userIds.safeParse(ids);
  if (!p.success) return errorZod(p.error);
  return cw.fijarMiembrosEquipoCw(teamId, p.data);
}

/* ── Respuestas predefinidas ──────────────────────────────────────────────── */

export async function cwListCanned(): Promise<CwResult<CwCannedResponse[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarCannedCw();
}
const cannedSchema = z.object({
  short_code: z.string().trim().min(1, "Atajo obligatorio."),
  content: z.string().trim().min(1, "Contenido obligatorio."),
});
export async function cwCreateCanned(input: unknown): Promise<CwResult<CwCannedResponse>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = cannedSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearCannedCw(p.data);
}
export async function cwUpdateCanned(id: number, input: unknown): Promise<CwResult<CwCannedResponse>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = cannedSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarCannedCw(id, p.data);
}
export async function cwDeleteCanned(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarCannedCw(id);
}

/* ── Etiquetas ────────────────────────────────────────────────────────────── */

export async function cwListLabels(): Promise<CwResult<CwLabel[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarLabelsCw();
}
const labelSchema = z.object({
  title: z.string().trim().min(1, "Título obligatorio."),
  description: z.string().trim().max(300).optional(),
  color: z.string().trim().optional(),
  show_on_sidebar: z.boolean().optional(),
});
export async function cwCreateLabel(input: unknown): Promise<CwResult<CwLabel>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = labelSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearLabelCw(p.data);
}
export async function cwUpdateLabel(id: number, input: unknown): Promise<CwResult<CwLabel>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = labelSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarLabelCw(id, p.data);
}
export async function cwDeleteLabel(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarLabelCw(id);
}

/* ── Atributos personalizados ─────────────────────────────────────────────── */

export async function cwListCustomAttrs(): Promise<CwResult<CwCustomAttribute[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarCustomAttrsCw();
}
const crearAttrSchema = z.object({
  attribute_display_name: z.string().trim().min(1, "Nombre obligatorio."),
  attribute_display_type: z.enum(["text", "number", "link", "date", "list", "checkbox"]),
  attribute_model: z.enum(["conversation_attribute", "contact_attribute"]),
  attribute_description: z.string().trim().max(300).optional(),
  attribute_values: z.array(z.string().trim().min(1)).optional(),
});
export async function cwCreateCustomAttr(input: unknown): Promise<CwResult<CwCustomAttribute>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = crearAttrSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearCustomAttrCw(p.data);
}
const actualizarAttrSchema = z.object({
  attribute_display_name: z.string().trim().min(1, "Nombre obligatorio."),
  attribute_description: z.string().trim().max(300).optional(),
  attribute_values: z.array(z.string().trim().min(1)).optional(),
});
export async function cwUpdateCustomAttr(id: number, input: unknown): Promise<CwResult<CwCustomAttribute>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = actualizarAttrSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarCustomAttrCw(id, p.data);
}
export async function cwDeleteCustomAttr(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarCustomAttrCw(id);
}

/* ── Webhooks ─────────────────────────────────────────────────────────────── */

export async function cwListWebhooks(): Promise<CwResult<CwWebhook[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarWebhooksCw();
}
const webhookSchema = z.object({
  url: z.string().trim().url("URL no válida."),
  subscriptions: z.array(z.string()).min(1, "Selecciona al menos un evento."),
});
export async function cwCreateWebhook(input: unknown): Promise<CwResult<CwWebhook>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = webhookSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearWebhookCw(p.data);
}
export async function cwUpdateWebhook(id: number, input: unknown): Promise<CwResult<CwWebhook>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = webhookSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarWebhookCw(id, p.data);
}
export async function cwDeleteWebhook(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarWebhookCw(id);
}

/* ── Contactos ────────────────────────────────────────────────────────────── */

export async function cwListContacts(page = 1): Promise<CwResult<CwPagina<CwContact>>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarContactosCw(page);
}
export async function cwSearchContacts(q: string, page = 1): Promise<CwResult<CwPagina<CwContact>>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  const term = (q ?? "").trim();
  if (term === "") return cw.listarContactosCw(page);
  return cw.buscarContactosCw(term, page);
}
const contactoSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email("Correo no válido.").optional().or(z.literal("")),
    phone_number: z.string().trim().max(40).optional(),
    identifier: z.string().trim().max(120).optional(),
  })
  .refine((d) => (d.name && d.name.length > 0) || (d.email && d.email.length > 0) || (d.phone_number && d.phone_number.length > 0), {
    message: "Indica al menos nombre, correo o teléfono.",
  });
export async function cwCreateContact(input: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = contactoSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearContactoCw(p.data);
}
export async function cwUpdateContact(id: number, input: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = contactoSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarContactoCw(id, p.data);
}
export async function cwDeleteContact(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarContactoCw(id);
}

/* ── Conversaciones + mensajes ────────────────────────────────────────────── */

export async function cwListConversations(input: {
  status?: string;
  page?: number;
}): Promise<CwResult<CwConversation[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarConversacionesCw(input ?? {});
}
export async function cwGetConversation(id: number): Promise<CwResult<CwConversation>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.getConversacionCw(id);
}
export async function cwListMessages(id: number): Promise<CwResult<CwMessage[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarMensajesCw(id);
}
const mensajeSchema = z.object({
  content: z.string().trim().min(1, "Escribe un mensaje."),
  private: z.boolean().optional(),
});
export async function cwSendMessage(convId: number, input: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = mensajeSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.enviarMensajeCw(convId, p.data.content, p.data.private ?? false);
}
const estadoSchema = z.enum(["open", "resolved", "pending", "snoozed"]);
export async function cwSetConversationStatus(convId: number, status: unknown): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = estadoSchema.safeParse(status);
  if (!p.success) return errorZod(p.error);
  return cw.cambiarEstadoConversacionCw(convId, p.data);
}
/** assigneeId = 0 libera (sin asignar). */
export async function cwAssignConversation(convId: number, assigneeId: number): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const id = Number.isFinite(assigneeId) ? Math.trunc(assigneeId) : 0;
  return cw.asignarConversacionCw(convId, { assignee_id: id });
}
export async function cwAssignConversationTeam(convId: number, teamId: number): Promise<CwResult<unknown>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.asignarConversacionCw(convId, { team_id: Math.trunc(teamId) });
}

/* ── Automatizaciones ─────────────────────────────────────────────────────── */

export async function cwListAutomations(): Promise<CwResult<CwAutomationRule[]>> {
  if (!(await autorizado("view"))) return NO_AUTORIZADO;
  return cw.listarAutomationsCw();
}
const condicionSchema = z.object({
  attribute_key: z.string().trim().min(1),
  filter_operator: z.string().trim().min(1),
  values: z.array(z.union([z.string(), z.number()])),
  query_operator: z.enum(["and", "or"]).nullable().optional(),
});
const accionSchema = z.object({
  action_name: z.string().trim().min(1),
  action_params: z.array(z.union([z.string(), z.number()])),
});
const automationSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio."),
  description: z.string().trim().max(500).optional(),
  event_name: z.string().trim().min(1, "Evento obligatorio."),
  active: z.boolean().optional(),
  conditions: z.array(condicionSchema).min(1, "Agrega al menos una condición."),
  actions: z.array(accionSchema).min(1, "Agrega al menos una acción."),
});
export async function cwCreateAutomation(input: unknown): Promise<CwResult<CwAutomationRule>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = automationSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.crearAutomationCw(p.data);
}
export async function cwUpdateAutomation(id: number, input: unknown): Promise<CwResult<CwAutomationRule>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const p = automationSchema.safeParse(input);
  if (!p.success) return errorZod(p.error);
  return cw.actualizarAutomationCw(id, p.data);
}
export async function cwToggleAutomation(id: number, active: boolean): Promise<CwResult<CwAutomationRule>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.actualizarAutomationCw(id, { active });
}
export async function cwDeleteAutomation(id: number): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  return cw.eliminarAutomationCw(id);
}

/* ── Tiempo real (webhook entrante) ───────────────────────────────────────── */

const RT_EVENTOS = [
  "message_created",
  "message_updated",
  "conversation_created",
  "conversation_status_changed",
  "conversation_updated",
];
const RT_PATH = "/api/webhooks/chatwoot";

/** URL pública base de la app (desde las cabeceras de la petición). */
async function baseUrlApp(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Devuelve el secreto del webhook entrante; lo genera y guarda cifrado si falta. */
async function asegurarWebhookSecret(): Promise<string | null> {
  const integ = await getIntegracion("chatwoot");
  const actual = integ.secreto("webhook_secret");
  if (actual && actual.length > 0) return actual;
  try {
    const secret = randomBytes(24).toString("hex");
    const blob = cifrarSecreto("chatwoot:webhook_secret", secret);
    const [row] = await db
      .select({ secretos: schema.integraciones.secretos })
      .from(schema.integraciones)
      .where(eq(schema.integraciones.clave, "chatwoot"))
      .limit(1);
    if (!row) return null; // la integración chatwoot debe existir
    const secretos = { ...((row.secretos as Record<string, unknown>) ?? {}), webhook_secret: blob };
    await db
      .update(schema.integraciones)
      .set({ secretos, updatedAt: new Date().toISOString() })
      .where(eq(schema.integraciones.clave, "chatwoot"));
    invalidarConfig("chatwoot");
    return secret;
  } catch {
    return null;
  }
}

/** Estado del tiempo real: si ya existe un webhook apuntando a nuestra ruta. */
export async function cwEstadoTiempoReal(): Promise<
  { ok: true; data: { registrado: boolean; url: string } } | { ok: false; error: string }
> {
  if (!(await autorizado("view"))) return { ok: false, error: "No autorizado." };
  const base = await baseUrlApp();
  const prefijo = `${base}${RT_PATH}`;
  const list = await cw.listarWebhooksCw();
  if (!list.ok) return list;
  const existe = list.data.some((w) => (w.url ?? "").startsWith(prefijo));
  return { ok: true, data: { registrado: existe, url: prefijo } };
}

/**
 * Conecta el tiempo real: asegura el secreto, arma la URL entrante y registra (o
 * actualiza) el webhook en Chatwoot vía API con los eventos relevantes.
 */
export async function cwConectarTiempoReal(): Promise<
  { ok: true; data: { url: string } } | { ok: false; error: string }
> {
  if (!(await autorizado("edit"))) return { ok: false, error: "No autorizado." };
  const secret = await asegurarWebhookSecret();
  if (!secret) return { ok: false, error: "No se pudo preparar el secreto (¿falta CONFIG_ENC_KEY?)." };

  const base = await baseUrlApp();
  const prefijo = `${base}${RT_PATH}`;
  const url = `${prefijo}?token=${encodeURIComponent(secret)}`;

  const list = await cw.listarWebhooksCw();
  if (list.ok) {
    const existente = list.data.find((w) => (w.url ?? "").startsWith(prefijo));
    if (existente) {
      const r = await cw.actualizarWebhookCw(existente.id, { url, subscriptions: RT_EVENTOS });
      return r.ok ? { ok: true, data: { url: prefijo } } : r;
    }
  }
  const r = await cw.crearWebhookCw({ url, subscriptions: RT_EVENTOS });
  return r.ok ? { ok: true, data: { url: prefijo } } : r;
}

/** Desconecta el tiempo real: elimina los webhooks que apuntan a nuestra ruta. */
export async function cwDesconectarTiempoReal(): Promise<CwResult<null>> {
  if (!(await autorizado("edit"))) return NO_AUTORIZADO;
  const base = await baseUrlApp();
  const prefijo = `${base}${RT_PATH}`;
  const list = await cw.listarWebhooksCw();
  if (!list.ok) return list;
  for (const w of list.data.filter((x) => (x.url ?? "").startsWith(prefijo))) {
    await cw.eliminarWebhookCw(w.id);
  }
  return { ok: true, data: null };
}
