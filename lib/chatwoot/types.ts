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

/** Tipos de dato de un atributo personalizado. */
export const CUSTOM_ATTR_TIPOS: string[] = ["text", "number", "link", "date", "list", "checkbox"];

/** Modelos a los que aplica un atributo personalizado. */
export const CUSTOM_ATTR_MODELOS: { value: string; label: string }[] = [
  { value: "conversation_attribute", label: "Conversación" },
  { value: "contact_attribute", label: "Contacto" },
];
