/**
 * Cálculo PURO de totales de cotización (sin imports de servidor).
 *
 * Reglas de negocio:
 *  - subtotal = Σ (cantidad * precioUnitario), redondeado a 2 decimales.
 *  - iva      = subtotal * IVA_RATE, redondeado a 2 decimales.
 *  - total    = subtotal + iva, redondeado a 2 decimales.
 *
 * Todos los redondeos usan round2 (medio hacia arriba) para alinear con la
 * presentación en moneda MXN. Mantener este módulo libre de dependencias de
 * servidor (db, next, etc.) para que sea testeable y reutilizable.
 */

/** Tasa de IVA general (16%). */
export const IVA_RATE = 0.16;

export interface ItemCalc {
  cantidad: number;
  precioUnitario: number;
}

export interface Totales {
  subtotal: number;
  iva: number;
  total: number;
}

/** Redondea a 2 decimales evitando arrastre de errores de coma flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula subtotal, IVA y total a partir de las líneas de la cotización.
 * Las cantidades/precios no finitos se tratan como 0 para no propagar NaN.
 */
export function calcularTotales(items: ItemCalc[]): Totales {
  const bruto = items.reduce((acc, item) => {
    const cantidad = Number.isFinite(item.cantidad) ? item.cantidad : 0;
    const precio = Number.isFinite(item.precioUnitario)
      ? item.precioUnitario
      : 0;
    return acc + cantidad * precio;
  }, 0);

  const subtotal = round2(bruto);
  const iva = round2(subtotal * IVA_RATE);
  const total = round2(subtotal + iva);

  return { subtotal, iva, total };
}
