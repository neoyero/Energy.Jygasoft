import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HSP_FALLBACK, type CalcConstants } from "@/lib/calc";

/**
 * Capa de configuración de la calculadora: LEE constantes y tarifas desde BD
 * (config_parametros, hsp_zonas). El precio del kWh es el RATE MARGINAL por
 * segmento/tarifa (residencial→excedente, DAC→DAC, negocio→PDBT).
 *
 * No expone constantes de costo al cliente (esto corre solo en servidor).
 */

export interface ResolvedCalcConfig {
  constants: CalcConstants;
  precioKwh: number;
  hsp: number;
  tarifa: string;
}

async function loadConfigMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({ clave: schema.configParametros.clave, valor: schema.configParametros.valor })
    .from(schema.configParametros);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.valor !== null) map.set(r.clave, Number(r.valor));
  }
  return map;
}

/**
 * Resuelve el HSP de la zona con prioridad:
 *   1. hsp_zonas por municipio (detalle, ej. Aguascalientes)
 *   2. hsp_estados por estado (estado explícito o derivado del CP)
 *   3. HSP_FALLBACK (global)
 */
async function resolveHsp(args: {
  municipio?: string | null;
  estado?: string | null;
  cp?: string | null;
}): Promise<number> {
  // 1. Municipio (mayor precisión).
  if (args.municipio) {
    const [row] = await db
      .select({ hsp: schema.hspZonas.hsp })
      .from(schema.hspZonas)
      .where(sql`lower(${schema.hspZonas.municipio}) = ${args.municipio.toLowerCase()}`)
      .limit(1);
    if (row?.hsp) return Number(row.hsp);
  }

  // 2. Estado (explícito o derivado del CP vía codigos_postales).
  let estado = args.estado ?? null;
  if (!estado && args.cp && /^\d{5}$/.test(args.cp)) {
    const [row] = await db
      .select({ estado: schema.codigosPostales.dEstado })
      .from(schema.codigosPostales)
      .where(sql`${schema.codigosPostales.dCodigo} = ${args.cp}`)
      .limit(1);
    estado = row?.estado ?? null;
  }
  if (estado) {
    const [row] = await db
      .select({ hsp: schema.hspEstados.hsp })
      .from(schema.hspEstados)
      .where(sql`lower(${schema.hspEstados.estadoMx}) = ${estado.toLowerCase()}`)
      .limit(1);
    if (row?.hsp) return Number(row.hsp);
  }

  // 3. Fallback global.
  return HSP_FALLBACK;
}

function resolvePrecioKwh(
  cfg: Map<string, number>,
  segmento: string,
  tarifa?: string | null,
): { precioKwh: number; tarifa: string } {
  const ref = cfg.get("PRECIO_KWH_REFERENCIA") ?? 4.004;
  const dac = cfg.get("PRECIO_KWH_DAC") ?? 6.752;
  const pdbt = cfg.get("PRECIO_KWH_PDBT") ?? 3.771;

  if (tarifa && tarifa.toUpperCase() === "DAC") {
    return { precioKwh: dac, tarifa: "DAC" };
  }
  if (segmento === "negocio") {
    return { precioKwh: pdbt, tarifa: "PDBT" };
  }
  return { precioKwh: ref, tarifa: "1" };
}

/**
 * Constantes de costeo para itemizar partidas del wizard de cotización.
 * Lee config_parametros con fallbacks (mismos valores que la migración 0005).
 */
export async function resolveCosteoConstants(): Promise<
  import("@/lib/admin/cotizacion-dimensionado").CosteoConstants
> {
  const cfg = await loadConfigMap();
  return {
    precioPanelFallback: cfg.get("PRECIO_PANEL_FALLBACK") ?? 3500,
    precioEstructuraPorPanel: cfg.get("PRECIO_ESTRUCTURA_POR_PANEL") ?? 650,
    costoMaterialElecPorKwp: cfg.get("COSTO_MATERIAL_ELEC_POR_KWP") ?? 1800,
    costoProteccionesPorKwp: cfg.get("COSTO_PROTECCIONES_POR_KWP") ?? 900,
    costoManoObraPorKwp: cfg.get("COSTO_MANO_OBRA_POR_KWP") ?? 2500,
    inversorPrecioPorKwp: cfg.get("INVERSOR_PRECIO_POR_KWP") ?? 2500,
    inversorSizingRatio: cfg.get("INVERSOR_SIZING_RATIO") ?? 0.9,
    inversorKwMax: cfg.get("INVERSOR_KW_MAX") ?? 12,
  };
}

export async function resolveCalcConfig(args: {
  segmento: string;
  municipio?: string | null;
  estado?: string | null;
  cp?: string | null;
  tarifa?: string | null;
}): Promise<ResolvedCalcConfig> {
  const cfg = await loadConfigMap();
  const constants: CalcConstants = {
    pr: cfg.get("PR") ?? 0.77,
    wpPanel: cfg.get("WP_PANEL") ?? 600,
    costoKwpMin: cfg.get("COSTO_KWP_MIN") ?? 14000,
    costoKwpMax: cfg.get("COSTO_KWP_MAX") ?? 17500,
  };
  const { precioKwh, tarifa } = resolvePrecioKwh(cfg, args.segmento, args.tarifa);
  const hsp = await resolveHsp({
    municipio: args.municipio,
    estado: args.estado,
    cp: args.cp,
  });
  return { constants, precioKwh, hsp, tarifa };
}
