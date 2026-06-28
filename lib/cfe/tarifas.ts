/**
 * Catálogo de tarifas CFE usado en el panel (cliente, wizard de cotización).
 * Los `value` están alineados con el motor de cálculo (resolveCalcConfig en
 * lib/calc-config.ts): residencial → "1", alto consumo → "DAC", negocio BT →
 * "PDBT", media tensión → "GDMTO". El precio $/kWh de cada tarifa vive en BD
 * (config_parametros / tarifas_cfe); aquí solo se clasifica el servicio.
 */

export interface TarifaCfe {
  value: string;
  label: string;
}

/** Categorías tarifarias seleccionables (sin la opción vacía "Sin especificar"). */
export const TARIFAS_CFE: ReadonlyArray<TarifaCfe> = [
  { value: "1", label: "Doméstica (1, 1A…1F)" },
  { value: "DAC", label: "DAC (doméstica alto consumo)" },
  { value: "PDBT", label: "PDBT (negocio baja tensión)" },
  { value: "GDMTO", label: "GDMTO (media tensión)" },
];

/** Valores válidos (para validación o normalización). */
export const TARIFA_VALUES: ReadonlyArray<string> = TARIFAS_CFE.map((t) => t.value);
