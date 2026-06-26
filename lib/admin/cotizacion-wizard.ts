/**
 * Lógica PURA del wizard de cotización (sin I/O) → client-safe.
 * Define el orden de pasos (Sistema primero) y el gating: qué completa el paso
 * Sistema (habilita las demás pestañas) y cuándo la cotización está "lista" para
 * enviarse/cerrarse.
 */

export interface WizardTab {
  id: "sistema" | "partidas" | "documentos" | "historial";
  label: string;
}

/** Orden del wizard: Sistema es el paso 1. */
export const WIZARD_TABS: ReadonlyArray<WizardTab> = [
  { id: "sistema", label: "Sistema" },
  { id: "partidas", label: "Partidas" },
  { id: "documentos", label: "Documentos" },
  { id: "historial", label: "Historial" },
];

/** Pestañas que quedan bloqueadas hasta completar el paso Sistema. */
export const TABS_BLOQUEABLES: ReadonlySet<WizardTab["id"]> = new Set([
  "partidas",
  "documentos",
  "historial",
]);

/**
 * El paso Sistema está completo cuando hay capacidad, paneles, esquema CFE y
 * moneda. Esto habilita el resto de pestañas del wizard.
 */
export function isSistemaCompleto(c: {
  capacidadKwp: number | null;
  paneles: number | null;
  esquema: string | null;
  moneda: string | null;
}): boolean {
  return (
    (c.capacidadKwp ?? 0) > 0 &&
    (c.paneles ?? 0) >= 1 &&
    Boolean(c.esquema) &&
    Boolean(c.moneda && c.moneda.trim().length > 0)
  );
}

export interface CotizacionListaResult {
  lista: boolean;
  faltantes: string[];
}

/**
 * ¿La cotización está lista para enviarse/cerrarse? Requiere el paso Sistema
 * completo, al menos una partida y total > 0. (El correo del cliente lo valida
 * el servidor al enviar.)
 */
export function evaluarCotizacionLista(args: {
  sistemaCompleto: boolean;
  itemsCount: number;
  total: number;
}): CotizacionListaResult {
  const faltantes: string[] = [];
  if (!args.sistemaCompleto) faltantes.push("Completa el paso Sistema");
  if (args.itemsCount < 1) faltantes.push("Agrega al menos una partida");
  if (!(args.total > 0)) faltantes.push("El total debe ser mayor a 0");
  return { lista: faltantes.length === 0, faltantes };
}
