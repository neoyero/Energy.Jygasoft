"use client"

import { X } from "lucide-react"

import { pagoEstado } from "@/db/schema"
import { labelFor } from "@/components/admin/ui/status-badge"
import { cn } from "@/lib/utils"

/**
 * Estado de filtros del listado de pagos, resuelto en cliente sobre los datos
 * ya cargados. `null` en estado significa "todos"; `soloVencidos` filtra los
 * pagos marcados como vencidos; `busqueda` cruza concepto / folio / cliente.
 */
export interface PagosFiltrosUI {
  estado: string | null
  soloVencidos: boolean
  busqueda: string
}

/** Filtros iniciales (todo en blanco). */
export const FILTROS_INICIALES: PagosFiltrosUI = {
  estado: null,
  soloVencidos: false,
  busqueda: "",
}

const ESTADOS = pagoEstado.enumValues

const SELECT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground"

const INPUT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground"

export interface PagosFiltersProps {
  filtros: PagosFiltrosUI
  onChange: (filtros: PagosFiltrosUI) => void
}

/**
 * Barra de filtros del listado de pagos. Inmutable: cada cambio construye un
 * nuevo objeto de filtros y lo emite via onChange. El filtrado real ocurre en
 * el contenedor (PagosView) con useMemo sobre los datos ya cargados.
 */
export function PagosFilters({ filtros, onChange }: PagosFiltersProps) {
  // Helper inmutable: parche parcial sobre los filtros actuales.
  function patch(next: Partial<PagosFiltrosUI>): void {
    onChange({ ...filtros, ...next })
  }

  const hayFiltros =
    filtros.busqueda.trim() !== "" ||
    filtros.estado !== null ||
    filtros.soloVencidos

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      {/* Busqueda */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Buscar
        </span>
        <input
          type="search"
          value={filtros.busqueda}
          onChange={(event) => patch({ busqueda: event.target.value })}
          placeholder="Concepto, folio o cliente"
          className={cn(INPUT_CLASS, "w-64")}
        />
      </label>

      {/* Estado */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Estado
        </span>
        <select
          value={filtros.estado ?? ""}
          onChange={(event) =>
            patch({
              estado: event.target.value === "" ? null : event.target.value,
            })
          }
          className={SELECT_CLASS}
        >
          <option value="">Todos</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {labelFor(estado)}
            </option>
          ))}
        </select>
      </label>

      {/* Solo vencidos */}
      <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-stone-200 px-3 text-sm text-stone-600 dark:border-border dark:text-muted-foreground">
        <input
          type="checkbox"
          checked={filtros.soloVencidos}
          onChange={(event) => patch({ soloVencidos: event.target.checked })}
          className="size-4 rounded border-stone-300 text-brand focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border"
        />
        Solo vencidos
      </label>

      {/* Limpiar */}
      {hayFiltros ? (
        <button
          type="button"
          onClick={() => onChange(FILTROS_INICIALES)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-sm font-medium text-stone-600 transition-colors",
            "hover:bg-stone-50 hover:text-stone-800 dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          )}
        >
          <X className="size-3.5" aria-hidden />
          Limpiar
        </button>
      ) : null}
    </div>
  )
}
