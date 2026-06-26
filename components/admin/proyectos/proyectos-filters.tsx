"use client"

import { X } from "lucide-react"

import { proyectoFase } from "@/db/schema"
import { labelFor } from "@/components/admin/ui/status-badge"
import type { VendedorOption } from "@/lib/admin/queries"
import { cn } from "@/lib/utils"

/**
 * Estado de filtros del listado de proyectos, resuelto en cliente sobre los
 * datos ya cargados. `null` en select significa "todos"; en vendedor, ademas,
 * el sentinel SIN_ASIGNAR representa "Sin asignar" (vendedorId === null).
 */
export interface ProyectosFiltrosUI {
  busqueda: string
  /** value crudo de proyecto_fase, o null = todas. */
  fase: string | null
  /** id del vendedor, SIN_ASIGNAR para no asignados, o null = todos. */
  vendedor: string | null
}

/** Sentinel para el filtro "Sin asignar" (vendedorId === null). */
export const SIN_ASIGNAR = "__sin_asignar__"

/** Filtros iniciales (todo en blanco). */
export const FILTROS_INICIALES: ProyectosFiltrosUI = {
  busqueda: "",
  fase: null,
  vendedor: null,
}

const FASES = proyectoFase.enumValues

const SELECT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground"

const INPUT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground"

export interface ProyectosFiltersProps {
  filtros: ProyectosFiltrosUI
  onChange: (filtros: ProyectosFiltrosUI) => void
  /** Opciones de vendedor para el select (se oculta si rolScoped). */
  vendedores: ReadonlyArray<VendedorOption>
  /** Roles acotados (vendedor/preventa): se oculta el filtro de vendedor. */
  rolScoped: boolean
}

/**
 * Barra de filtros del listado de proyectos. Inmutable: cada cambio construye un
 * nuevo objeto de filtros y lo emite via onChange. El filtrado real ocurre en
 * el contenedor (ProyectosView) con useMemo sobre los datos ya cargados.
 */
export function ProyectosFilters({
  filtros,
  onChange,
  vendedores,
  rolScoped,
}: ProyectosFiltersProps) {
  // Helper inmutable: parche parcial sobre los filtros actuales.
  function patch(next: Partial<ProyectosFiltrosUI>): void {
    onChange({ ...filtros, ...next })
  }

  const hayFiltros =
    filtros.busqueda.trim() !== "" ||
    filtros.fase !== null ||
    filtros.vendedor !== null

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
          placeholder="Folio, cliente o vendedor"
          className={cn(INPUT_CLASS, "w-64")}
        />
      </label>

      {/* Fase */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
          Fase
        </span>
        <select
          value={filtros.fase ?? ""}
          onChange={(event) =>
            patch({
              fase: event.target.value === "" ? null : event.target.value,
            })
          }
          className={SELECT_CLASS}
        >
          <option value="">Todas</option>
          {FASES.map((fase) => (
            <option key={fase} value={fase}>
              {labelFor(fase)}
            </option>
          ))}
        </select>
      </label>

      {/* Vendedor (oculto para roles acotados) */}
      {rolScoped ? null : (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">
            Vendedor
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
