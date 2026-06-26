"use client"

import { Trash2 } from "lucide-react"

import type { DimensionarResult } from "@/lib/admin/cotizacion-dimensionado"
import { formatMXN, formatInt } from "@/lib/admin/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Tipo de una partida del preview (derivado del resultado del dimensionado). */
type PartidaPreview = DimensionarResult["partidas"][number]

export interface PreviewDimensionamientoProps {
  preview: DimensionarResult
  onChange: (next: DimensionarResult) => void
}

/** IVA fijo de la previsualizacion (16%). El backend recalcula al persistir. */
const IVA_RATE = 0.16
const IVA_PCT = `${Math.round(IVA_RATE * 100)}%`

const fieldLabel =
  "text-[11px] font-medium uppercase tracking-wide text-muted-foreground"

/** Parsea un input numerico a number, tratando vacio/NaN como 0. */
function toNumber(raw: string): number {
  if (raw.trim() === "") return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Etiqueta legible de la fuente de una partida. */
function fuenteLabel(fuente: PartidaPreview["fuente"]): string {
  return fuente === "catalogo" ? "Catalogo" : "Heuristica"
}

/** Chip de color por fuente: catalogo (emerald) vs heuristica (amber). */
function chipClass(fuente: PartidaPreview["fuente"]): string {
  return fuente === "catalogo"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
}

/** Item de metrica del sistema (label arriba, valor grande abajo). */
function Metrica({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

/**
 * Previsualizacion EDITABLE del dimensionamiento. Muestra las metricas del
 * sistema (capacidad, paneles, inversor, produccion, ahorro, payback) y una
 * tabla de partidas editable (descripcion / cantidad / precio unitario), con
 * importe calculado, chip de fuente y borrado por fila. Emite copias inmutables
 * via onChange. Calcula subtotal / IVA 16% / total al pie y lista advertencias.
 */
export function PreviewDimensionamiento({
  preview,
  onChange,
}: PreviewDimensionamientoProps) {
  const { sistema, partidas, advertencias } = preview

  const subtotal = partidas.reduce(
    (acc, p) => acc + p.cantidad * p.precioUnitario,
    0,
  )
  const iva = subtotal * IVA_RATE
  const total = subtotal + iva

  // Reemplazo inmutable de una partida por indice.
  function patchPartida(index: number, next: PartidaPreview): void {
    onChange({
      ...preview,
      partidas: preview.partidas.map((p, i) => (i === index ? next : p)),
    })
  }

  // Elimina una partida por indice (inmutable).
  function removePartida(index: number): void {
    onChange({
      ...preview,
      partidas: preview.partidas.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-4">
      {/* Metricas del sistema */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metrica
          label="Capacidad"
          value={`${formatInt(sistema.capacidadKwp)} kWp`}
        />
        <Metrica label="Paneles" value={formatInt(sistema.paneles)} />
        <Metrica label="Inversor" value={sistema.inversor ?? "—"} />
        <Metrica
          label="Produccion anual"
          value={`${formatInt(sistema.produccionAnualKwh)} kWh`}
        />
        <Metrica
          label="Ahorro anual"
          value={formatMXN(sistema.ahorroAnualMxn)}
        />
        <Metrica
          label="Payback"
          value={`${formatInt(sistema.paybackAnios)} años`}
        />
      </div>

      {/* Advertencias */}
      {advertencias.length > 0 ? (
        <ul className="space-y-2">
          {advertencias.map((aviso, i) => (
            <li
              key={i}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            >
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Tabla editable de partidas */}
      <div className="space-y-2">
        <p className={fieldLabel}>Partidas sugeridas</p>

        {partidas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No hay partidas en la propuesta.
          </p>
        ) : (
          partidas.map((partida, index) => {
            const importe = partida.cantidad * partida.precioUnitario
            return (
              <div
                key={index}
                className={cn(
                  "grid grid-cols-1 gap-3 rounded-xl border border-border p-3",
                  "sm:grid-cols-[1fr_5rem_8rem_8rem_auto] sm:items-end",
                )}
              >
                {/* Descripcion + chip de fuente */}
                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className={fieldLabel}>Descripcion</span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        chipClass(partida.fuente),
                      )}
                    >
                      {fuenteLabel(partida.fuente)}
                    </span>
                  </span>
                  <Input
                    value={partida.descripcion}
                    placeholder="Descripcion de la partida"
                    onChange={(e) =>
                      patchPartida(index, {
                        ...partida,
                        descripcion: e.target.value,
                      })
                    }
                  />
                </label>

                {/* Cantidad */}
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Cantidad</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={String(partida.cantidad)}
                    className="text-right tabular-nums"
                    onChange={(e) =>
                      patchPartida(index, {
                        ...partida,
                        cantidad: toNumber(e.target.value),
                      })
                    }
                  />
                </label>

                {/* Precio unitario */}
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>P. unitario</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={String(partida.precioUnitario)}
                    className="text-right tabular-nums"
                    onChange={(e) =>
                      patchPartida(index, {
                        ...partida,
                        precioUnitario: toNumber(e.target.value),
                      })
                    }
                  />
                </label>

                {/* Importe (solo lectura) */}
                <div className="flex flex-col gap-1">
                  <span className={fieldLabel}>Importe</span>
                  <span className="flex h-8 items-center justify-end px-1 text-sm font-medium tabular-nums text-foreground">
                    {formatMXN(importe)}
                  </span>
                </div>

                {/* Borrar */}
                <div className="flex justify-end sm:pb-0.5">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    aria-label="Eliminar partida"
                    onClick={() => removePartida(index)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Totales */}
      <dl className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums text-foreground">
            {formatMXN(subtotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">{`IVA (${IVA_PCT})`}</dt>
          <dd className="tabular-nums text-foreground">{formatMXN(iva)}</dd>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
          <dt className="text-base font-semibold text-foreground">Total</dt>
          <dd className="text-base font-semibold tabular-nums text-brand dark:text-foreground">
            {formatMXN(total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
