/**
 * Cálculo de dimensionamiento y ahorro solar (PURO, sin I/O).
 *
 * Las constantes y tarifas viven en BD (config_parametros, tarifas_cfe, hsp_zonas)
 * y las resuelve la capa lib/calc-config.ts (Fase 4). Esta función recibe valores
 * ya resueltos para ser determinista y trivial de testear.
 *
 * Fórmulas (§6 del spec):
 *   consumo_kwh_mes = recibo_mxn / precioKwh        (si solo dan el recibo)
 *   kwp            = (consumo_kwh_mes/30) / (HSP * PR)
 *   paneles        = ceil(kwp*1000 / WP_PANEL)
 *   prod_anual_kwh = kwp * HSP * 365 * PR
 *   inversion      = [kwp*COSTO_KWP_MIN, kwp*COSTO_KWP_MAX]
 *   ahorro_anual   = min(prod_anual_kwh, consumo_kwh_mes*12) * precioKwh   (conservador)
 *   payback_anios  = inversion_prom / ahorro_anual
 *
 * El precioKwh usado es el RATE MARGINAL por segmento/tarifa
 * (residencial→excedente, DAC→DAC, comercial→PDBT).
 */

export const HSP_FALLBACK = 5.9;

export interface CalcConstants {
  /** Performance Ratio (config_parametros.PR). */
  pr: number;
  /** Potencia por panel en W (config_parametros.WP_PANEL). */
  wpPanel: number;
  /** Costo mínimo por kWp en MXN. */
  costoKwpMin: number;
  /** Costo máximo por kWp en MXN. */
  costoKwpMax: number;
}

export interface CalcInput {
  /** Recibo mensual en MXN (alternativo a consumoKwhMes). */
  reciboMxn?: number;
  /** Consumo mensual en kWh (alternativo a reciboMxn). */
  consumoKwhMes?: number;
  /** Horas Solares Pico de la zona (resuelto por la capa de config; fallback 5.9). */
  hsp?: number;
  /** Precio marginal del kWh (MXN) según segmento/tarifa. */
  precioKwh: number;
}

export interface CalcResult {
  consumoKwhMes: number;
  hsp: number;
  precioKwh: number;
  kwp: number;
  paneles: number;
  produccionAnualKwh: number;
  inversionMin: number;
  inversionMax: number;
  inversionProm: number;
  ahorroAnualMxn: number;
  paybackAnios: number;
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Calcula el dimensionamiento y ahorro. Lanza si los insumos son insuficientes
 * o inválidos (validar antes con Zod en el boundary).
 */
export function calcular(input: CalcInput, constants: CalcConstants): CalcResult {
  const { pr, wpPanel, costoKwpMin, costoKwpMax } = constants;
  const precioKwh = input.precioKwh;
  const hsp = input.hsp && input.hsp > 0 ? input.hsp : HSP_FALLBACK;

  if (!(precioKwh > 0)) throw new Error("precioKwh debe ser > 0");
  if (!(pr > 0) || !(wpPanel > 0)) throw new Error("Constantes inválidas (PR/WP_PANEL)");

  // Derivar consumo desde recibo si hace falta.
  let consumoKwhMes = input.consumoKwhMes;
  if (!(consumoKwhMes && consumoKwhMes > 0)) {
    if (input.reciboMxn && input.reciboMxn > 0) {
      consumoKwhMes = input.reciboMxn / precioKwh;
    } else {
      throw new Error("Proporciona consumoKwhMes o reciboMxn");
    }
  }

  const consumoDiario = consumoKwhMes / 30;
  const kwp = consumoDiario / (hsp * pr);
  const paneles = Math.ceil((kwp * 1000) / wpPanel);
  const produccionAnualKwh = kwp * hsp * 365 * pr;

  const inversionMin = kwp * costoKwpMin;
  const inversionMax = kwp * costoKwpMax;
  const inversionProm = (inversionMin + inversionMax) / 2;

  // Ahorro conservador: no se ahorra más de lo que se consume.
  const kwhAhorrables = Math.min(produccionAnualKwh, consumoKwhMes * 12);
  const ahorroAnualMxn = kwhAhorrables * precioKwh;
  const paybackAnios = ahorroAnualMxn > 0 ? inversionProm / ahorroAnualMxn : Infinity;

  return {
    consumoKwhMes: round(consumoKwhMes),
    hsp: round(hsp),
    precioKwh: round(precioKwh, 4),
    kwp: round(kwp),
    paneles,
    produccionAnualKwh: round(produccionAnualKwh),
    inversionMin: round(inversionMin),
    inversionMax: round(inversionMax),
    inversionProm: round(inversionProm),
    ahorroAnualMxn: round(ahorroAnualMxn),
    paybackAnios: round(paybackAnios),
  };
}
