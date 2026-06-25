"use client"

import { X } from "lucide-react"

import { leadCanal, leadEstado } from "@/db/schema"
import { labelFor } from "@/components/admin/ui/status-badge"
import type { VendedorOption } from "@/lib/admin/queries"
import { cn } from "@/lib/utils"

/**
 * Estado de filtros del listado de leads, resuelto en cliente sobre los datos
 * ya cargados. `null` en select significa "todos"; en vendedor, ademas, el
 * sentinel SIN_ASIGNAR representa "Sin asignar" (vendedorId === null).
 */
export interface LeadsFiltrosUI {
  busqueda: string
  estado: string | null
  canal: string | null
  /** id del vendedor, SIN_ASIGNAR para no asignados, o null = todos. */
  vendedor: string | null
  scoreMin: number | null
  desde: string | null
  hasta: string | null
}

/** Sentinel para el filtro "Sin asignar" (vendedorId === null). */
export const SIN_ASIGNAR = "__sin_asignar__"

/** Filtros iniciales (todo en blanco). */
export const FILTROS_INICIALES: LeadsFiltrosUI = {
  busqueda: "",
  estado: null,
  canal: null,
  vendedor: null,
  scoreMin: null,
  desde: null,
  hasta: null,
}

const ESTADOS = leadEstado.enumValues
const CANALES = leadCanal.enumValues

const SELECT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground"

const INPUT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground"

export interface LeadsFiltersProps {
  filtros: LeadsFiltrosUI
  onChange: (filtros: LeadsFiltrosUI) => void
  /** Opciones de vendedor para el select (se oculta si rolScoped). */
  vendedores: ReadonlyArray<VendedorOption>
  /** Roles acotados (vendedor/preventa): se oculta el filtro de vendedor. */
  rolScoped: boolean
}

/**
 * Barra de filtros del listado de leads. Inmutable: cada cambio construye un
 * nuevo objeto de filtros y lo emite via onChange. El filtrado real ocurre en
 * el contenedor (LeadsView) con useMemo sobre los datos ya cargados.
 */
export function LeadsFilters({
  filtros,
  onChange,
  vendedores,
  rolScoped,
}: LeadsFiltersProps) {
  // Helper inmutable: parche parcial sobre los filtros actuales.
  function patch(next: Partial<LeadsFiltrosUI>): void {
    onChange({ ...filtros, ...next })
  }

  const hayFiltros =
    filtros.busqueda.trim() !== "" ||
    filtros.estado !== null ||
    filtros.canal !== null ||
    filtros.vendedor !== null ||
    filtros.scoreMin !== null ||
    filtros.desde !== null ||
    filtros.hasta !== null

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
          placeholder="Nombre, email o telefono"
          className={cn(INPUT_CLASS, "w-56")}
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
            patch({ estado: event.target.value === "" ? null : event.target.value })
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

      {/* Canal */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Canal
        </span>
        <select
          value={filtros.canal ?? ""}
          onChange={(event) =>
            patch({ canal: event.target.value === "" ? null : event.target.value })
          }
          className={SELECT_CLASS}
        >
          <option value="">Todos</option>
          {CANALES.map((canal) => (
            <option key={canal} value={canal}>
              {labelFor(canal)}
            </option>
          ))}
        </select>
      </label>

      {/* Asesor (oculto para roles acotados) */}
      {rolScoped ? null : (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
            Asesor
          </span>
          <select
            value={filtros.vendedor ?? ""}
            onChange={(event) =>
              patch({
                vendedor: event.target.value === "" ? null : event.target.value,
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">Todos</option>
            <option value={SIN_ASIGNAR}>Sin asignar</option>
            {vendedores.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Score minimo */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Score min
        </span>
        <input
          type="number"
          min={0}
          max={100}
          value={filtros.scoreMin ?? ""}
          onChange={(event) =>
            patch({
              scoreMin:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
          placeholder="0"
          className={cn(INPUT_CLASS, "w-20 tabular-nums")}
        />
      </label>

      {/* Rango de fechas (createdAt) */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Desde
        </span>
        <input
          type="date"
          value={filtros.desde ?? ""}
          onChange={(event) =>
            patch({ desde: event.target.value === "" ? null : event.target.value })
          }
          className={cn(INPUT_CLASS, "w-40")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Hasta
        </span>
        <input
          type="date"
          value={filtros.hasta ?? ""}
          onChange={(event) =>
            patch({ hasta: event.target.value === "" ? null : event.target.value })
          }
          className={cn(INPUT_CLASS, "w-40")}
        />
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
