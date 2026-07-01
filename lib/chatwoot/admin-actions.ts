"use server";

import { z } from "zod";

import { assertPerm } from "@/lib/admin/guard";
import type { Accion } from "@/lib/admin/rbac";
import type { CwResult, ChatwootAgent } from "@/lib/chatwoot/client";
import type {
  CwInbox,
  CwTeam,
  CwCannedResponse,
  CwLabel,
  CwCustomAttribute,
  CwWebhook,
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
