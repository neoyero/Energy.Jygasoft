import {
  CheckSquare,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react"

/** Icono lucide por tipo de actividad. Fallback CheckSquare ante tipos nuevos. */
export const TIPO_ICON: Record<string, LucideIcon> = {
  llamada: Phone,
  visita: MapPin,
  email: Mail,
  whatsapp: MessageCircle,
  tarea: CheckSquare,
  nota: StickyNote,
  reunion: Users,
}

/** Resuelve el icono de la actividad; fallback a CheckSquare. */
export function iconForTipo(tipo: string): LucideIcon {
  return TIPO_ICON[tipo] ?? CheckSquare
}

/**
 * Tipos de entidad que tienen ficha de detalle navegable y dueño comercial.
 * Son los que se ofrecen al asociar una actividad desde la agenda global.
 */
export const ENTIDAD_PICKER_TIPOS = [
  "lead",
  "cliente",
  "oportunidad",
  "cotizacion",
  "proyecto",
] as const

export type EntidadPickerTipo = (typeof ENTIDAD_PICKER_TIPOS)[number]

/** Etiqueta legible por tipo de entidad. */
export const ENTIDAD_LABEL: Record<string, string> = {
  lead: "Lead",
  cliente: "Cliente",
  oportunidad: "Oportunidad",
  cotizacion: "Cotización",
  proyecto: "Proyecto",
  contacto: "Contacto",
  instalacion: "Instalación",
}

/**
 * Mapa entidadTipo -> segmento de ruta del back-office con ficha de detalle
 * navegable. `oportunidad` se omite a propósito: no tiene página [id] (vive en
 * el pipeline), por lo que sus actividades se asocian pero no son clicables.
 */
const TIPO_RUTA: Record<string, string> = {
  lead: "leads",
  cliente: "clientes",
  cotizacion: "cotizaciones",
  proyecto: "proyectos",
}

/** Devuelve la ruta de detalle de una entidad, o null si no aplica. */
export function rutaEntidad(tipo: string | null, id: string | null): string | null {
  if (!tipo || !id) return null
  const seg = TIPO_RUTA[tipo]
  return seg ? `/je-admin/${seg}/${id}` : null
}

/** "" -> null para columnas opcionales. */
export function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** datetime-local -> ISO; "" o inválido -> null. */
export function venceAtToIso(v: string): string | null {
  const t = v.trim()
  if (t === "") return null
  const date = new Date(t)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** ISO (con zona) -> valor para <input type="datetime-local"> en hora local. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
