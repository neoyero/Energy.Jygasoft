"use client";

import type { ReactNode } from "react";

import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge";
import { formatMXN, formatInt } from "@/lib/admin/format";
import type { EsquemaCfe } from "@/lib/admin/queries";

export interface SistemaFieldsProps {
  capacidadKwp: number | null;
  paneles: number | null;
  inversor: string | null;
  produccionAnualKwh: number | null;
  ahorroAnualMxn: number | null;
  paybackAnios: number | null;
  esquema: EsquemaCfe | null;
}

const DASH = "—";

/** Numero localizado o em-dash si es null/undefined. */
function num(v: number | null): string {
  return v === null || v === undefined ? DASH : formatInt(v);
}

/** Texto o em-dash si es null/vacio. */
function txt(v: string | null): string {
  return v === null || v === undefined || v === "" ? DASH : v;
}

/**
 * Especificaciones tecnicas del sistema (capacidad, paneles, inversor,
 * produccion, ahorro, payback, esquema CFE). Solo lectura: la edicion de
 * sizing esta fuera del alcance de este modulo (se gestiona desde la
 * oportunidad / levantamiento). TODO: habilitar edicion cuando exista la
 * Server Action correspondiente.
 */
export function SistemaFields({
  capacidadKwp,
  paneles,
  inversor,
  produccionAnualKwh,
  ahorroAnualMxn,
  paybackAnios,
  esquema,
}: SistemaFieldsProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field
        label="Capacidad (kWp)"
        value={
          capacidadKwp === null ? DASH : `${formatInt(capacidadKwp)} kWp`
        }
      />
      <Field label="Paneles" value={num(paneles)} />
      <Field label="Inversor" value={txt(inversor)} />
      <Field
        label="Produccion anual (kWh)"
        value={produccionAnualKwh === null ? DASH : `${num(produccionAnualKwh)} kWh`}
      />
      <Field
        label="Ahorro anual"
        value={ahorroAnualMxn === null ? DASH : formatMXN(ahorroAnualMxn)}
      />
      <Field
        label="Payback (anios)"
        value={paybackAnios === null ? DASH : String(paybackAnios)}
      />
      <Field
        label="Esquema CFE"
        value={
          esquema ? (
            <StatusBadge value={esquema} label={labelFor(esquema)} tone="info" />
          ) : (
            DASH
          )
        }
      />
    </dl>
  );
}

function Field({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}
