import { cwRequest, type CwResult } from "@/lib/chatwoot/client";
import type {
  ChatwootAgent,
  CwInbox,
  CwTeam,
  CwCannedResponse,
  CwLabel,
  CwCustomAttribute,
  CwWebhook,
  CwContact,
  CwPagina,
  CwConversation,
  CwMessage,
  CwAutomationRule,
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

/* ── Contactos ────────────────────────────────────────────────────────────── */

interface RawContacto {
  id: number;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  identifier?: string | null;
}
function mapContacto(c: RawContacto): CwContact {
  return {
    id: c.id,
    name: c.name ?? null,
    email: c.email ?? null,
    phone_number: c.phone_number ?? null,
    identifier: c.identifier ?? null,
  };
}
interface RespContactos {
  payload?: RawContacto[];
  meta?: { count?: number };
}

export async function listarContactosCw(page = 1): Promise<CwResult<CwPagina<CwContact>>> {
  const r = await cwRequest<RespContactos>("GET", `/contacts?page=${page}&sort=name`);
  if (!r.ok) return r;
  const items = (r.data?.payload ?? []).map(mapContacto);
  return { ok: true, data: { items, total: Number(r.data?.meta?.count ?? items.length), page } };
}
export async function buscarContactosCw(q: string, page = 1): Promise<CwResult<CwPagina<CwContact>>> {
  const r = await cwRequest<RespContactos>(
    "GET",
    `/contacts/search?q=${encodeURIComponent(q)}&page=${page}&sort=name`,
  );
  if (!r.ok) return r;
  const items = (r.data?.payload ?? []).map(mapContacto);
  return { ok: true, data: { items, total: Number(r.data?.meta?.count ?? items.length), page } };
}
export function crearContactoCw(body: {
  name?: string;
  email?: string;
  phone_number?: string;
  identifier?: string;
}): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("POST", "/contacts", body);
}
export function actualizarContactoCw(
  id: number,
  body: { name?: string; email?: string; phone_number?: string; identifier?: string },
): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("PUT", `/contacts/${id}`, body);
}
export function eliminarContactoCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/contacts/${id}`);
}

/* ── Conversaciones + mensajes ────────────────────────────────────────────── */

interface RawConv {
  id: number;
  status: string;
  inbox_id?: number;
  created_at?: number;
  meta?: {
    sender?: { name?: string | null; email?: string | null; phone_number?: string | null };
    assignee?: { id: number; name?: string | null } | null;
  };
  last_non_activity_message?: { content?: string | null } | null;
}
function mapConv(c: RawConv): CwConversation {
  return {
    id: c.id,
    status: c.status,
    inbox_id: c.inbox_id,
    created_at: c.created_at,
    contactoNombre: c.meta?.sender?.name ?? null,
    contactoEmail: c.meta?.sender?.email ?? null,
    contactoTelefono: c.meta?.sender?.phone_number ?? null,
    asignadoId: c.meta?.assignee?.id ?? null,
    asignadoNombre: c.meta?.assignee?.name ?? null,
    ultimoMensaje: c.last_non_activity_message?.content ?? null,
  };
}

export async function listarConversacionesCw(params: {
  status?: string;
  page?: number;
}): Promise<CwResult<CwConversation[]>> {
  const page = params.page ?? 1;
  const status = params.status && params.status !== "all" ? `&status=${params.status}` : "&status=all";
  const r = await cwRequest<{ data?: { payload?: RawConv[] } }>(
    "GET",
    `/conversations?assignee_type=all&page=${page}${status}`,
  );
  if (!r.ok) return r;
  return { ok: true, data: (r.data?.data?.payload ?? []).map(mapConv) };
}

export async function getConversacionCw(id: number): Promise<CwResult<CwConversation>> {
  const r = await cwRequest<RawConv>("GET", `/conversations/${id}`);
  if (!r.ok) return r;
  return { ok: true, data: mapConv(r.data) };
}

interface RawMsg {
  id: number;
  content?: string | null;
  message_type: number;
  private?: boolean;
  created_at?: number;
  sender?: { name?: string | null } | null;
}
export async function listarMensajesCw(convId: number): Promise<CwResult<CwMessage[]>> {
  const r = await cwRequest<{ payload?: RawMsg[] }>("GET", `/conversations/${convId}/messages`);
  if (!r.ok) return r;
  return {
    ok: true,
    data: (r.data?.payload ?? []).map((m) => ({
      id: m.id,
      content: m.content ?? null,
      message_type: m.message_type,
      private: m.private,
      created_at: m.created_at,
      senderNombre: m.sender?.name ?? null,
    })),
  };
}
export function enviarMensajeCw(
  convId: number,
  content: string,
  isPrivate: boolean,
): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("POST", `/conversations/${convId}/messages`, {
    content,
    message_type: "outgoing",
    private: isPrivate,
  });
}
export function cambiarEstadoConversacionCw(convId: number, status: string): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("POST", `/conversations/${convId}/toggle_status`, { status });
}
/** Asigna a un agente (assignee_id) o equipo (team_id). assignee_id:0 = liberar. */
export function asignarConversacionCw(
  convId: number,
  body: { assignee_id: number } | { team_id: number },
): Promise<CwResult<unknown>> {
  return cwRequest<unknown>("POST", `/conversations/${convId}/assignments`, body);
}

/* ── Automatizaciones ─────────────────────────────────────────────────────── */

export function listarAutomationsCw(): Promise<CwResult<CwAutomationRule[]>> {
  return lista<CwAutomationRule>("/automation_rules");
}
export function crearAutomationCw(body: Partial<CwAutomationRule>): Promise<CwResult<CwAutomationRule>> {
  return cwRequest<CwAutomationRule>("POST", "/automation_rules", body);
}
export function actualizarAutomationCw(
  id: number,
  body: Partial<CwAutomationRule>,
): Promise<CwResult<CwAutomationRule>> {
  return cwRequest<CwAutomationRule>("PATCH", `/automation_rules/${id}`, body);
}
export function eliminarAutomationCw(id: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/automation_rules/${id}`);
}
