/**
 * Tipos y constantes de Chatwoot compartidos entre el cliente server-only
 * (admin.ts) y la UI. Este módulo NO importa nada server (sin token/DB), por lo
 * que es seguro importarlo desde componentes cliente.
 */

export interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  role: string;
  confirmed?: boolean;
  availability_status?: string;
}

export interface CwInbox {
  id: number;
  name: string;
  channel_type?: string;
  phone_number?: string;
  website_url?: string;
}

export interface CwTeam {
  id: number;
  name: string;
  description?: string | null;
  allow_auto_assign?: boolean;
}

export interface CwCannedResponse {
  id: number;
  short_code: string;
  content: string;
}

export interface CwLabel {
  id: number;
  title: string;
  description?: string | null;
  color?: string | null;
  show_on_sidebar?: boolean;
}

export interface CwCustomAttribute {
  id: number;
  attribute_display_name: string;
  attribute_key: string;
  attribute_display_type: string; // text | number | link | date | list | checkbox
  attribute_model: string; // conversation_attribute | contact_attribute
  attribute_description?: string | null;
  attribute_values?: string[];
}

export interface CwWebhook {
  id: number;
  url: string;
  subscriptions: string[];
}

/** Eventos de webhook disponibles en Chatwoot (para la UI). */
export const WEBHOOK_EVENTOS: string[] = [
  "conversation_created",
  "conversation_status_changed",
  "conversation_updated",
  "message_created",
  "message_updated",
  "webwidget_triggered",
  "contact_created",
  "contact_updated",
  "conversation_typing_on",
  "conversation_typing_off",
];

/* ── Fase 2: Contactos, Conversaciones, Automatizaciones ──────────────────── */

export interface CwContact {
  id: number
  name?: string | null
  email?: string | null
  phone_number?: string | null
  identifier?: string | null
}

export interface CwPagina<T> {
  items: T[]
  total: number
  page: number
}

/** Estados de una conversación. */
export const CONVERSACION_ESTADOS = ["open", "pending", "snoozed", "resolved"] as const
export type ConversacionEstado = (typeof CONVERSACION_ESTADOS)[number]

export const ESTADO_LABEL: Record<string, string> = {
  open: "Abierta",
  pending: "Pendiente",
  snoozed: "Pospuesta",
  resolved: "Resuelta",
}

export interface CwConversation {
  id: number
  status: string
  inbox_id?: number
  created_at?: number
  contactoNombre?: string | null
  contactoEmail?: string | null
  contactoTelefono?: string | null
  asignadoId?: number | null
  asignadoNombre?: string | null
  ultimoMensaje?: string | null
}

export interface CwMessage {
  id: number
  content: string | null
  /** 0=incoming, 1=outgoing, 2=activity, 3=template. */
  message_type: number
  private?: boolean
  created_at?: number
  senderNombre?: string | null
}

export interface CwAutomationCondition {
  attribute_key: string
  filter_operator: string
  values: Array<string | number>
  query_operator?: "and" | "or" | null
  custom_attribute_type?: string
}
export interface CwAutomationAction {
  action_name: string
  action_params: Array<string | number>
}
export interface CwAutomationRule {
  id: number
  name: string
  description?: string | null
  event_name: string
  active: boolean
  conditions: CwAutomationCondition[]
  actions: CwAutomationAction[]
}

/** Eventos que disparan una automatización. */
export const AUTOMATION_EVENTOS: { value: string; label: string }[] = [
  { value: "conversation_created", label: "Conversación creada" },
  { value: "conversation_updated", label: "Conversación actualizada" },
  { value: "message_created", label: "Mensaje creado" },
  { value: "conversation_opened", label: "Conversación abierta" },
]

/** Operadores de condición más comunes. */
export const AUTOMATION_OPERADORES: string[] = [
  "equal_to",
  "not_equal_to",
  "contains",
  "does_not_contain",
  "is_present",
  "is_not_present",
  "starts_with",
]

/** Acciones más comunes (action_name). */
export const AUTOMATION_ACCIONES: { value: string; label: string }[] = [
  { value: "assign_agent", label: "Asignar a agente (id)" },
  { value: "assign_team", label: "Asignar a equipo (id)" },
  { value: "add_label", label: "Agregar etiqueta (título)" },
  { value: "change_status", label: "Cambiar estado (open/resolved/…)" },
  { value: "send_email_to_team", label: "Enviar correo al equipo (id)" },
  { value: "mute_conversation", label: "Silenciar conversación" },
  { value: "snooze_conversation", label: "Posponer conversación" },
]

/** Diagnóstico de conexión con Chatwoot (sin exponer el token). */
export interface CwDiagnostico {
  baseUrl: string;
  accountId: string;
  tokenPresente: boolean;
  tokenLongitud: number;
  status: number | null;
  ok: boolean;
  mensaje: string;
}

/** Tipos de dato de un atributo personalizado. */
export const CUSTOM_ATTR_TIPOS: string[] = ["text", "number", "link", "date", "list", "checkbox"];

/** Modelos a los que aplica un atributo personalizado. */
export const CUSTOM_ATTR_MODELOS: { value: string; label: string }[] = [
  { value: "conversation_attribute", label: "Conversación" },
  { value: "contact_attribute", label: "Contacto" },
];
