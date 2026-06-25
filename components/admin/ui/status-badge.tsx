import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusSize = "sm" | "md";

/**
 * Mapa value(enum crudo) -> tono. Cubre TODOS los valores de los enums de
 * estado de db/schema.ts. Claves en minuscula tal cual el enum de Postgres.
 * Se exporta para usar el mismo tono en filtros, kanban y graficas.
 */
export type StatusToneMap = Record<string, StatusTone>;

/** Mapa value -> etiqueta legible en es-MX. Se exporta para selects/leyendas. */
export type StatusLabelMap = Record<string, string>;

export interface StatusBadgeProps {
  /** Valor crudo del enum, ej. "en_nutricion", "oficio_resolutivo", "vencido". */
  value: string;
  /** Sobre-escribe la etiqueta autoderivada del mapa. */
  label?: ReactNode;
  /** Fuerza un tono (ignora el mapa); util para casos ad-hoc. */
  tone?: StatusTone;
  /** Muestra punto de color a la izquierda. Default true. */
  withDot?: boolean;
  /** Tamano del pill. Default "sm". */
  size?: StatusSize;
  className?: string;
}

/** API exportada del modulo (ademas del componente StatusBadge). */
export interface StatusBadgeModuleExports {
  STATUS_TONES: StatusToneMap;
  STATUS_LABELS: StatusLabelMap;
  toneFor: (value: string) => StatusTone;
  labelFor: (value: string) => string;
  TONE_CLASSES: Record<StatusTone, string>;
}

/**
 * Clases por tono (claro/oscuro). Pill semantico unico: emerald=ok, amber=alerta,
 * red=error, sky=informativo, stone/muted=neutro.
 */
export const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400",
  danger:
    "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400",
  neutral:
    "bg-stone-100 text-stone-600 ring-stone-500/20 dark:bg-muted dark:text-muted-foreground",
};

/**
 * Mapa value(enum crudo) -> tono. Cubre EXACTAMENTE los enums de estado de
 * db/schema.ts para que un mismo estado luzca igual en todo el panel.
 */
export const STATUS_TONES: StatusToneMap = {
  // lead_estado
  nuevo: "info",
  sin_calificar: "neutral",
  en_nutricion: "warning",
  calificado: "info",
  asignado: "info",
  convertido: "success",
  perdido: "danger",
  descartado: "neutral",

  // oportunidad_etapa
  calificacion: "neutral",
  levantamiento: "info",
  propuesta: "info",
  negociacion: "warning",
  ganada: "success",
  perdida: "danger",

  // proyecto_fase
  input_comercial: "neutral",
  inicio: "info",
  planeacion: "info",
  ejecucion: "warning",
  seguimiento: "info",
  cierre: "success",
  garantia: "success",

  // tramite_cfe_estado
  pendiente: "neutral",
  solicitud_enviada: "info",
  en_revision_cfe: "info",
  estudio_mt: "warning",
  oficio_resolutivo: "warning",
  contratos_firmados: "info",
  medidor_instalado: "info",
  en_operacion: "success",
  rechazado: "danger",

  // pago_estado
  programado: "info",
  pagado: "success",
  vencido: "danger",
  cancelado: "neutral",

  // instalacion_estado
  planeada: "neutral",
  en_progreso: "warning",
  pausada: "warning",
  completada: "success",

  // cotizacion_estado
  borrador: "neutral",
  enviada: "info",
  aceptada: "success",
  rechazada: "danger",
  expirada: "warning",

  // campana_estado
  activa: "success",
  finalizada: "neutral",

  // actividad_estado
  // 'pendiente', 'completada', 'cancelada' ya cubiertos arriba;
  // se redefinen aqui los que difieren por contexto de actividad.
  // (pendiente como warning en actividades)

  // actividad: pendiente debe ser warning (sobre-escribe el neutral de CFE)
};

/**
 * actividad_estado.pendiente usa tono warning (a diferencia de
 * tramite_cfe_estado.pendiente que es neutral). Como la clave colisiona,
 * mantenemos 'pendiente' como warning porque es el caso predominante en el
 * panel (actividades), y CFE puede forzar tone="neutral" si lo requiere.
 */
STATUS_TONES.pendiente = "warning";

/**
 * Mapa value -> etiqueta legible en es-MX. Se exporta para selects/leyendas.
 * Las claves colisionantes comparten una sola etiqueta coherente.
 */
export const STATUS_LABELS: StatusLabelMap = {
  // lead_estado
  nuevo: "Nuevo",
  sin_calificar: "Sin calificar",
  en_nutricion: "En nutricion",
  calificado: "Calificado",
  asignado: "Asignado",
  convertido: "Convertido",
  perdido: "Perdido",
  descartado: "Descartado",

  // oportunidad_etapa
  calificacion: "Calificacion",
  levantamiento: "Levantamiento",
  propuesta: "Propuesta",
  negociacion: "Negociacion",
  ganada: "Ganada",
  perdida: "Perdida",

  // proyecto_fase
  input_comercial: "Input comercial",
  inicio: "Inicio",
  planeacion: "Planeacion",
  ejecucion: "Ejecucion",
  seguimiento: "Seguimiento",
  cierre: "Cierre",
  garantia: "Garantia",

  // tramite_cfe_estado
  pendiente: "Pendiente",
  solicitud_enviada: "Solicitud enviada",
  en_revision_cfe: "En revision CFE",
  estudio_mt: "Estudio MT",
  oficio_resolutivo: "Oficio resolutivo",
  contratos_firmados: "Contratos firmados",
  medidor_instalado: "Medidor instalado",
  en_operacion: "En operacion",
  rechazado: "Rechazado",

  // pago_estado
  programado: "Programado",
  pagado: "Pagado",
  vencido: "Vencido",
  cancelado: "Cancelado",

  // instalacion_estado
  planeada: "Planeada",
  en_progreso: "En progreso",
  pausada: "Pausada",
  completada: "Completada",

  // cotizacion_estado
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  expirada: "Expirada",

  // campana_estado
  activa: "Activa",
  finalizada: "Finalizada",
};

/** Title-case defensivo: convierte un value crudo en etiqueta legible. */
function titleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Resuelve el tono de un value; fallback a "neutral" ante enums nuevos. */
export function toneFor(value: string): StatusTone {
  return STATUS_TONES[value] ?? "neutral";
}

/** Resuelve la etiqueta de un value; fallback a title-case del propio value. */
export function labelFor(value: string): string {
  return STATUS_LABELS[value] ?? titleCase(value);
}

/** Clases base del pill por tamano. */
const SIZE_CLASSES: Record<StatusSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-[13px]",
};

/**
 * Pill de estado semantico unico para todo el panel. Server component puro:
 * mapea un value crudo de enum a tono + etiqueta es-MX coherente en Leads,
 * Pipeline, Cotizaciones, Proyectos, Tramite CFE, Instalaciones, Pagos,
 * Campanas y Actividades.
 */
export function StatusBadge({
  value,
  label,
  tone,
  withDot = true,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const resolvedTone = tone ?? toneFor(value);
  const resolvedLabel = label ?? labelFor(value);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        SIZE_CLASSES[size],
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      {withDot ? (
        <span
          className="size-1.5 rounded-full bg-current opacity-70"
          aria-hidden="true"
        />
      ) : null}
      {resolvedLabel}
    </span>
  );
}
