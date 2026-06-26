import type { CalcResult } from "@/lib/calc";
import type { CatalogoOption, EquipoTipo } from "@/lib/admin/queries";

/**
 * Itemización/costeo PURO de una cotización (sin I/O). A partir del resultado de
 * dimensionamiento (`calcular` de lib/calc) + el catálogo + las constantes de
 * costeo, produce las partidas sugeridas (paneles, inversor, estructura,
 * material eléctrico, protecciones, mano de obra) y el espejo del sistema.
 * Selección de inversor: por potencia objetivo (kWp×ratio) eligiendo del
 * catálogo el que mejor cubra; si no hay, estimación por kWp.
 */

export interface CosteoConstants {
  precioPanelFallback: number;
  precioEstructuraPorPanel: number;
  costoMaterialElecPorKwp: number;
  costoProteccionesPorKwp: number;
  costoManoObraPorKwp: number;
  inversorPrecioPorKwp: number;
  inversorSizingRatio: number;
  inversorKwMax: number;
}

export type FuentePartida = "catalogo" | "heuristica";

export interface PartidaSugerida {
  equipoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tipo: EquipoTipo | "mano_obra";
  fuente: FuentePartida;
}

export interface DimensionarResult {
  partidas: PartidaSugerida[];
  sistema: {
    capacidadKwp: number;
    paneles: number;
    inversor: string | null;
    produccionAnualKwh: number;
    ahorroAnualMxn: number;
    paybackAnios: number;
  };
  advertencias: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function equipoLabel(e: CatalogoOption, fallback: string): string {
  const partes = [e.marca, e.modelo].filter(Boolean);
  const base = partes.length > 0 ? partes.join(" ") : fallback;
  return e.potenciaWp ? `${base} (${e.potenciaWp} W)` : base;
}

/** Elige el inversor del catálogo que cubre la potencia objetivo (AC). */
function elegirInversor(
  catalogo: ReadonlyArray<CatalogoOption>,
  kwp: number,
  costeo: CosteoConstants,
): { partida: PartidaSugerida; etiqueta: string } {
  const objetivoW = kwp * 1000 * costeo.inversorSizingRatio;
  const candidatos = catalogo
    .filter((e) => e.tipo === "inversor" && (e.potenciaWp ?? 0) > 0)
    .sort((a, b) => (a.potenciaWp ?? 0) - (b.potenciaWp ?? 0));

  // El más pequeño que cubre el objetivo.
  const cubre = candidatos.find((e) => (e.potenciaWp ?? 0) >= objetivoW);
  if (cubre) {
    const etiqueta = equipoLabel(cubre, "Inversor");
    return {
      etiqueta,
      partida: {
        equipoId: cubre.id,
        descripcion: etiqueta,
        cantidad: 1,
        precioUnitario: round2(cubre.precio ?? kwp * costeo.inversorPrecioPorKwp),
        tipo: "inversor",
        fuente: cubre.precio != null ? "catalogo" : "heuristica",
      },
    };
  }

  // Ninguno cubre solo: usar el mayor disponible en cantidad necesaria.
  const mayor = candidatos[candidatos.length - 1];
  if (mayor) {
    const cantidad = Math.max(1, Math.ceil(objetivoW / (mayor.potenciaWp ?? objetivoW)));
    const etiqueta = `${equipoLabel(mayor, "Inversor")} ×${cantidad}`;
    return {
      etiqueta,
      partida: {
        equipoId: mayor.id,
        descripcion: equipoLabel(mayor, "Inversor"),
        cantidad,
        precioUnitario: round2(mayor.precio ?? kwp * costeo.inversorPrecioPorKwp),
        tipo: "inversor",
        fuente: mayor.precio != null ? "catalogo" : "heuristica",
      },
    };
  }

  // Sin inversores en catálogo: estimación por kWp.
  return {
    etiqueta: `Inversor ~${round2(kwp * costeo.inversorSizingRatio)} kW`,
    partida: {
      equipoId: null,
      descripcion: "Inversor (estimado por capacidad)",
      cantidad: 1,
      precioUnitario: round2(kwp * costeo.inversorPrecioPorKwp),
      tipo: "inversor",
      fuente: "heuristica",
    },
  };
}

export function dimensionarCotizacion(args: {
  calc: CalcResult;
  catalogo: ReadonlyArray<CatalogoOption>;
  costeo: CosteoConstants;
  inversionMinMax: { min: number; max: number };
  modelo?: "A" | "B";
}): DimensionarResult {
  const { calc, catalogo, costeo, inversionMinMax } = args;
  const modelo = args.modelo ?? "A";
  const kwp = calc.kwp;
  const paneles = calc.paneles;
  const partidas: PartidaSugerida[] = [];
  const advertencias: string[] = [];

  // 1) Paneles (catálogo o fallback).
  const panel = catalogo.find((e) => e.tipo === "panel" && e.precio != null)
    ?? catalogo.find((e) => e.tipo === "panel");
  partidas.push({
    equipoId: panel?.id ?? null,
    descripcion: panel ? equipoLabel(panel, "Panel solar") : "Panel solar",
    cantidad: paneles,
    precioUnitario: round2(panel?.precio ?? costeo.precioPanelFallback),
    tipo: "panel",
    fuente: panel?.precio != null ? "catalogo" : "heuristica",
  });

  // 2) Inversor (selección por potencia objetivo).
  const inv = elegirInversor(catalogo, kwp, costeo);
  partidas.push(inv.partida);

  if (modelo === "B") {
    // Modelo simple: una sola línea de instalación + materiales por kWp.
    const porKwp =
      costeo.precioEstructuraPorPanel * (paneles / Math.max(kwp, 0.001)) +
      costeo.costoMaterialElecPorKwp +
      costeo.costoProteccionesPorKwp +
      costeo.costoManoObraPorKwp;
    partidas.push({
      equipoId: null,
      descripcion: "Instalación y materiales",
      cantidad: 1,
      precioUnitario: round2(kwp * porKwp),
      tipo: "otro",
      fuente: "heuristica",
    });
  } else {
    // Modelo A (desglosado).
    // 3) Estructura (catálogo o por panel).
    const estructura = catalogo.find((e) => e.tipo === "estructura" && e.precio != null);
    partidas.push({
      equipoId: estructura?.id ?? null,
      descripcion: estructura ? equipoLabel(estructura, "Estructura de montaje") : "Estructura de montaje",
      cantidad: paneles,
      precioUnitario: round2(estructura?.precio ?? costeo.precioEstructuraPorPanel),
      tipo: "estructura",
      fuente: estructura?.precio != null ? "catalogo" : "heuristica",
    });
    // 4) Material eléctrico / cable (por kWp).
    partidas.push({
      equipoId: null,
      descripcion: "Cable y material eléctrico",
      cantidad: 1,
      precioUnitario: round2(kwp * costeo.costoMaterialElecPorKwp),
      tipo: "material_electrico",
      fuente: "heuristica",
    });
    // 5) Protecciones (por kWp).
    partidas.push({
      equipoId: null,
      descripcion: "Protecciones eléctricas",
      cantidad: 1,
      precioUnitario: round2(kwp * costeo.costoProteccionesPorKwp),
      tipo: "material_electrico",
      fuente: "heuristica",
    });
    // 6) Mano de obra (por kWp).
    partidas.push({
      equipoId: null,
      descripcion: "Mano de obra de instalación",
      cantidad: 1,
      precioUnitario: round2(kwp * costeo.costoManoObraPorKwp),
      tipo: "mano_obra",
      fuente: "heuristica",
    });
  }

  // Sanity check: el subtotal debería caer dentro del rango de inversión.
  const subtotal = partidas.reduce((acc, p) => acc + p.cantidad * p.precioUnitario, 0);
  if (subtotal < inversionMinMax.min * 0.85) {
    advertencias.push(
      `El subtotal estimado (${round2(subtotal)}) es menor al rango esperado (${round2(inversionMinMax.min)}–${round2(inversionMinMax.max)}). Revisa precios.`,
    );
  } else if (subtotal > inversionMinMax.max * 1.15) {
    advertencias.push(
      `El subtotal estimado (${round2(subtotal)}) supera el rango esperado (${round2(inversionMinMax.min)}–${round2(inversionMinMax.max)}). Revisa precios.`,
    );
  }

  return {
    partidas,
    sistema: {
      capacidadKwp: round2(kwp),
      paneles,
      inversor: inv.etiqueta,
      produccionAnualKwh: round2(calc.produccionAnualKwh),
      ahorroAnualMxn: round2(calc.ahorroAnualMxn),
      paybackAnios: round2(calc.paybackAnios),
    },
    advertencias,
  };
}
