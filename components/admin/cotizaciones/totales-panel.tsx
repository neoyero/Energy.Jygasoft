"use client";

import { formatMXN } from "@/lib/admin/format";
import { IVA_RATE } from "@/lib/admin/cotizacion-calc";
import { cn } from "@/lib/utils";

export interface TotalesPanelProps {
  subtotal: number;
  iva: number;
  total: number;
  /** Moneda mostrada junto al total (informativa). Default "MXN". */
  moneda?: string;
  className?: string;
}

/** Porcentaje de IVA legible (ej. "16%") derivado de IVA_RATE. */
const IVA_PCT = `${Math.round(IVA_RATE * 100)}%`;

/**
 * Panel de totales (subtotal / IVA / total) en vivo. Presentacional puro:
 * recibe los montos ya calculados por calcularTotales y los formatea en MXN.
 */
export function TotalesPanel({
  subtotal,
  iva,
  total,
  moneda = "MXN",
  className,
}: TotalesPanelProps) {
  return (
    <dl className={cn("flex flex-col gap-2 text-sm", className)}>
      <Row label="Subtotal" value={formatMXN(subtotal)} />
      <Row label={`IVA (${IVA_PCT})`} value={formatMXN(iva)} />
      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <dt className="text-base font-semibold text-foreground">Total</dt>
        <dd className="text-base font-semibold tabular-nums text-brand dark:text-foreground">
          {formatMXN(total)}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {moneda}
          </span>
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
