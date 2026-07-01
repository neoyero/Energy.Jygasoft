import { cwRequest, type CwResult } from "@/lib/chatwoot/client";
import type {
  ChatwootAgent,
  CwInbox,
  CwTeam,
  CwCannedResponse,
  CwLabel,
  CwCustomAttribute,
  CwWebhook,
} from "@/lib/chatwoot/types";

/**
 * Funciones tipadas por recurso de la Application API de Chatwoot. Server-only
 * (usan cwRequest, que resuelve el token desde la BD). No lanzan: {ok,data|error}.
 * Las listas de Chatwoot a veces vienen envueltas en { payload: [...] } y otras
 * como array crudo; `unwrap` normaliza ambos casos.
 */

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { payload?: unknown }).payload)) {
    return (data as { payload: T[] }).payload;
  }
  return [];
}

async function lista<T>(path: string): Promise<CwResult<T[]>> {
  const r = await cwRequest<unknown>("GET", path);
  return r.ok ? { ok: true, data: unwrap<T>(r.data) } : r;
}

/* ── Agentes ──────────────────────────────────────────────────────────────── */

export function listarAgentesCw(): Promise<CwResult<ChatwootAgent[]>> {
  return lista<ChatwootAgent>("/agents");
}
export function crearAgenteCw(body: {
  name: string;
  email: string;
  role: "agent" | "administrator";
  availability_status?: "available" | "busy" | "offline";
}): Promise<CwResult<ChatwootAgent>> {
  return cwRequest<ChatwootAgent>("POST", "/agents", body);
}
export function actualizarAgenteCw(
  id: number,
  body: { role?: "agent" | "administrator"; availability_status?: "available" | "busy" | "offline" },
): Promise<CwResult<ChatwootAgent>> {
  return cwRequest<ChatwootAgent>("PATCH", `/agents/${id}`, body);
}
export function eliminarAgenteCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/agents/${id}`);
}

/* ── Inboxes + colaboradores ──────────────────────────────────────────────── */

export function listarInboxesCw(): Promise<CwResult<CwInbox[]>> {
  return lista<CwInbox>("/inboxes");
}
export function listarMiembrosInboxCw(inboxId: number): Promise<CwResult<ChatwootAgent[]>> {
  return lista<ChatwootAgent>(`/inbox_members/${inboxId}`);
}
/** Reemplaza el conjunto de agentes del inbox (deja solo los enviados). */
export function fijarMiembrosInboxCw(inboxId: number, userIds: number[]): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("PATCH", "/inbox_members", { inbox_id: inboxId, user_ids: userIds });
}

/* ── Equipos + miembros ───────────────────────────────────────────────────── */

export function listarEquiposCw(): Promise<CwResult<CwTeam[]>> {
  return lista<CwTeam>("/teams");
}
export function crearEquipoCw(body: {
  name: string;
  description?: string;
  allow_auto_assign?: boolean;
}): Promise<CwResult<CwTeam>> {
  return cwRequest<CwTeam>("POST", "/teams", body);
}
export function actualizarEquipoCw(
  id: number,
  body: { name: string; description?: string; allow_auto_assign?: boolean },
): Promise<CwResult<CwTeam>> {
  return cwRequest<CwTeam>("PATCH", `/teams/${id}`, body);
}
export function eliminarEquipoCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/teams/${id}`);
}
export function listarMiembrosEquipoCw(teamId: number): Promise<CwResult<ChatwootAgent[]>> {
  return lista<ChatwootAgent>(`/teams/${teamId}/team_members`);
}
/** Reemplaza los miembros del equipo (deja solo los enviados). */
export function fijarMiembrosEquipoCw(teamId: number, userIds: number[]): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("PATCH", `/teams/${teamId}/team_members`, { user_ids: userIds });
}

/* ── Respuestas predefinidas ──────────────────────────────────────────────── */

export function listarCannedCw(): Promise<CwResult<CwCannedResponse[]>> {
  return lista<CwCannedResponse>("/canned_responses");
}
export function crearCannedCw(body: {
  short_code: string;
  content: string;
}): Promise<CwResult<CwCannedResponse>> {
  return cwRequest<CwCannedResponse>("POST", "/canned_responses", body);
}
export function actualizarCannedCw(
  id: number,
  body: { short_code: string; content: string },
): Promise<CwResult<CwCannedResponse>> {
  return cwRequest<CwCannedResponse>("PATCH", `/canned_responses/${id}`, body);
}
export function eliminarCannedCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/canned_responses/${id}`);
}

/* ── Etiquetas ────────────────────────────────────────────────────────────── */

export function listarLabelsCw(): Promise<CwResult<CwLabel[]>> {
  return lista<CwLabel>("/labels");
}
export function crearLabelCw(body: {
  title: string;
  description?: string;
  color?: string;
  show_on_sidebar?: boolean;
}): Promise<CwResult<CwLabel>> {
  return cwRequest<CwLabel>("POST", "/labels", body);
}
export function actualizarLabelCw(
  id: number,
  body: { title: string; description?: string; color?: string; show_on_sidebar?: boolean },
): Promise<CwResult<CwLabel>> {
  return cwRequest<CwLabel>("PATCH", `/labels/${id}`, body);
}
export function eliminarLabelCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/labels/${id}`);
}

/* ── Atributos personalizados ─────────────────────────────────────────────── */

export function listarCustomAttrsCw(): Promise<CwResult<CwCustomAttribute[]>> {
  return lista<CwCustomAttribute>("/custom_attribute_definitions");
}
export function crearCustomAttrCw(body: {
  attribute_display_name: string;
  attribute_display_type: string;
  attribute_model: string;
  attribute_description?: string;
  attribute_values?: string[];
}): Promise<CwResult<CwCustomAttribute>> {
  return cwRequest<CwCustomAttribute>("POST", "/custom_attribute_definitions", body);
}
export function actualizarCustomAttrCw(
  id: number,
  body: {
    attribute_display_name: string;
    attribute_description?: string;
    attribute_values?: string[];
  },
): Promise<CwResult<CwCustomAttribute>> {
  return cwRequest<CwCustomAttribute>("PATCH", `/custom_attribute_definitions/${id}`, body);
}
export function eliminarCustomAttrCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/custom_attribute_definitions/${id}`);
}

/* ── Webhooks ─────────────────────────────────────────────────────────────── */

export function listarWebhooksCw(): Promise<CwResult<CwWebhook[]>> {
  const norm = async (): Promise<CwResult<CwWebhook[]>> => {
    const r = await cwRequest<unknown>("GET", "/webhooks");
    if (!r.ok) return r;
    // Chatwoot devuelve { payload: { webhooks: [...] } } en algunas versiones.
    const d = r.data as { payload?: { webhooks?: CwWebhook[] } | CwWebhook[] };
    const p = d?.payload;
    const arr = Array.isArray(p) ? p : Array.isArray(p?.webhooks) ? p.webhooks : unwrap<CwWebhook>(r.data);
    return { ok: true, data: arr };
  };
  return norm();
}
export function crearWebhookCw(body: {
  url: string;
  subscriptions: string[];
}): Promise<CwResult<CwWebhook>> {
  return cwRequest<CwWebhook>("POST", "/webhooks", body);
}
export function actualizarWebhookCw(
  id: number,
  body: { url: string; subscriptions: string[] },
): Promise<CwResult<CwWebhook>> {
  return cwRequest<CwWebhook>("PATCH", `/webhooks/${id}`, body);
}
export function eliminarWebhookCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/webhooks/${id}`);
}
